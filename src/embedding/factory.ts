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

import { Ollama } from 'ollama';
import OpenAI from 'openai';
import { Client as BAMClient } from '@ibm-generative-ai/node-sdk';
import { WatsonXLLM } from 'bee-agent-framework/adapters/watsonx/llm';

import { EmbeddingBackend } from './constants';
import { CaikitEmbedding } from './adapters/caikit/caikit-embedding';
import { GrpcEmbeddingModel } from './adapters/caikit/grpc/constants';
import { OllamaEmbedding } from './adapters/ollama-embedding';
import { OpenAIEmbedding } from './adapters/openai-embedding';
import { createEmbeddingsClient } from './adapters/caikit/grpc/client';
import { BAMEmbedding } from './adapters/bam-embedding';
import { WatsonXEmbedding } from './adapters/watsonx-embedding';

import {
  BAM_API_KEY,
  EMBEDDING_BACKEND,
  OLLAMA_URL,
  OPENAI_API_KEY,
  WATSONX_API_KEY,
  WATSONX_PROJECT_ID,
  WATSONX_REGION
} from '@/config';

export function getDefaultEmbeddingModel(backend: EmbeddingBackend = EMBEDDING_BACKEND) {
  switch (backend) {
    case EmbeddingBackend.CAIKIT:
      return GrpcEmbeddingModel.BGE_LARGE_EN_V_1_5;
    case EmbeddingBackend.OLLAMA:
      return 'nomic-embed-text';
    case EmbeddingBackend.OPENAI:
      return 'text-embedding-3-large';
    case EmbeddingBackend.BAM:
      return 'baai/bge-large-en-v1.5';
    case EmbeddingBackend.WATSONX:
      return 'ibm/slate-30m-english-rtrvr-v2';
  }
}

let ollamaClient: Ollama | null;
let openAIClient: OpenAI | null;
let bamClient: BAMClient | null;

export async function createEmbeddingAdapter(
  model: string = getDefaultEmbeddingModel(),
  backend: EmbeddingBackend = EMBEDDING_BACKEND
) {
  switch (backend) {
    case EmbeddingBackend.CAIKIT: {
      const caikitClient = await createEmbeddingsClient(model); // caikit clients are managed
      return new CaikitEmbedding(model, caikitClient);
    }
    case EmbeddingBackend.OLLAMA:
      ollamaClient ??= new Ollama({ host: OLLAMA_URL ?? undefined });
      return new OllamaEmbedding(model, ollamaClient);
    case EmbeddingBackend.OPENAI:
      openAIClient ??= new OpenAI({ apiKey: OPENAI_API_KEY ?? undefined });
      return new OpenAIEmbedding(model, openAIClient);
    case EmbeddingBackend.BAM:
      bamClient ??= new BAMClient({ apiKey: BAM_API_KEY ?? undefined });
      return new BAMEmbedding(model, bamClient);
    case EmbeddingBackend.WATSONX: {
      if (!WATSONX_API_KEY) throw new Error('Missing WATSONX_API_KEY');
      if (!WATSONX_PROJECT_ID) throw new Error('Missing WATSONX_PROJECT_ID');
      // Framework doesn't expose factory for WatsonX fetcher, therefore we grab it via LLM
      const llm = new WatsonXLLM({
        modelId: 'foobar',
        apiKey: WATSONX_API_KEY,
        projectId: WATSONX_PROJECT_ID,
        region: WATSONX_REGION ?? undefined
      });
      // @ts-expect-error use protected property
      const client = llm.client;
      return new WatsonXEmbedding(model, WATSONX_PROJECT_ID, client);
    }
  }
}
