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

import { Entity, Enum, Index, ManyToOne, Property, Ref } from '@mikro-orm/core';

import { Thread } from '@/threads/thread.entity.js';
import {
  PrincipalScopedEntity,
  PrincipalScopedEntityInput
} from '@/common/principal-scoped.entity.js';
import { Message } from '@/messages/message.entity';

export const ArtifactType = {
  APP: 'app'
} as const;
export type ArtifactType = (typeof ArtifactType)[keyof typeof ArtifactType];

@Entity({ abstract: true, discriminatorColumn: 'type' })
export abstract class Artifact extends PrincipalScopedEntity {
  getIdPrefix(): string {
    return 'art';
  }

  @Enum(() => ArtifactType)
  type!: ArtifactType;

  @Index()
  @ManyToOne()
  thread?: Ref<Thread>;

  @ManyToOne()
  message?: Ref<Message>;

  @Index()
  @Property()
  accessSecret?: string;

  @Property()
  name: string;

  @Property()
  description?: string;

  constructor({ thread, message, name, description, ...rest }: ArtifactInput) {
    super(rest);
    this.thread = thread;
    this.message = message;
    this.name = name;
    this.description = description;
  }
}

export type ArtifactInput = PrincipalScopedEntityInput &
  Pick<Artifact, 'thread' | 'message' | 'name'> &
  Partial<Pick<Artifact, 'accessSecret' | 'description'>>;
