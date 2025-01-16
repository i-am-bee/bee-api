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

import { LLMError } from 'bee-agent-framework/llms/base';

import { EmbeddingsCreateBody, EmbeddingsCreateResponse } from './dtos/embeddings-create';
import { Embeddings } from './entities/embeddings.entity';

import { ORM } from '@/database';
import { getServiceLogger } from '@/logger';
import { defaultAIProvider } from '@/runs/execution/provider';
import { APIError, APIErrorCode } from '@/errors/error.entity';

const getEmbeddingsLogger = () => getServiceLogger('embeddings');

export async function embeddings({
  model,
  input
}: EmbeddingsCreateBody): Promise<EmbeddingsCreateResponse> {
  const llm = defaultAIProvider.createEmbeddingBackend({ model });
  const embeddings = new Embeddings({
    model: llm.modelId,
    inputs: typeof input === 'string' ? [input] : input
  });
  await ORM.em.persistAndFlush(embeddings);
  try {
    const output = await llm.embed(embeddings.inputs);
    return {
      object: 'list',
      data: output.embeddings.map((embedding, index) => ({
        object: 'embedding',
        index,
        embedding
      }))
    };
  } catch (err) {
    getEmbeddingsLogger().error({ err }, 'Embeddings generation failed');
    embeddings.error = err.toString();
    if (err instanceof LLMError) {
      throw new APIError({ code: APIErrorCode.SERVICE_ERROR, message: err.message });
    }
    throw err;
  } finally {
    await ORM.em.flush();
  }
}
