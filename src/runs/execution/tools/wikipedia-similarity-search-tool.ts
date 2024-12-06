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
import { ToolEmitter, Tool, ToolInput } from 'bee-agent-framework/tools/base';
import { WikipediaTool } from 'bee-agent-framework/tools/search/wikipedia';
import {
  SimilarityTool,
  SimilarityToolOptions,
  SimilarityToolOutput
} from 'bee-agent-framework/tools/similarity';
import { splitString } from 'bee-agent-framework/internals/helpers/string';
import { Emitter } from 'bee-agent-framework/emitter/emitter';

import { createEmbeddingAdapter } from '@/embedding/factory';

const MAX_CONTENT_LENGTH_CHARS = 25_000;

// Estimate from OpenAI: https://help.openai.com/en/articles/4936856-what-are-tokens-and-how-to-count-them
const CHARS_PER_TOKEN_AVG = 4;

export class WikipediaSimilaritySearchTool extends Tool<SimilarityToolOutput> {
  name: WikipediaTool['name'];
  description: WikipediaTool['description'];

  wikipediaTool: WikipediaTool;
  similarityTool: SimilarityTool<unknown>;

  readonly emitter: ToolEmitter<ToolInput<this>, SimilarityToolOutput> = Emitter.root.child({
    namespace: ['tool', 'search', 'wikipediaSimilarity'],
    creator: this
  });

  static {
    this.register();
  }

  inputSchema() {
    return z.object({
      page: this.wikipediaTool.inputSchema().shape.query,
      question: z.string({
        description: `The question you are trying to answer using the page, for example 'What is the population of New York?'`
      })
    });
  }

  async similarityProvider({
    query,
    documents
  }: Parameters<SimilarityToolOptions['provider']>[0]): ReturnType<
    SimilarityToolOptions['provider']
  > {
    const embeddingAdapter = await createEmbeddingAdapter();
    const scores = await embeddingAdapter.similarity(
      {
        query,
        texts: documents.map((document) => document.text)
      },
      { signal: AbortSignal.timeout(60_000) }
    );
    return scores;
  }

  public constructor() {
    super();

    this.wikipediaTool = new WikipediaTool({
      search: { limit: 3 },
      filters: { minPageNameSimilarity: 0.25, excludeOthersOnExactMatch: false },
      extraction: { fields: { markdown: {} } },
      output: { maxSerializedLength: MAX_CONTENT_LENGTH_CHARS }
    });
    this.similarityTool = new SimilarityTool({ provider: this.similarityProvider, maxResults: 5 });

    this.name = this.wikipediaTool.name;
    this.description = this.wikipediaTool.description;
  }

  protected async _run({ page, question }: ToolInput<this>) {
    const wikipediaResult = await this.wikipediaTool.run({ query: page });

    const documents = wikipediaResult.results
      .map(({ fields: { markdown }, ...rest }) => {
        const text = markdown as string;
        return {
          text:
            text.length > MAX_CONTENT_LENGTH_CHARS ? text.slice(0, MAX_CONTENT_LENGTH_CHARS) : text,
          ...rest
        };
      })
      .flatMap((document, idx) =>
        [...splitString(document.text, { size: 400 * CHARS_PER_TOKEN_AVG, overlap: 100 })].map(
          (text) => ({
            searchResultIndex: idx,
            ...document,
            text
          })
        )
      );

    return await this.similarityTool.run({ query: question, documents });
  }
}
