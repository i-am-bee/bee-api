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

import { AutoChunkingStrategy } from './chunking-strategy/auto-chunking.strategy.entity';
import { StaticChunkingStrategy } from './chunking-strategy/static-chunking-strategy.entity';

import { ProjectScopedEntity, ProjectScopedEntityInput } from '@/common/project-scoped.entity';
import { VectorStore } from '@/vector-stores/entities/vector-store.entity.js';
import { File } from '@/files/entities/file.entity.js';
import { APIError } from '@/errors/error.entity.js';

export const VectorStoreFileStatus = {
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLING: 'cancelling',
  CANCELLED: 'cancelled'
} as const;

export type VectorStoreFileStatus =
  (typeof VectorStoreFileStatus)[keyof typeof VectorStoreFileStatus];

@Entity()
@Index({
  options: [
    { file: 1, vectorStore: 1 },
    { unique: true, partialFilterExpression: { deletedAt: { $in: [null] } } }
  ]
})
export class VectorStoreFile extends ProjectScopedEntity {
  getIdPrefix(): string {
    return 'vsf';
  }

  @Enum(() => VectorStoreFileStatus)
  status: VectorStoreFileStatus = VectorStoreFileStatus.IN_PROGRESS;

  @Embedded({ object: true })
  lastError?: APIError;

  @ManyToOne()
  vectorStore: Ref<VectorStore>;

  @Property()
  usageBytes: number = 0; // NOTE: We use this field for storing number of documents, not bytes

  @ManyToOne()
  file: Ref<File>;

  @Embedded({ object: true })
  chunkingStrategy: AutoChunkingStrategy | StaticChunkingStrategy;

  constructor({ file, vectorStore, chunkingStrategy, ...rest }: VectorStoreFileInput) {
    super(rest);
    this.file = file;
    this.vectorStore = vectorStore;
    this.chunkingStrategy = chunkingStrategy;
  }
}

export type VectorStoreFileInput = ProjectScopedEntityInput &
  Pick<VectorStoreFile, 'file' | 'chunkingStrategy' | 'vectorStore'>;
