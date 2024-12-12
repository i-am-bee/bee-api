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

import { Embeddable, Enum, Property } from '@mikro-orm/core';

import { ToolType } from '../tool/tool.entity.js';

import { ToolCall } from './tool-call.entity.js';

export enum SystemTools {
  WEB_SEARCH = 'web_search',
  WIKIPEDIA = 'wikipedia',
  WEATHER = 'weather',
  ARXIV = 'arxiv',
  READ_FILE = 'read_file',
  LLM = 'llm',
  CALCULATOR = 'calculator'
}

@Embeddable({ discriminatorValue: ToolType.SYSTEM })
export class SystemCall extends ToolCall {
  type = ToolType.SYSTEM;

  @Enum()
  toolId!: SystemTools;

  @Property({ type: 'json' })
  input?: unknown;

  @Property({ type: 'json' })
  output?: unknown;

  constructor({ toolId: name, input, output }: SystemCallInput) {
    super();
    this.toolId = name;
    this.input = input;
    this.output = output;
  }
}

export type SystemCallInput = Pick<SystemCall, 'toolId' | 'input' | 'output'>;
