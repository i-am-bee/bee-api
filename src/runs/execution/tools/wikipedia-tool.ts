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
import { AnyTool } from 'bee-agent-framework/tools/base';
import { WikipediaTool } from 'bee-agent-framework/tools/search/wikipedia';
import { SimilarityTool } from 'bee-agent-framework/tools/similarity';
import { splitString } from 'bee-agent-framework/internals/helpers/string';
import * as R from 'remeda';
import { cosineSimilarityMatrix } from 'bee-agent-framework/internals/helpers/math';

import { defaultAIProvider } from '@/runs/execution/provider';

const MAX_CONTENT_LENGTH_CHARS = 25_000;

// Estimate from OpenAI: https://help.openai.com/en/articles/4936856-what-are-tokens-and-how-to-count-them
const CHARS_PER_TOKEN_AVG = 4;

// Creates a wikipedia tool that supports information retrieval
export function wikipediaTool(
  passageSizeTokens = 400,
  overlapTokens = 100,
  maxResults = 5
): AnyTool {
  // LLM to perform text embedding
  const embeddingLLM = defaultAIProvider.createEmbeddingBackend();

  // Similarity tool to calculate the similarity between a query and a set of wikipedia passages
  const similarity = new SimilarityTool({
    maxResults,
    provider: async (input): Promise<{ score: number }[]> => {
      const embeds = await embeddingLLM.embed([
        input.query,
        ...input.documents.map((doc) => doc.text)
      ]);
      const similarities = cosineSimilarityMatrix(
        [embeds.embeddings[0]], // Query
        embeds.embeddings.slice(1) // Documents
      )[0];
      if (!similarities) {
        throw new Error('Missing similarities');
      }
      return similarities.map((score) => ({ score }));
    }
  });

  const wikipedia = new WikipediaTool({
    filters: { minPageNameSimilarity: 0.25, excludeOthersOnExactMatch: false },
    output: { maxSerializedLength: MAX_CONTENT_LENGTH_CHARS }
  });
  // The wikipedia tool is extended to support chunking and similarity calculations
  return wikipedia
    .extend(
      z.object({
        page: z
          .string({ description: `Name of the wikipedia page, for example 'New York'` })
          .min(1)
          .max(128),
        question: z.string({
          description: `The question you are trying to answer using the page, for example 'What is the population of New York?'`
        })
      }),
      (newInput) => ({ query: newInput.page })
    )
    .pipe(similarity, (input, output) => ({
      query: input.question,
      documents: output.results.flatMap((document, idx) =>
        Array.from(
          splitString(document.fields.markdown ?? '', {
            size: passageSizeTokens * CHARS_PER_TOKEN_AVG,
            overlap: overlapTokens * CHARS_PER_TOKEN_AVG
          })
        ).map((chunk) => ({
          searchResultIndex: idx,
          ...R.omit(document, ['fields']),
          text: chunk
        }))
      )
    }));
}
