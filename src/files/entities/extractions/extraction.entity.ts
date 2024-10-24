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

import { UnstructuredOpensourceExtraction } from './unstructured-opensource-extraction.entity';
import { WDUExtraction } from './wdu-extraction.entity';
import { UnstructuredAPIExtraction } from './unstructured-api-extraction.entity';

import { ExtractionBackend } from '@/files/extraction/constants';

@Embeddable({ abstract: true, discriminatorColumn: 'backend' })
export class Extraction {
  @Property()
  jobId?: string;

  @Enum(() => ExtractionBackend)
  backend!: ExtractionBackend;

  constructor(input: ExtractionInput) {
    this.jobId = input.jobId;
  }
}

export type ExtractionInput = Pick<Extraction, 'jobId'>;

export type AnyExtraction =
  | UnstructuredAPIExtraction
  | UnstructuredOpensourceExtraction
  | WDUExtraction;
