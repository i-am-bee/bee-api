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

import { FastifyReply, FastifyRequest } from 'fastify';

import { client } from './api/client.js';
import { SpanReadParams, SpanReadQuery } from './dtos/span-read.js';
import { assertTracePermission, assertClient, processApiProxyResponse } from './utils.js';
import { TraceReadParams, TraceReadQuery } from './dtos/trace-read.js';

export async function getTrace(
  req: FastifyRequest<{ Params: TraceReadParams; Querystring: TraceReadQuery }>,
  reply: FastifyReply
) {
  await assertTracePermission({ traceId: req.params.id });
  assertClient(client);

  return processApiProxyResponse(
    client.GET('/v1/traces/{id}', {
      params: {
        path: {
          id: req.params.id
        },
        query: req.query
      }
    }),
    reply
  );
}

export async function listSpans(
  req: FastifyRequest<{ Params: SpanReadParams; Querystring: SpanReadQuery }>,
  reply: FastifyReply
) {
  await assertTracePermission({ traceId: req.params.trace_id });
  assertClient(client);

  return processApiProxyResponse(
    client.GET('/v1/traces/{trace_id}/spans', {
      params: {
        path: {
          trace_id: req.params.trace_id
        },
        query: req.query
      }
    }),
    reply
  );
}
