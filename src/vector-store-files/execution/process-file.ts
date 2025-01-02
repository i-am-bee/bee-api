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

import { pipeline } from 'node:stream/promises';

import { Loaded } from '@mikro-orm/core';
import { AbortError } from 'bee-agent-framework/errors';
import { sumBy } from 'remeda';

import { getLogger } from '@/logger.js';
import {
  VectorStoreFile,
  VectorStoreFileStatus
} from '@/vector-store-files/entities/vector-store-file.entity.js';
import { ORM } from '@/database.js';
import { APIError } from '@/errors/error.entity.js';
import { getVectorStoreClient } from '@/vector-store-files/execution/client.js';
import { watchForCancellation } from '@/utils/jobs.js';
import { getExtractedChunks } from '@/files/extraction/helpers';
import { defaultAIProvider } from '@/runs/execution/provider';

const getJobLogger = (vectorStoreId: string, fileId?: string) =>
  getLogger().child({ vectorStoreId, fileId }, { msgPrefix: '[vector-store-process] ' });

const EMBEDDINGS_BATCH_SIZE = 1000;
const MAX_NUM_TOKENS = 3_000_000;

// Estimate from OpenAI: https://help.openai.com/en/articles/4936856-what-are-tokens-and-how-to-count-them
const CHARS_PER_TOKEN_AVG = 4;

export async function processVectorStoreFile(vectorStoreFile: Loaded<VectorStoreFile, 'file'>) {
  const controller = new AbortController();
  const unsub = watchForCancellation(VectorStoreFile, vectorStoreFile, () => controller.abort());
  const logger = getJobLogger(vectorStoreFile.vectorStore.id, vectorStoreFile.id);

  const totalDocumentStats = { totalDocuments: 0, byteUsage: 0 };

  async function* chunkTransform(source: AsyncIterable<string>) {
    let buffer: string[] = [];
    for await (const item of source) {
      // Check for abort (could be a separate processor, but the typing is too much effort)
      if (controller.signal.aborted) throw new AbortError('File processing aborted');

      buffer.push(item);
      if (buffer.length >= EMBEDDINGS_BATCH_SIZE) {
        yield buffer;
        buffer = [];
      }
    }
    if (buffer.length > 0) yield buffer;
  }

  async function* embedTransform(source: AsyncIterable<string[]>) {
    const embeddingAdapter = defaultAIProvider.createEmbeddingBackend();
    for await (const items of source) {
      const output = await embeddingAdapter.embed(items, { signal: controller.signal });
      yield output.embeddings.map((embedding, idx) => ({
        embedding: embedding,
        text: items[idx]
      }));
    }
  }

  async function storeSink(source: AsyncIterable<{ embedding: number[]; text: string }[]>) {
    for await (const documents of source) {
      const vectorStoreClient = getVectorStoreClient();
      const documentStats = await vectorStoreClient.addDocuments(
        documents.map(({ embedding, text }) => ({
          vector: embedding,
          text,
          vectorStoreFileId: vectorStoreFile.id,
          source: { file: { name: vectorStoreFile.file.$.filename, id: vectorStoreFile.file.id } }
        }))
      );
      totalDocumentStats.totalDocuments += documentStats.totalCreated;
      totalDocumentStats.byteUsage += documentStats.byteUsage;
      vectorStoreFile.usageBytes = totalDocumentStats.byteUsage;
      await ORM.em.flush();
    }
  }

  try {
    const chunks = await getExtractedChunks(vectorStoreFile.file.$);
    const maxTextLength = MAX_NUM_TOKENS * CHARS_PER_TOKEN_AVG;
    const maxContentLengthBytes = maxTextLength * 1.5; //~ 2 bytes per char in utf-8 + margin of error
    if ((sumBy(chunks, (chunk) => chunk.length) ?? Infinity) > maxContentLengthBytes) {
      throw Error('The file contains too much text'); // Skip downloading file
    }
    controller.signal.throwIfAborted();

    await pipeline(
      (async function* () {
        for (const chunk of chunks) yield chunk;
      })(),
      chunkTransform,
      embedTransform,
      storeSink
    );
    vectorStoreFile.status = VectorStoreFileStatus.COMPLETED;
  } catch (err) {
    getLogger().error({ err }, 'Vector store file processing failed');

    if (err instanceof AbortError) {
      vectorStoreFile.status = VectorStoreFileStatus.CANCELLED;
    } else {
      vectorStoreFile.status = VectorStoreFileStatus.FAILED;
      vectorStoreFile.lastError = APIError.from(err);
    }
    // Cleanup partially embedded file from vector-store
    try {
      await getVectorStoreClient().dropVectorStoreFiles([vectorStoreFile.id]);
      vectorStoreFile.usageBytes = 0;
    } catch (err) {
      logger.warn({ err }, 'Could not delete vector stores from vector db.');
    }
  } finally {
    await ORM.em.flush();
    unsub();
  }
  return totalDocumentStats;
}
