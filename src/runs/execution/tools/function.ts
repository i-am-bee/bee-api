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

import {
  BaseToolOptions,
  BaseToolRunOptions,
  ToolEmitter,
  StringToolOutput,
  Tool,
  ToolInput
} from 'bee-agent-framework/tools/base';
import { SchemaObject } from 'ajv';
import { Loaded } from '@mikro-orm/core';
import { GetRunContext } from 'bee-agent-framework/context';
import { Emitter } from 'bee-agent-framework/emitter/emitter';
import { Redis } from 'ioredis';

import { AgentContext } from '../execute.js';

import { withRedisClient } from '@/redis.js';
import { Run } from '@/runs/entities/run.entity.js';
import { ORM } from '@/database.js';
import { toRunDto } from '@/runs/runs.service.js';
import { FunctionCall } from '@/tools/entities/tool-calls/function-call.entity.js';
import { RequiredToolOutput } from '@/runs/entities/requiredToolOutput.entity.js';

export interface FunctionToolOptions extends BaseToolOptions {
  name: string;
  description?: string;
  parameters?: SchemaObject;

  context: AgentContext;
}

export class FunctionToolOutput extends StringToolOutput {}

export class FunctionTool extends Tool<FunctionToolOutput, FunctionToolOptions> {
  name: string;
  description: string;

  static {
    this.register();
  }

  readonly emitter: ToolEmitter<Record<string, any>, StringToolOutput> = Emitter.root.child({
    namespace: ['tool', 'function'],
    creator: this
  });

  inputSchema() {
    return this.options.parameters ?? {};
  }

  public constructor({ name, description, ...rest }: FunctionToolOptions) {
    super({ name, description, ...rest });
    this.name = name;
    this.description = description ?? 'Use input schema to infer description';
  }

  private static createChannel(run: Loaded<Run>, toolCallId: string) {
    return `run:${run.id}:call:${toolCallId}:output`;
  }

  protected async _run(
    _: ToolInput<this>,
    __: Partial<BaseToolRunOptions>,
    run: GetRunContext<typeof this>
  ) {
    const toolCall = this.options.context.toolCall;
    if (!(toolCall instanceof FunctionCall)) throw new Error('Invalid tool call');

    return await withRedisClient(
      (client) =>
        new Promise<FunctionToolOutput>((resolve, reject) => {
          client.subscribe(
            FunctionTool.createChannel(this.options.context.run, toolCall.id),
            async (err) => {
              if (err) {
                reject(err);
              } else {
                this.options.context.run.requireAction(
                  new RequiredToolOutput({
                    toolCalls: [
                      ...(this.options.context.run.requiredAction?.toolCalls ?? []),
                      toolCall
                    ]
                  })
                );
                await ORM.em.flush();
                await this.options.context.publish({
                  event: 'thread.run.requires_action',
                  data: toRunDto(this.options.context.run)
                });
                await this.options.context.publish({
                  event: 'done',
                  data: '[DONE]'
                });
              }
            }
          );
          client.on('message', async (_, output) => {
            this.options.context.run.submitAction();
            await ORM.em.flush();
            resolve(new FunctionToolOutput(output));
          });
          run.signal.addEventListener('abort', () => {
            reject(run.signal.reason);
          });
        })
    );
  }

  static async submit(
    client: Redis,
    output: string,
    { run, toolCallId }: { run: Loaded<Run>; toolCallId: string }
  ) {
    await client.publish(FunctionTool.createChannel(run, toolCallId), output);
  }
}
