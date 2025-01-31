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

import { Embedded, Entity, Enum, Index, ManyToOne, Property, Ref } from '@mikro-orm/core';
import dayjs from 'dayjs';

import { RUN_EXPIRATION_MILLISECONDS } from '../execution/constants.js';

import { RequiredToolApprove } from './requiredToolApprove.entity.js';
import { RequiredToolOutput } from './requiredToolOutput.entity.js';
import { ToolApproval } from './toolApproval.entity.js';
import { RequiredToolInput } from './requiredToolInput.entity.js';

import { Assistant } from '@/assistants/assistant.entity.js';
import { Thread } from '@/threads/thread.entity.js';
import { APIError } from '@/errors/error.entity.js';
import { AnyToolUsage } from '@/tools/entities/tool-usages/tool-usage.entity.js';
import { CodeInterpreterUsage } from '@/tools/entities/tool-usages/code-interpreter-usage.entity.js';
import { FileSearchUsage } from '@/tools/entities/tool-usages/file-search-usage.entity.js';
import { FunctionUsage } from '@/tools/entities/tool-usages/function-usage.entity.js';
import { UserUsage } from '@/tools/entities/tool-usages/user-usage.entity.js';
import { SystemUsage } from '@/tools/entities/tool-usages/system-usage.entity.js';
import { Trace } from '@/observe/entities/trace.entity.js';
import {
  PrincipalScopedEntity,
  PrincipalScopedEntityInput
} from '@/common/principal-scoped.entity.js';

export const RunStatus = {
  QUEUED: 'queued',
  IN_PROGRESS: 'in_progress',
  REQUIRES_ACTION: 'requires_action',
  CANCELLING: 'cancelling',
  CANCELLED: 'cancelled',
  FAILED: 'failed',
  COMPLETED: 'completed',
  INCOMPLETE: 'incomplete',
  EXPIRED: 'expired'
} as const;
export type RunStatus = (typeof RunStatus)[keyof typeof RunStatus];

@Entity()
export class Run extends PrincipalScopedEntity {
  getIdPrefix(): string {
    return 'run';
  }

  @Index()
  @ManyToOne()
  thread!: Ref<Thread>;

  @ManyToOne()
  assistant!: Ref<Assistant>;

  @Enum(() => RunStatus)
  status: RunStatus = RunStatus.QUEUED;

  @Embedded({ object: true })
  lastError?: APIError;

  @Embedded({ object: true })
  trace?: Trace;

  // Union must be defined in alphabetical order, otherwise Mikro-ORM won't discovered the auto-created virtual polymorphic entity
  @Embedded({ object: true })
  requiredAction?: RequiredToolApprove | RequiredToolInput | RequiredToolOutput;

  @Embedded({ object: true })
  toolApprovals?: ToolApproval[];

  // Union must be defined in alphabetical order, otherwise Mikro-ORM won't discovered the auto-created virtual polymorphic entity
  @Embedded({ object: true })
  tools!: (CodeInterpreterUsage | FileSearchUsage | FunctionUsage | SystemUsage | UserUsage)[];

  @Property()
  instructions?: string;

  @Property()
  additionalInstructions?: string;

  @Property()
  expiresAt: Date;

  @Property()
  startedAt?: Date;

  @Property()
  cancelledAt?: Date;

  @Property()
  failedAt?: Date;

  @Property()
  completedAt?: Date;

  @Property()
  model!: string;

  @Property()
  topP?: number;

  @Property()
  temperature?: number;

  constructor({
    thread,
    assistant,
    tools,
    model,
    topP,
    temperature,
    toolApprovals,
    instructions,
    additionalInstructions,
    ...rest
  }: RunInput) {
    super(rest);
    this.thread = thread;
    this.assistant = assistant;
    this.tools = tools;
    this.model = model;
    this.topP = topP;
    this.temperature = temperature;
    this.toolApprovals = toolApprovals;
    this.instructions = instructions;
    this.additionalInstructions = additionalInstructions;

    this.expiresAt = dayjs(this.createdAt)
      .add(RUN_EXPIRATION_MILLISECONDS, 'milliseconds')
      .toDate();
  }

  private assertCurrentStatus(...statuses: RunStatus[]) {
    if (!statuses.includes(this.status))
      throw new Error(`Run state ${this.status} is not in ${statuses}`);
  }

  start() {
    this.assertCurrentStatus(RunStatus.QUEUED);
    this.status = RunStatus.IN_PROGRESS;
    this.startedAt = new Date();
  }

  startCancel() {
    this.status = RunStatus.CANCELLING;
  }

  cancel() {
    this.assertCurrentStatus(RunStatus.CANCELLING);
    this.status = RunStatus.CANCELLED;
    this.cancelledAt = new Date();
  }

  fail(error: APIError) {
    this.status = RunStatus.FAILED;
    this.failedAt = new Date();
    this.lastError = error;
  }

  expire() {
    this.assertCurrentStatus(
      RunStatus.QUEUED,
      RunStatus.IN_PROGRESS,
      RunStatus.REQUIRES_ACTION,
      RunStatus.CANCELLING
    );
    this.status = RunStatus.EXPIRED;
  }

  complete() {
    this.assertCurrentStatus(RunStatus.IN_PROGRESS);
    this.status = RunStatus.COMPLETED;
    this.completedAt = new Date();
  }

  requireAction(requiredActions: typeof this.requiredAction) {
    this.assertCurrentStatus(RunStatus.IN_PROGRESS);
    this.status = RunStatus.REQUIRES_ACTION;
    this.requiredAction = requiredActions;
  }

  submitAction() {
    this.assertCurrentStatus(RunStatus.REQUIRES_ACTION);
    this.status = RunStatus.IN_PROGRESS;
    this.requiredAction = undefined;
  }
}

export type RunInput = PrincipalScopedEntityInput &
  Pick<Run, 'thread' | 'assistant' | 'instructions' | 'additionalInstructions' | 'model'> & {
    tools: AnyToolUsage[];
  } & Partial<Pick<Run, 'toolApprovals'>> &
  Partial<Pick<Assistant, 'topP' | 'temperature'>>;
