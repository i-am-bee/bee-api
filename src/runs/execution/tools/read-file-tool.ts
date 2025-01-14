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
  ToolInput,
  StringToolOutput,
  Tool,
  ToolError,
  BaseToolRunOptions,
  ToolEmitter
} from 'bee-agent-framework/tools/base';
import { z } from 'zod';
import { hasAtLeast } from 'remeda';
import { GetRunContext } from 'bee-agent-framework/context';
import { Emitter } from 'bee-agent-framework/emitter/emitter';

import { File } from '@/files/entities/file.entity.js';
import { getExtractedText } from '@/files/extraction/helpers';
import { getJobLogger } from '@/logger';

export interface ReadFileToolOptions extends BaseToolOptions {
  fileSize: number;
  files: File[];
}

export class ReadFileTool extends Tool<StringToolOutput, ReadFileToolOptions> {
  name = `ReadFile`;
  description = 'Retrieve file content.';
  inputSchema() {
    const fileNames = this.options.files.map((file) => z.literal(file.filename));

    return z.object({
      filename: hasAtLeast(fileNames, 2)
        ? z.union(fileNames).describe('Name of the file to read.')
        : hasAtLeast(fileNames, 1)
          ? fileNames[0].describe(`Name of the file to read`)
          : z.literal('non_existing_file').describe('No files available.')
    });
  }

  readonly emitter: ToolEmitter<ToolInput<this>, StringToolOutput> = Emitter.root.child({
    namespace: ['tool', 'file', 'read'],
    creator: this
  });

  protected async _run(
    { filename }: ToolInput<ReadFileTool>,
    _: Partial<BaseToolRunOptions>,
    run: GetRunContext<typeof this>
  ): Promise<StringToolOutput> {
    const file = this.options.files.find((file) => file.filename === filename);
    if (!file) {
      throw new ToolError(`File ${filename} not found.`);
    }
    let text: string;
    try {
      text = await getExtractedText(file, run.signal);
    } catch (err) {
      getJobLogger('runs').warn({ err }, 'Failed to get extracted text.');

      throw new ToolError('Unable to read text from the file.', [], {
        isFatal: false,
        isRetryable: true
      });
    }
    if (text.length > this.options.fileSize) {
      throw new ToolError(
        `The text is too big (${text.length} characters). Maximum allowed size is ${this.options.fileSize} characters`,
        [],
        {
          isFatal: false,
          isRetryable: true
        }
      );
    }

    return new StringToolOutput('file content: \n' + text);
  }
}
