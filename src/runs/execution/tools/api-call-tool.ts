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

import { join } from 'path';

import {
  BaseToolOptions,
  BaseToolRunOptions,
  StringToolOutput,
  Tool,
  ToolError
} from 'bee-agent-framework/tools/base';
import { SchemaObject } from 'ajv';
import { parse } from 'yaml';
import { isEmpty } from 'remeda';
import axios from 'axios';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { GetRunContext } from 'bee-agent-framework/context';

import { AgentContext } from '../execute.js';

import { APIError, APIErrorCode } from '@/errors/error.entity.js';
import decrypt from '@/utils/crypto/decrypt.js';
import { HTTP_PROXY_URL } from '@/config';

export interface ApiCallToolOptions extends BaseToolOptions {
  name: string;
  description?: string;
  openApiSchema?: any;
  apiKey?: string;

  context: AgentContext;
}

// TODO use tool from the framework
export class ApiCallTool extends Tool<StringToolOutput, ApiCallToolOptions> {
  name: string;
  description: string;
  openApiSchema: any;
  apiKey?: string;

  inputSchema() {
    return {
      type: 'object',
      required: ['path', 'method'],
      oneOf: Object.entries(this.openApiSchema.paths).flatMap(([path, pathSpec]: [string, any]) =>
        Object.entries(pathSpec).map(([method, methodSpec]: [string, any]) => ({
          additionalProperties: false,
          properties: {
            path: {
              const: path,
              description:
                'Do not replace variables in path, instead of, put them to the parameters object.'
            },
            method: { const: method, description: methodSpec.summary || methodSpec.description },
            ...(methodSpec.requestBody?.content?.['application/json']?.schema
              ? {
                  body: methodSpec.requestBody?.content?.['application/json']?.schema
                }
              : {}),
            ...(methodSpec.parameters
              ? {
                  parameters: {
                    type: 'object',
                    additionalProperties: false,
                    required: methodSpec.parameters
                      .filter((p: any) => p.required === true)
                      .map((p: any) => p.name),
                    properties: methodSpec.parameters.reduce(
                      (acc: any, p: any) => ({
                        ...acc,
                        [p.name]: { ...p.schema, description: p.name }
                      }),
                      {}
                    )
                  }
                }
              : {})
          }
        }))
      )
    } as const satisfies SchemaObject;
  }

  public constructor({ name, description, openApiSchema, apiKey, ...rest }: ApiCallToolOptions) {
    super({ name, description, ...rest });
    this.name = name;
    this.apiKey = apiKey;
    this.description = description ?? 'Use input schema to infer description';
    this.openApiSchema = parse(openApiSchema);
    if (!this.openApiSchema?.paths) {
      throw new APIError({
        message: `Server is not specified`,
        code: APIErrorCode.INVALID_INPUT
      });
    }
  }

  protected async _run(
    input: any,
    _options: BaseToolRunOptions | undefined,
    run: GetRunContext<typeof this>
  ) {
    let path: string = input.path || '';
    const url = new URL(this.openApiSchema.servers[0].url);
    Object.keys(input.parameters ?? {}).forEach((key) => {
      if (path.search(`{${key}}`) >= 0) {
        path = path.replace(`{${key}}`, input.parameters[key]);
      } else {
        url.searchParams.append(key, input.parameters[key]);
      }
    });
    url.pathname = join(url.pathname, path);
    const headers: { [key: string]: string } = { Accept: 'application/json' };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${decrypt(this.apiKey)}`;
    }
    try {
      const response = await axios.request({
        url: url.toString(),
        data: !isEmpty(input.body) ? input.body : undefined,
        method: input.method.toLowerCase(),
        headers,
        transformResponse: [(data) => data],
        httpsAgent: HTTP_PROXY_URL && new HttpsProxyAgent(HTTP_PROXY_URL),
        httpAgent: HTTP_PROXY_URL && new HttpProxyAgent(HTTP_PROXY_URL),
        signal: AbortSignal.any([AbortSignal.timeout(30_000), run.signal])
      });
      return new StringToolOutput(response.data);
    } catch (error) {
      throw new ToolError(`Request to ${url} failed.`, [error]);
    }
  }
}
