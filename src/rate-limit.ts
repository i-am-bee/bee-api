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

import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import rateLimit, { errorResponseBuilderContext } from '@fastify/rate-limit';

import { closeClient, createRedisClient } from './redis.js';
import { AuthSecret, determineAuthType, scryptSecret } from './auth/utils.js';
import { toErrorResponseDto } from './errors/plugin.js';
import { APIError, APIErrorCode } from './errors/error.entity.js';
import { ARTIFACT_SECRET_RATE_LIMIT, DEFAULT_RATE_LIMIT } from './config.js';

const redis = createRedisClient({
  /**
   * "The default parameters of a redis connection are not the fastest to provide a rate-limit. We suggest to customize the connectTimeout and maxRetriesPerRequest.
   * Source: https://github.com/fastify/fastify-rate-limit
   */
  connectTimeout: 1000, // 500 was too low, getting ETIMEDOUT
  maxRetriesPerRequest: 1
});

export const rateLimitPlugin: FastifyPluginAsync = fp.default(async (app) => {
  await app.register(rateLimit, {
    global: true,
    enableDraftSpec: true,
    max: (request: FastifyRequest) => {
      const authType = determineAuthType(request);
      switch (authType.type) {
        case AuthSecret.ARTIFACT_SECRET:
          return ARTIFACT_SECRET_RATE_LIMIT;
        default:
          return DEFAULT_RATE_LIMIT;
      }
    },
    hook: 'onRequest',
    timeWindow: 1000,
    cache: 5000,
    redis,
    nameSpace: 'bee-api-ratelimit-',
    skipOnError: true,
    onExceeded: (req, key) => {
      req.log.info({ key }, `Rate-limit exceeded`);
    },
    errorResponseBuilder: (request: FastifyRequest, context: errorResponseBuilderContext) => {
      return toErrorResponseDto(
        new APIError({
          message: `Exceeded ${context.max} requests per ${context.after}`,
          code: APIErrorCode.TOO_MANY_REQUESTS
        })
      );
    },
    keyGenerator: (request: FastifyRequest): string => {
      const authType = determineAuthType(request);
      switch (authType.type) {
        case AuthSecret.ACCESS_TOKEN:
          return authType.value;
        case AuthSecret.API_KEY:
          return scryptSecret(authType.value);
        case AuthSecret.ARTIFACT_SECRET:
          return scryptSecret(authType.value);
        case AuthSecret.UNKNOWN:
          return request.ip;
      }
    }
  });
  app.addHook('onClose', () => closeClient(redis));
});
