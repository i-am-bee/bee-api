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

import { z } from 'zod';

import { MilvusVectorStore } from './vector_db/adapters/milvus.js';
import { VectorDbDocumentSchema } from './vector_db/types.js';
import { VectorStoreClient } from './vector_db/adapters/interface.js';

import { defaultAIProvider } from '@/runs/execution/provider';

export const DocumentSchema = VectorDbDocumentSchema.extend({});
export type Document = z.infer<typeof DocumentSchema>;
export type DocumentType = z.ZodType<Document>;

export function getVectorStoreClient(): VectorStoreClient<DocumentType> {
  return new MilvusVectorStore({
    modelName: defaultAIProvider.createEmbeddingBackend().modelId,
    documentSchema: DocumentSchema
  });
}
