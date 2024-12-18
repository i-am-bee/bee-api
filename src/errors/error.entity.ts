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

import { Embeddable, Property } from '@mikro-orm/core';
import { FrameworkError } from 'bee-agent-framework';
import { AgentError } from 'bee-agent-framework/agents/base';
import { ToolError } from 'bee-agent-framework/tools/base';

export const APIErrorCode = {
  AUTH_ERROR: 'auth_error',
  INTERNAL_SERVER_ERROR: 'internal_server_error',
  INVALID_INPUT: 'invalid_input',
  NOT_FOUND: 'not_found',
  SERVICE_UNAVAILABLE: 'service_unavailable',
  SERVICE_ERROR: 'service_error',
  TOO_MANY_REQUESTS: 'too_many_requests',
  FORBIDDEN: 'forbidden',

  FRAMEWORK_ERROR: 'framework_error',
  AGENT_ERROR: 'agent_error',
  TOOL_ERROR: 'tool_error'
} as const;
export type APIErrorCode = (typeof APIErrorCode)[keyof typeof APIErrorCode];

@Embeddable()
export class APIError {
  @Property()
  public readonly code: APIErrorCode;

  @Property()
  public readonly message: string;

  public readonly cause?: unknown;

  constructor({ message, code }: { message: string; code: APIErrorCode }, options?: ErrorOptions) {
    this.code = code;
    this.message = message;
    this.cause = options?.cause;
  }

  static from(err: unknown): APIError {
    if (err instanceof FrameworkError) {
      for (const innerErr of Array.from(err.traverseErrors()).reverse()) {
        if (innerErr instanceof ToolError) {
          return new APIError(
            { message: innerErr.message, code: APIErrorCode.TOOL_ERROR },
            { cause: innerErr }
          );
        } else if (innerErr instanceof AgentError) {
          return new APIError(
            { message: innerErr.message, code: APIErrorCode.AGENT_ERROR },
            { cause: innerErr }
          );
        }
        return new APIError(
          { message: innerErr.message, code: APIErrorCode.INTERNAL_SERVER_ERROR },
          { cause: innerErr }
        );
      }
      return new APIError(
        { message: err.message, code: APIErrorCode.FRAMEWORK_ERROR },
        { cause: err }
      );
    }

    return new APIError(
      {
        message: err instanceof Error ? err.message : 'Unspecified error',
        code: APIErrorCode.INTERNAL_SERVER_ERROR
      },
      { cause: err }
    );
  }
}
