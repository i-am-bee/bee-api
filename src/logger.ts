/**
 * Copyright 2024 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { IncomingMessage } from 'node:http';

import { Logger, LoggerOptions, pino, SerializedError } from 'pino';
import { FastifyReply, FastifyRequest } from 'fastify';
import { requestContext } from '@fastify/request-context';

import { LOG_LEVEL } from './config.js';

export const LogLabels = {
  ALERT: 'alert',
  CORRELATION_ID: 'correlationId'
} as const;

export const createLogger = (
  options?: Omit<LoggerOptions, 'name' | 'level' | 'timestamp'>
): Logger =>
  pino({
    ...options,
    name: 'bee-api',
    level: LOG_LEVEL,
    base: { hostname: os.hostname(), ...options?.base },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level(label) {
        return { level: label };
      },
      ...options?.formatters
    }
  });

function stringifySerializedError(err: SerializedError, depth = 1): string {
  if (depth > 5) return 'Causes too deep, truncating ...';
  const depthMarker = `#`.repeat(depth);
  return `${depthMarker} Message
${err.message}
${depthMarker} Type
${err.type}
${depthMarker} Stack
${err.stack}${
    err.cause
      ? `${depthMarker} Cause
${stringifySerializedError(err, depth + 1)}`
      : ''
  }`;
}

export const fastifyLogger = createLogger({
  serializers: {
    err(err) {
      const error = pino.stdSerializers.errWithCause(err);
      if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
        // Elastic backend used for observability doesn't seem to support nested attributes (labels)
        return stringifySerializedError(error);
      } else {
        return error;
      }
    },
    req(request: FastifyRequest) {
      return {
        host:
          request.headers['x-forwarded-host'] ||
          request.headers.host ||
          request.headers[':authority'],
        correlationId: request.id || null,
        ipAddress: request.ip || request.headers['x-forwarded-for'] || request.socket.remoteAddress,
        method: request.method,
        url: request.url,
        hostname: request.hostname,
        params: request.params
      };
    },
    res(response: FastifyReply) {
      return {
        hostname: response.request?.hostname,
        correlationId: response.request?.id || null,
        statusMessage: response.raw?.statusMessage,
        statusCode: response.statusCode
      };
    }
  }
});

export function getLogger() {
  const request = requestContext.get('req');
  if (!request?.id) {
    return fastifyLogger;
  }
  return fastifyLogger.child({
    [LogLabels.CORRELATION_ID]: request.id
  });
}

export function getServiceLogger(service: string) {
  return getLogger().child({ service });
}

export function getJobLogger(job: string) {
  return getLogger().child({ job });
}

export const CORRELATION_ID_HEADER = 'x-correlation-id';

export const getCorrelationId = (req: IncomingMessage) => {
  const correlationId = Array.isArray(req.headers[CORRELATION_ID_HEADER])
    ? req.headers[CORRELATION_ID_HEADER][0]
    : req.headers[CORRELATION_ID_HEADER];
  return correlationId ?? randomUUID();
};
