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

import { Attachment } from './attachment.entity.js';

import { Thread } from '@/threads/thread.entity.js';
import { Run } from '@/runs/entities/run.entity.js';
import {
  PrincipalScopedEntity,
  PrincipalScopedEntityInput
} from '@/common/principal-scoped.entity.js';

export const MessageRole = {
  USER: 'user',
  ASSISTANT: 'assistant',
  TOOL_CALL: 'tool_call'
} as const;
export type MessageRole = (typeof MessageRole)[keyof typeof MessageRole];

export const MessageStatus = {
  IN_PROGRESS: 'in_progress',
  INCOMPLETE: 'incomplete',
  COMPLETED: 'completed'
} as const;
export type MessageStatus = (typeof MessageStatus)[keyof typeof MessageStatus];

@Entity()
export class Message extends PrincipalScopedEntity {
  getIdPrefix(): string {
    return 'msg';
  }

  @Index()
  @ManyToOne()
  thread: Ref<Thread>;

  @ManyToOne()
  run?: Ref<Run>; // Run that created the message, applies to assistant messages generated on the server

  @Enum(() => MessageRole)
  role: MessageRole;

  @Property()
  content: string;

  @Enum(() => MessageStatus)
  status: MessageStatus;

  @Property()
  order: number; // secondary ordering after createdAt

  @Embedded({ object: true })
  attachments?: Attachment[];

  constructor({ thread, run, role, content, order, status, attachments, ...rest }: MessageInput) {
    super(rest);
    this.thread = thread;
    this.run = run;
    this.role = role;
    this.content = content;
    this.order = order ?? 0;
    this.status = status ?? MessageStatus.COMPLETED;
    this.attachments = attachments;
  }
}

export type MessageInput = PrincipalScopedEntityInput &
  Pick<Message, 'thread' | 'run' | 'role' | 'content' | 'attachments'> &
  Partial<Pick<Message, 'order' | 'status'>>;
