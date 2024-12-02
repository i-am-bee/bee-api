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

import { Embeddable, Property } from '@mikro-orm/core';

import { Extraction } from './extraction.entity';

import { ExtractionBackend } from '@/files/extraction/constants';

@Embeddable({ discriminatorValue: ExtractionBackend.DOCLING })
export class DoclingExtraction extends Extraction {
  backend = ExtractionBackend.DOCLING;

  @Property()
  documentStorageId?: string;

  @Property()
  textStorageId?: string;

  @Property()
  chunksStorageId?: string;

  constructor({
    documentStorageId,
    textStorageId,
    chunksStorageId,
    ...rest
  }: DoclingExtractionInput) {
    super(rest);
    this.documentStorageId = documentStorageId;
    this.textStorageId = textStorageId;
    this.chunksStorageId = chunksStorageId;
  }
}

export type DoclingExtractionInput = Pick<
  DoclingExtraction,
  'jobId' | 'documentStorageId' | 'textStorageId' | 'chunksStorageId'
>;
