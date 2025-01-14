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

import { FastifyPluginAsyncJsonSchemaToTs } from '@fastify/type-provider-json-schema-to-ts';

import { listSpans, getTrace } from './observe.service.js';
import {
  TraceReadParams,
  traceReadParamsSchema,
  TraceReadQuery,
  traceReadQuerySchema
} from './dtos/trace-read.js';
import {
  SpanReadParams,
  spanReadParamsSchema,
  SpanReadQuery,
  spanReadQuerySchema
} from './dtos/span-read.js';

export const observeModule: FastifyPluginAsyncJsonSchemaToTs = async (app) => {
  app.get<{ Params: TraceReadParams; Querystring: TraceReadQuery }>(
    '/traces/:id',
    {
      preHandler: app.auth(),
      schema: {
        params: traceReadParamsSchema,
        querystring: traceReadQuerySchema,
        hide: true
      }
    },
    async (req, reply) => {
      return getTrace(req, reply);
    }
  );

  app.get<{ Params: SpanReadParams; Querystring: SpanReadQuery }>(
    '/traces/:trace_id/spans',
    {
      preHandler: app.auth(),
      schema: {
        querystring: spanReadQuerySchema,
        params: spanReadParamsSchema,
        hide: true
      }
    },
    async (req, reply) => {
      return listSpans(req, reply);
    }
  );
};
