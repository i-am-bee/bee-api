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

import { FilterQuery, Loaded } from '@mikro-orm/core';
import dayjs from 'dayjs';

import {
  AssistantUpdateBody,
  AssistantUpdateParams,
  AssistantUpdateResponse
} from './dtos/assistant-update.js';
import { AssistantsListQuery, AssistantsListResponse } from './dtos/assistants-list.js';
import { Assistant } from './assistant.entity.js';
import { AssistantReadParams, AssistantReadResponse } from './dtos/assistant-read.js';
import type { Assistant as AssistantDto } from './dtos/assistant.js';
import { AssistantCreateBody, AssistantCreateResponse } from './dtos/assistant-create.js';
import { AssistantDeleteParams, AssistantDeleteResponse } from './dtos/assistant-delete.js';

import { ORM } from '@/database.js';
import { createPaginatedResponse, getListCursor } from '@/utils/pagination.js';
import {
  createToolResources,
  createToolUsage,
  toToolResourcesDto,
  toToolUsageDto
} from '@/tools/tools.service.js';
import { APIError, APIErrorCode } from '@/errors/error.entity.js';
import { Tool, ToolType } from '@/tools/entities/tool/tool.entity.js';
import { getUpdatedValue } from '@/utils/update.js';
import { createDeleteResponse } from '@/utils/delete.js';
import { Agent } from '@/runs/execution/constants.js';
import { defaultAIProvider } from '@/runs/execution/provider';

export function toDto(assistant: Loaded<Assistant>): AssistantDto {
  return {
    id: assistant.id,
    object: 'assistant',
    tools: assistant.tools.map(toToolUsageDto) ?? [],
    tool_resources: toToolResourcesDto(assistant.toolResources),
    instructions: assistant.instructions ?? null,
    name: assistant.name ?? null,
    description: assistant.description ?? null,
    metadata: assistant.metadata ?? {},
    created_at: dayjs(assistant.createdAt).unix(),
    model: assistant.model,
    agent: assistant.agent,
    top_p: assistant.topP,
    temperature: assistant.temperature,
    system_prompt: assistant.systemPromptOverwrite
  };
}

export async function createAssistant({
  tools: toolsParam,
  tool_resources,
  instructions,
  name,
  description,
  metadata,
  top_p,
  model,
  agent,
  temperature,
  system_prompt_overwrite
}: AssistantCreateBody): Promise<AssistantCreateResponse> {
  if (agent === Agent.STREAMLIT) {
    if (toolsParam.length !== 0)
      throw new APIError({
        code: APIErrorCode.INVALID_INPUT,
        message: 'Tools are currently not supported by Streamlit agent'
      });
    if (tool_resources)
      throw new APIError({
        code: APIErrorCode.INVALID_INPUT,
        message: 'Tool resouces are currently not supported by Streamlit agent'
      });
  }

  const customToolIds = toolsParam.flatMap((toolUsage) =>
    toolUsage.type === ToolType.USER ? toolUsage.user.tool.id : []
  );
  const tools =
    customToolIds.length > 0
      ? await ORM.em.getRepository(Tool).find({
          id: { $in: customToolIds }
        })
      : [];

  if (tools.length !== customToolIds.length) {
    throw new APIError({
      message: 'Some tool not found',
      code: APIErrorCode.INVALID_INPUT
    });
  }

  const assistant = new Assistant({
    tools: toolsParam.map(createToolUsage),
    toolResources: await createToolResources(tool_resources),
    instructions: instructions ?? undefined,
    name: name ?? undefined,
    description: description ?? undefined,
    metadata: metadata ?? undefined,
    topP: top_p ?? undefined,
    model: model ?? defaultAIProvider.createAssistantBackend().modelId,
    agent,
    temperature: temperature ?? undefined,
    systemPromptOverwrite: system_prompt_overwrite ?? undefined
  });
  await ORM.em.persistAndFlush(assistant);
  return toDto(assistant);
}

export async function readAssistant({
  assistant_id
}: AssistantReadParams): Promise<AssistantReadResponse> {
  const assistant = await ORM.em.getRepository(Assistant).findOneOrFail({
    id: assistant_id
  });
  return toDto(assistant);
}

export async function updateAssistant({
  assistant_id,
  name,
  description,
  metadata,
  instructions,
  tools,
  tool_resources,
  temperature,
  top_p,
  model,
  system_prompt_overwrite
}: AssistantUpdateParams & AssistantUpdateBody): Promise<AssistantUpdateResponse> {
  const assistant = await ORM.em.getRepository(Assistant).findOneOrFail({
    id: assistant_id
  });

  if (assistant.agent === Agent.STREAMLIT) {
    if (tools && tools.length !== 0)
      throw new APIError({
        code: APIErrorCode.INVALID_INPUT,
        message: 'Tools are currently not supported by Streamlit agent'
      });
    if (tool_resources)
      throw new APIError({
        code: APIErrorCode.INVALID_INPUT,
        message: 'Tool resouces are currently not supported by Streamlit agent'
      });
  }

  assistant.name = getUpdatedValue(name, assistant.name);
  assistant.description = getUpdatedValue(description, assistant.description);
  assistant.instructions = getUpdatedValue(instructions, assistant.instructions);
  assistant.systemPromptOverwrite = getUpdatedValue(
    system_prompt_overwrite,
    assistant.systemPromptOverwrite
  );
  assistant.tools = getUpdatedValue(tools?.map(createToolUsage), assistant.tools);
  assistant.toolResources = getUpdatedValue(
    await createToolResources(tool_resources),
    assistant.toolResources
  );
  assistant.metadata = getUpdatedValue(metadata, assistant.metadata);
  assistant.topP = getUpdatedValue(top_p, assistant.topP);
  assistant.model = getUpdatedValue(model, assistant.model);
  assistant.temperature = getUpdatedValue(temperature, assistant.temperature);
  await ORM.em.flush();
  return toDto(assistant);
}

export async function listAssistants({
  limit,
  after,
  before,
  order,
  order_by,
  agent,
  search
}: AssistantsListQuery): Promise<AssistantsListResponse> {
  const where: FilterQuery<Assistant> = {};

  if (agent) {
    where.agent = agent;
  }

  if (search) {
    const regexp = new RegExp(search, 'i');
    where.$or = [{ description: regexp }, { name: regexp }];
  }

  const repo = ORM.em.getRepository(Assistant);
  const cursor = await getListCursor<Assistant>(
    where,
    { limit, order, order_by, after, before },
    repo
  );
  return createPaginatedResponse(cursor, toDto);
}

export async function deleteAssistant({
  assistant_id
}: AssistantDeleteParams): Promise<AssistantDeleteResponse> {
  const assistant = await ORM.em.getRepository(Assistant).findOneOrFail({ id: assistant_id });

  assistant.delete();
  await ORM.em.flush();

  return createDeleteResponse(assistant_id, 'assistant');
}
