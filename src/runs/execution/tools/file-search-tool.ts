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

import {
  BaseToolOptions,
  BaseToolRunOptions,
  CustomToolEmitter,
  Tool,
  ToolInput,
  ToolOutput
} from 'bee-agent-framework/tools/base';
import { z } from 'zod';
import { isTruthy } from 'remeda';
import { Loaded } from '@mikro-orm/core';
import { GetRunContext } from 'bee-agent-framework/context';
import { Emitter } from 'bee-agent-framework/emitter/emitter';

import { getVectorStoreClient } from '@/vector-store-files/execution/client.js';
import { VectorStore } from '@/vector-stores/entities/vector-store.entity.js';
import { createEmbeddingAdapter } from '@/embedding/factory';

export interface FileSearchToolOptions extends BaseToolOptions {
  vectorStores: Loaded<VectorStore>[];
  maxNumResults: number;
}

export interface FileSearchToolResult {
  content: string;
  source?: string;
}
export class FileSearchToolOutput extends ToolOutput {
  constructor(public readonly results: FileSearchToolResult[]) {
    super();
  }

  get sources() {
    return this.results.map((result) => result.source).filter(isTruthy);
  }

  isEmpty() {
    return this.results.length === 0;
  }

  getTextContent(): string {
    return JSON.stringify(this.results);
  }

  createSnapshot() {
    return { results: this.results };
  }

  loadSnapshot(snapshot: ReturnType<this['createSnapshot']>): void {
    Object.assign(this, snapshot);
  }
}

export class FileSearchTool extends Tool<FileSearchToolOutput, FileSearchToolOptions> {
  static {
    this.register();
  }

  maxNumResults: number;
  name: string;
  description: string;
  inputSchema() {
    return z.object({
      query: z.string({ description: 'Question to answer using file search.' }).min(1).max(128)
    });
  }
  vectorStores: Loaded<VectorStore>[];

  readonly emitter: CustomToolEmitter<ToolInput<this>, FileSearchToolOutput> = Emitter.root.child({
    namespace: ['tool', 'file', 'search'],
    creator: this
  });

  async _run(
    { query }: ToolInput<FileSearchTool>,
    _options: Partial<BaseToolRunOptions>,
    run: GetRunContext<typeof this>
  ): Promise<FileSearchToolOutput> {
    const vectorStoreClient = getVectorStoreClient();

    const embeddingAdapter = await createEmbeddingAdapter();

    const embedding = await embeddingAdapter.embed(query, { signal: run.signal });
    if (!embedding) throw new Error('Missing embedding data in embedding response');

    if (this.vectorStores.some((vectorStore) => vectorStore.expired)) {
      throw new Error('Some of the vector stores are expired');
    }

    const vectorStoreFileIds = (
      await Promise.all(this.vectorStores.map((store) => store.completedFiles.loadItems()))
    )
      .flatMap((vectorStoreFiles) => vectorStoreFiles)
      .map((vectorStore) => vectorStore.id);

    const documents = await vectorStoreClient.similaritySearchVectorWithScore(
      embedding,
      this.maxNumResults,
      vectorStoreFileIds
    );

    return new FileSearchToolOutput(
      documents.map((d) => ({
        content: d.document.text,
        source: d.document.source?.url ?? d.document.source?.file?.name
      }))
    );
  }

  constructor(config: FileSearchToolOptions) {
    super(config);
    this.name = `FileSearch`;
    this.maxNumResults = config.maxNumResults;
    this.vectorStores = config.vectorStores;
    this.description =
      `Worker that searches results from content of files. ` +
      `Use to find out single fact about the content. Input must be a short specific query.`;
  }
}
