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

import { Loaded, ref, Ref } from '@mikro-orm/core';
import { BeeSystemPrompt } from 'bee-agent-framework/agents/bee/prompts';
import { unique } from 'remeda';
import { PromptTemplate } from 'bee-agent-framework/template';
import { GraniteBeeSystemPrompt } from 'bee-agent-framework/agents/granite/prompts';
import { ZodType } from 'zod';
import { GraniteBeeAgent } from 'bee-agent-framework/agents/granite/agent';
import { TokenMemory } from 'bee-agent-framework/memory/tokenMemory';
import { BeeAgent } from 'bee-agent-framework/agents/bee/agent';
import { AnyTool } from 'bee-agent-framework/tools/base';

import { Run } from '../entities/run.entity.js';

import { ORM } from '@/database.js';
import { File } from '@/files/entities/file.entity.js';
import { FileSearchResource } from '@/tools/entities/tool-resources/file-search-resources.entity.js';
import { Assistant } from '@/assistants/assistant.entity.js';
import { Thread } from '@/threads/thread.entity.js';
import { VectorStoreContainer } from '@/vector-stores/entities/vector-store-container.entity.js';
import { AnyToolResource } from '@/tools/entities/tool-resources/tool-resource.entity.js';
import { Tool, ToolType } from '@/tools/entities/tool/tool.entity.js';
import { CodeInterpreterResource } from '@/tools/entities/tool-resources/code-interpreter-resource.entity.js';
import { FileContainer } from '@/files/entities/files-container.entity.js';
import { VectorStore } from '@/vector-stores/entities/vector-store.entity.js';
import { UserResource } from '@/tools/entities/tool-resources/user-resource.entity.js';
import { SystemResource } from '@/tools/entities/tool-resources/system-resource.entity.js';
import { createChatLLM } from '@/runs/execution/factory';

export function getRunVectorStores(
  assistant: Loaded<Assistant, 'toolResources.vectorStoreContainers.vectorStore'>,
  thread: Loaded<Thread, 'toolResources.vectorStoreContainers.vectorStore'>
): Loaded<VectorStore>[] {
  const vectorStores = [...(assistant.toolResources ?? []), ...(thread.toolResources ?? [])]
    .filter((resource): resource is FileSearchResource => resource.type === ToolType.FILE_SEARCH)
    .flatMap(
      (resource) => resource.vectorStoreContainers as Loaded<VectorStoreContainer, 'vectorStore'>[]
    )
    .flatMap((container) => container.vectorStore.$);
  return unique(vectorStores); // filter out duplicates
}

export function createAgent(run: Loaded<Run, 'assistant'>, tools: AnyTool[]) {
  const llm = createChatLLM(run);
  if (run.model.includes('granite')) {
    return new GraniteBeeAgent({
      llm,
      memory: new TokenMemory({ llm }),
      tools,
      templates: { system: getPromptTemplate(run, GraniteBeeSystemPrompt) }
    });
  } else {
    return new BeeAgent({
      llm,
      memory: new TokenMemory({ llm }),
      tools,
      templates: { system: getPromptTemplate(run, BeeSystemPrompt) }
    });
  }
}

function getPromptTemplate<T extends ZodType>(
  run: Loaded<Run, 'assistant'>,
  promptTemplate: PromptTemplate<T>
): PromptTemplate<T> {
  const instructions = run.additionalInstructions
    ? `${run.instructions} ${run.additionalInstructions}`
    : run.instructions;
  return promptTemplate.fork((input) => ({
    ...input,
    ...(run.assistant.$.systemPromptOverwrite
      ? { template: run.assistant.$.systemPromptOverwrite }
      : {}),
    defaults: {
      ...input.defaults,
      ...(instructions ? { instructions } : {})
    }
  }));
}

export async function checkFileExistsOnToolResource(
  toolResource: AnyToolResource,
  file: Ref<File>
): Promise<boolean> {
  switch (toolResource.type) {
    case ToolType.USER:
    case ToolType.CODE_INTERPRETER:
      return !!toolResource.fileContainers.find((fc) => fc.file.id === file.id);
    case ToolType.FILE_SEARCH: {
      const vectorStoreContainers = await ORM.em
        .getRepository(VectorStoreContainer)
        .populate(toolResource.vectorStoreContainers, ['vectorStore.files']);

      return !!vectorStoreContainers
        .flatMap((vsc) => vsc.vectorStore)
        .flatMap((vs) => vs.$.files.getItems())
        .find((f) => f.file.id === file.id);
    }
    default:
      return true;
  }
}

export function addFileToToolResource(toolResource: AnyToolResource, file: Ref<File>) {
  switch (toolResource.type) {
    case ToolType.CODE_INTERPRETER:
    case ToolType.USER:
    case ToolType.SYSTEM:
      toolResource.fileContainers.push(new FileContainer({ file }));
      break;
    case ToolType.FILE_SEARCH:
      throw new Error('Not implemented');
    default:
      return undefined;
  }
}

export async function createToolResource(type: ToolType, files: Ref<File>[], toolId?: string) {
  switch (type) {
    case ToolType.CODE_INTERPRETER:
      return new CodeInterpreterResource({ files });
    case ToolType.SYSTEM:
      if (!toolId) throw new Error('Missing tool id');
      return new SystemResource({ toolId, files });
    case ToolType.USER:
      if (!toolId) throw new Error('Missing tool id');
      return new UserResource({ tool: ref(Tool, toolId), files });
    case ToolType.FILE_SEARCH:
      throw new Error('Not implemented');
    default:
      return undefined;
  }
}
