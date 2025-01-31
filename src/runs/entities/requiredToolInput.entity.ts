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

import { Embeddable, Embedded, Property } from '@mikro-orm/core';

import { RequiredAction, RequiredActionType } from './requiredAction.entity';

import { CodeInterpreterCall } from '@/tools/entities/tool-calls/code-interpreter-call.entity';
import { FileSearchCall } from '@/tools/entities/tool-calls/file-search-call.entity';
import { FunctionCall } from '@/tools/entities/tool-calls/function-call.entity';
import { SystemCall } from '@/tools/entities/tool-calls/system-call.entity';
import { UserCall } from '@/tools/entities/tool-calls/user-call.entity';

@Embeddable({ discriminatorValue: RequiredActionType.INPUT })
export class RequiredToolInput extends RequiredAction {
  type = RequiredActionType.INPUT;

  // Union must be defined in alphabetical order, otherwise Mikro-ORM won't discovered the auto-created virtual polymorphic entity
  @Embedded({ object: true })
  toolCalls!: (CodeInterpreterCall | FileSearchCall | FunctionCall | SystemCall | UserCall)[];

  @Property()
  inputFields!: string[];

  constructor({ toolCalls, inputFields }: RequiredToolInputInput) {
    super();
    this.toolCalls = toolCalls;
    this.inputFields = inputFields;
  }
}

export type RequiredToolInputInput = Pick<RequiredToolInput, 'toolCalls' | 'inputFields'>;
