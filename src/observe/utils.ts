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

import { FetchResponse } from 'openapi-fetch';

import { Client } from './api/client.js';

import { getServiceLogger } from '@/logger.js';
import { ORM } from '@/database.js';
import { Run } from '@/runs/entities/run.entity.js';
import { APIError, APIErrorCode } from '@/errors/error.entity.js';

export const getTraceLogger = () => getServiceLogger('trace');

export async function assertTracePermission({ traceId }: { traceId: string }) {
  await ORM.em.getRepository(Run).findOneOrFail({
    trace: {
      id: traceId
    }
  });
}

export function assertClient(client: Client | undefined): asserts client is Client {
  if (!client) {
    throw new APIError({
      message: 'Bee observe API client is not defined',
      code: APIErrorCode.SERVICE_UNAVAILABLE
    });
  }
}

type MediaType = `${string}/${string}`;
export async function processApiProxyResponse<T, O, M extends MediaType>(
  response: Promise<FetchResponse<T, O, M>>
): Promise<FetchResponse<T, O, M>['data']> {
  const { data, error } = await response;

  if (error) {
    getTraceLogger().error({ err: error }, 'Observe API: Invalid response');
    throw new APIError(
      {
        message: 'Observe API: Invalid response',
        code: APIErrorCode.SERVICE_ERROR
      },
      {
        cause: error
      }
    );
  }

  return data;
}