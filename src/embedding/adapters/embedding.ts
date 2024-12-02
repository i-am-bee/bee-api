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
import { cosineSimilarityMatrix } from '@/embedding/utilts';

export type EmbeddingOptions = {
  signal?: AbortSignal;
};

export abstract class Embedding {
  constructor(public readonly model: string) {}

  async embed(text: string, options?: EmbeddingOptions): Promise<number[]> {
    const result = await this.embedMany([text], options);
    const embedding = result.at(0);
    if (!embedding) throw new Error('Missing embedding');
    return embedding;
  }

  abstract embedMany(texts: string[], options?: EmbeddingOptions): Promise<number[][]>;

  async similarity(
    { query, texts }: { query: string; texts: string[] },
    options?: EmbeddingOptions
  ): Promise<{ score: number }[]> {
    const [sourceEmbedding, ...textEmbeddings] = await this.embedMany([query, ...texts], options);
    const matrix = cosineSimilarityMatrix([sourceEmbedding], textEmbeddings);
    const similarities = matrix.at(0);
    if (!similarities) throw new Error('Missing similarities');
    return similarities.map((score) => ({ score }));
  }
}
