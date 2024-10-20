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

import { client } from './api/client.js';
import { SpanReadQuery } from './dtos/span-read.js';
import { assertTracePermission, assertClient, processApiProxyResponse } from './utils.js';
import { TraceReadParams, TraceReadQuery } from './dtos/trace-read.js';

export async function getTrace({
  id,
  include_mlflow,
  include_mlflow_tree,
  include_tree
}: TraceReadParams & TraceReadQuery) {
  await assertTracePermission({ traceId: id });
  assertClient(client);

  return processApiProxyResponse(
    client.GET('/trace/{id}', {
      params: {
        path: {
          id
        },
        query: {
          include_mlflow,
          include_mlflow_tree,
          include_tree
        }
      }
    })
  );
}

export async function listSpans(query: SpanReadQuery) {
  await assertTracePermission({ traceId: query.trace_id });
  assertClient(client);

  return processApiProxyResponse(
    client.GET('/span', {
      params: {
        query: query
      }
    })
  );
}
