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
  ToolError
} from 'bee-agent-framework/tools/base';
import { z } from 'zod';
import { hasAtLeast } from 'remeda';

import { getExtractedFileObject } from '@/files/files.service.js';
import { File } from '@/files/entities/file.entity.js';

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

  protected async _run({ filename }: ToolInput<ReadFileTool>): Promise<StringToolOutput> {
    const file = this.options.files.find((file) => file.filename === filename);
    if (!file) {
      throw new ToolError(`File ${filename} not found.`);
    }
    try {
      const fileObject = await getExtractedFileObject(file);
      if ((fileObject.ContentLength ?? 0) > this.options.fileSize) {
        throw new ToolError(
          `The file is too big (${fileObject.ContentLength} bytes). Maximum allowed size is ${this.options.fileSize} bytes`,
          [],
          {
            isFatal: false,
            isRetryable: true
          }
        );
      }

      return new StringToolOutput('file content: \n' + fileObject.Body?.toString());
    } catch {
      throw new ToolError('This file is not a text file and can not be read.', [], {
        isFatal: false,
        isRetryable: true
      });
    }
  }
}
