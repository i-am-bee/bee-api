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

import { randomUUID } from 'node:crypto';

import { Embedded, Entity, Enum, Property } from '@mikro-orm/core';

import { DoclingExtraction } from './extractions/docling-extraction.entity.js';
import { UnstructuredOpensourceExtraction } from './extractions/unstructured-opensource-extraction.entity.js';
import { WDUExtraction } from './extractions/wdu-extraction.entity.js';
import { UnstructuredAPIExtraction } from './extractions/unstructured-api-extraction.entity.js';

import { ProjectScopedEntity, ProjectScopedEntityInput } from '@/common/project-scoped.entity.js';

export const FilePurpose = {
  ASSISTANTS: 'assistants',
  ASSISTANTS_OUTPUT: 'assistants_output'
} as const;
export type FilePurpose = (typeof FilePurpose)[keyof typeof FilePurpose];

@Entity()
export class File extends ProjectScopedEntity {
  getIdPrefix(): string {
    return 'file';
  }

  @Enum(() => FilePurpose)
  purpose!: FilePurpose;

  @Property()
  bytes!: number;

  @Property()
  filename!: string;

  @Property()
  contentHash!: string; // SHA256 hash of the file content

  @Property()
  mimeType?: string;

  @Property()
  storageId: string;

  @Embedded({ object: true })
  extraction?:
    | DoclingExtraction
    | UnstructuredAPIExtraction
    | UnstructuredOpensourceExtraction
    | WDUExtraction;

  constructor({
    purpose,
    bytes,
    filename,
    contentHash,
    storageId,
    mimeType,
    ...rest
  }: FilePurposeInput) {
    super(rest);

    this.purpose = purpose;
    this.bytes = bytes;
    this.filename = filename;
    this.contentHash = contentHash;
    this.storageId = storageId ?? randomUUID();
    this.mimeType = mimeType;
  }
}

export type FilePurposeInput = ProjectScopedEntityInput &
  Pick<File, 'purpose' | 'bytes' | 'filename' | 'contentHash' | 'mimeType'> &
  Partial<Pick<File, 'storageId'>>;
