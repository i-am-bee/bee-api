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
  BeforeCreate,
  BeforeDelete,
  BeforeUpdate,
  Entity,
  EventArgs,
  Filter,
  ManyToOne,
  Property,
  ref,
  Ref
} from '@mikro-orm/core';
import { ChatLLMOutput } from 'bee-agent-framework/llms/chat';
import { requestContext } from '@fastify/request-context';

import { ChatMessageRole } from '../constants';

import { inJob, inSeeder } from '@/context';
import { Artifact } from '@/artifacts/entities/artifact.entity';
import { ProjectPrincipal } from '@/administration/entities/project-principal.entity';
import { BaseEntity, BaseEntityInput } from '@/common/base.entity';

@Entity()
@Filter({
  name: 'ChatAccess',
  cond: async () => {
    throw new Error('Not Implemented');
  },
  default: true
})
export class Chat extends BaseEntity {
  getIdPrefix(): string {
    return 'chatcmpl';
  }

  @Property()
  model!: string;

  @Property()
  messages?: { role: ChatMessageRole; content: string }[];

  @Property()
  responseFormat?: any;

  @Property()
  output?: ChatLLMOutput;

  @Property()
  error?: string;

  @ManyToOne()
  artifact?: Ref<Artifact>;

  @ManyToOne()
  projectPrincipal?: Ref<ProjectPrincipal>;

  constructor({ model, messages, responseFormat, ...rest }: ChatInput) {
    super(rest);

    this.model = model;
    this.responseFormat = responseFormat;
    this.messages = messages;

    const artifact = requestContext.get('artifact');
    if (artifact) {
      this.artifact = ref(artifact);
    }
    const projectPrincipal = requestContext.get('projectPrincipal');
    if (projectPrincipal) {
      this.projectPrincipal = ref(projectPrincipal);
    }
  }

  @BeforeCreate()
  @BeforeUpdate()
  @BeforeDelete()
  async authorize(_: EventArgs<any>) {
    if (inJob() || inSeeder()) return;
    const projectPrincipal = requestContext.get('projectPrincipal');
    const artifact = requestContext.get('artifact');
    if (
      (projectPrincipal && this.projectPrincipal === ref(projectPrincipal)) ||
      (artifact && this.artifact === ref(artifact))
    ) {
      return;
    }
    throw new Error('Unauthorized');
  }
}

export type ChatInput = BaseEntityInput &
  Pick<Chat, 'model' | 'messages'> &
  Partial<Pick<Chat, 'responseFormat'>>;
