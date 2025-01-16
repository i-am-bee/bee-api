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

import { RequiredToolApprove } from './requiredToolApprove.entity';
import { RequiredToolOutput } from './requiredToolOutput.entity';
import { RequiredToolInput } from './requiredToolInput.entity';

import { generatePrefixedObjectId } from '@/utils/id';

export enum RequiredActionType {
  OUTPUT = 'output',
  APPROVE = 'approve',
  INPUT = 'input'
}

@Embeddable({ abstract: true, discriminatorColumn: 'type' })
export abstract class RequiredAction {
  @Property({ fieldName: '_id' })
  id = generatePrefixedObjectId('action');

  @Enum(() => RequiredActionType)
  type!: RequiredActionType;
}

export type AnyRequiredAction = RequiredToolApprove | RequiredToolInput | RequiredToolOutput;
