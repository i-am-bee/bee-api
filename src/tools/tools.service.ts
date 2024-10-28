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

import { Loaded, ref } from '@mikro-orm/core';
import { CustomTool, CustomToolCreateError } from 'bee-agent-framework/tools/custom';
import dayjs from 'dayjs';
import mime from 'mime/lite';
import { WikipediaTool } from 'bee-agent-framework/tools/search/wikipedia';
import { Tool as FrameworkTool } from 'bee-agent-framework/tools/base';
import { ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { drop, dropWhile, groupBy, isDefined, pipe, prop, sortBy, take, takeWhile } from 'remeda';
import { OpenMeteoTool } from 'bee-agent-framework/tools/weather/openMeteo';
import { ArXivTool } from 'bee-agent-framework/tools/arxiv';
import { PythonTool } from 'bee-agent-framework/tools/python/python';
import { parse } from 'yaml';

import { Tool as ToolDto } from './dtos/tool.js';
import { AnyTool, Tool, ToolExecutor, ToolType } from './entities/tool/tool.entity.js';
import { ToolReadParams, ToolReadResponse } from './dtos/tool-read.js';
import { ToolsListQuery, ToolsListResponse } from './dtos/tools-list.js';
import { ToolCreateBody, ToolCreateResponse } from './dtos/tool-create.js';
import { ToolUpdateBody, ToolUpdateParams, ToolUpdateResponse } from './dtos/tool-update.js';
import { ToolDeleteParams, ToolDeleteResponse } from './dtos/tool-delete.js';
import { ToolCall } from './dtos/tool-call.js';
import { AnyToolCall } from './entities/tool-calls/tool-call.entity.js';
import { ToolCallDelta } from './dtos/tool-call-delta.js';
import { CodeInterpreterUsage } from './entities/tool-usages/code-interpreter-usage.entity.js';
import { FileSearchUsage } from './entities/tool-usages/file-search-usage.entity.js';
import { FunctionUsage } from './entities/tool-usages/function-usage.entity.js';
import { UserUsage } from './entities/tool-usages/user-usage.entity.js';
import { ToolUsage } from './dtos/tools-usage.js';
import { AnyToolUsage } from './entities/tool-usages/tool-usage.entity.js';
import { SystemUsage } from './entities/tool-usages/system-usage.entity.js';
import { AnyToolResource } from './entities/tool-resources/tool-resource.entity.js';
import { ToolResources } from './dtos/tool-resources.js';
import { CodeInterpreterResource } from './entities/tool-resources/code-interpreter-resource.entity.js';
import { SystemTools } from './entities/tool-calls/system-call.entity.js';
import { CodeInterpreterTool } from './entities/tool/code-interpreter-tool.entity.js';
import { ApiTool } from './entities/tool/api-tool.entity.js';
import { FunctionTool } from './entities/tool/function-tool.entity.js';
import { UserResource } from './entities/tool-resources/user-resource.entity.js';
import { SystemResource } from './entities/tool-resources/system-resource.entity.js';

import { ORM } from '@/database.js';
import { APIError, APIErrorCode } from '@/errors/error.entity.js';
import { BEE_CODE_INTERPRETER_URL } from '@/config.js';
import { createDeleteResponse } from '@/utils/delete.js';
import { File, FilePurpose } from '@/files/entities/file.entity.js';
import { FileContainer } from '@/files/entities/files-container.entity.js';
import { FileSearchResource } from '@/tools/entities/tool-resources/file-search-resources.entity.js';
import { VectorStore } from '@/vector-stores/entities/vector-store.entity.js';
import { VECTOR_STORE_DEFAULT_MAX_NUM_RESULTS } from '@/vector-stores/constants.js';
import { FileSearchTool } from '@/runs/execution/tools/file-search-tool.js';
import { getUpdatedValue } from '@/utils/update.js';
import { createPythonStorage } from '@/runs/execution/tools/python-tool-storage.js';
import encrypt from '@/utils/crypto/encrypt.js';
import { createCodeInterpreterConnectionOptions } from '@/runs/execution/tools/helpers.js';
import { ReadFileTool } from '@/runs/execution/tools/read-file-tool.js';
import { snakeToCamel } from '@/utils/strings.js';
import { createSearchTool } from '@/runs/execution/tools/search-tool';

type SystemTool = Pick<FrameworkTool, 'description' | 'name' | 'inputSchema'> & {
  type: ToolType;
  id: string;
  createdAt: Date;
  isExternal: boolean;
  userDescription?: string;
  metadata?: any;
};

export function toToolCallDto(toolCall: Loaded<AnyToolCall, 'fileContainers.file'>): ToolCall {
  switch (toolCall.type) {
    case ToolType.CODE_INTERPRETER:
      return {
        id: toolCall.id,
        type: ToolType.CODE_INTERPRETER,
        [ToolType.CODE_INTERPRETER]: {
          input: toolCall.input,
          outputs: [
            ...(toolCall.logs?.map((log) => ({ type: 'logs', logs: log }) as const) ?? []),
            ...(toolCall.fileContainers
              ?.map((container) => container as Loaded<FileContainer, 'file'>)
              .map(({ file }) => {
                if (mime.getType(file.$.filename)?.startsWith('image')) {
                  return { type: 'image', image: { file_id: file.id } } as const;
                } else {
                  return { type: 'resource', resource: { file_id: file.id } } as const;
                }
              }) ?? [])
          ]
        }
      };
    case ToolType.FILE_SEARCH:
      return {
        id: toolCall.id,
        type: ToolType.FILE_SEARCH,
        [ToolType.FILE_SEARCH]: {
          input: toolCall.input,
          output: toolCall.results
        }
      };
    case ToolType.FUNCTION:
      return {
        id: toolCall.id,
        type: ToolType.FUNCTION,
        [ToolType.FUNCTION]: {
          name: toolCall.name,
          arguments: toolCall.arguments,
          output: toolCall.output ?? null
        }
      };
    case ToolType.USER:
      return {
        id: toolCall.id,
        type: ToolType.USER,
        [ToolType.USER]: {
          tool: {
            id: toolCall.tool.id
          },
          arguments: toolCall.arguments ?? null,
          output: toolCall.output ?? null
        }
      };
    case ToolType.SYSTEM:
      return {
        id: toolCall.id,
        type: ToolType.SYSTEM,
        [ToolType.SYSTEM]: {
          id: toolCall.toolId,
          input: toolCall.input,
          output: toolCall.output
        }
      };
  }
}

export function toToolCallDeltaDto(
  toolCall: Loaded<AnyToolCall, 'fileContainers.file'>,
  index: number
): ToolCallDelta {
  switch (toolCall.type) {
    case ToolType.CODE_INTERPRETER: {
      const logs =
        toolCall.logs?.map((log, index) => ({ index, type: 'logs', logs: log }) as const) ?? [];
      const outputs =
        toolCall.fileContainers
          ?.map((container) => container as Loaded<FileContainer, 'file'>)
          .map(({ file }, index) => {
            if (mime.getType(file.$.filename)?.startsWith('image')) {
              return {
                index: index + logs.length,
                type: 'image',
                image: { file_id: file.id }
              } as const;
            } else {
              return {
                index: index + logs.length,
                type: 'resource',
                resource: { file_id: file.id }
              } as const;
            }
          }) ?? [];
      return {
        index,
        id: toolCall.id,
        type: ToolType.CODE_INTERPRETER,
        [ToolType.CODE_INTERPRETER]: {
          input: toolCall.input,
          outputs: [...logs, ...outputs]
        }
      };
    }
    case ToolType.FILE_SEARCH:
      return { index, id: toolCall.id, type: ToolType.FILE_SEARCH };
    case ToolType.FUNCTION:
      return {
        index,
        id: toolCall.id,
        type: ToolType.FUNCTION,
        [ToolType.FUNCTION]: {
          name: toolCall.name,
          arguments: toolCall.arguments,
          output: toolCall.output ?? null
        }
      };
    case ToolType.SYSTEM:
      return {
        index,
        id: toolCall.id,
        type: ToolType.SYSTEM,
        [ToolType.SYSTEM]: {
          id: toolCall.toolId,
          input: toolCall.input,
          output: toolCall.output
        }
      };
    case ToolType.USER:
      return {
        index,
        id: toolCall.id,
        type: ToolType.USER,
        [ToolType.USER]: {
          tool: {
            id: toolCall.tool.id
          },
          arguments: toolCall.arguments ?? null,
          output: toolCall.output ?? null
        }
      };
  }
}

export function toDto(tool: AnyTool | SystemTool): ToolDto {
  if (tool instanceof Tool) {
    return {
      id: tool.id,
      object: 'tool',
      type: tool.type,
      name: tool.name,
      is_external: true,
      created_at: dayjs(tool.createdAt).unix(),
      user_description: tool.userDescription ?? null,
      metadata: tool.metadata ?? {},
      source_code: tool.executor === ToolExecutor.CODE_INTERPRETER ? tool.sourceCode : null,
      json_schema:
        tool.executor === ToolExecutor.CODE_INTERPRETER
          ? JSON.stringify(tool.jsonSchema)
          : tool.executor === ToolExecutor.FUNCTION
            ? JSON.stringify(tool.parameters)
            : null,
      open_api_schema: tool.executor === ToolExecutor.API ? tool.openApiSchema : null,
      description: tool.description
    };
  } else {
    return {
      id: tool.id,
      object: 'tool',
      type: tool.type,
      name: tool.name,
      is_external: tool.isExternal,
      created_at: dayjs(tool.createdAt).unix(),
      user_description: tool.userDescription ?? null,
      metadata: tool.metadata,
      json_schema: JSON.stringify(
        '_def' in tool.inputSchema()
          ? zodToJsonSchema(tool.inputSchema() as ZodTypeAny)
          : tool.inputSchema()
      ),
      source_code: '',
      description: tool.description,
      open_api_schema: null
    };
  }
}

export function toToolUsageDto(toolUsage: AnyToolUsage): ToolUsage {
  switch (toolUsage.type) {
    case ToolType.CODE_INTERPRETER:
      return {
        type: ToolType.CODE_INTERPRETER
      };
    case ToolType.FILE_SEARCH:
      return {
        type: ToolType.FILE_SEARCH,
        file_search: { max_num_results: toolUsage.maxNumResults }
      };
    case ToolType.FUNCTION:
      return {
        type: ToolType.FUNCTION,
        function: {
          name: toolUsage.name,
          description: toolUsage.description,
          parameters: (toolUsage.parameters as any) ?? null
        }
      };
    case ToolType.SYSTEM:
      return {
        type: ToolType.SYSTEM,
        [ToolType.SYSTEM]: {
          id: toolUsage.toolId
        }
      };
    case ToolType.USER:
      return {
        type: ToolType.USER,
        [ToolType.USER]: {
          tool: {
            id: toolUsage.tool.id
          }
        }
      };
  }
}

export function createToolUsage(toolUsage: ToolUsage): AnyToolUsage {
  switch (toolUsage.type) {
    case ToolType.CODE_INTERPRETER:
      return new CodeInterpreterUsage();
    case ToolType.FILE_SEARCH:
      return new FileSearchUsage({
        maxNumResults:
          toolUsage.file_search?.max_num_results ?? VECTOR_STORE_DEFAULT_MAX_NUM_RESULTS
      });
    case ToolType.FUNCTION:
      return new FunctionUsage(toolUsage.function);
    case ToolType.SYSTEM:
      return new SystemUsage({
        toolId: toolUsage.system.id,
        config: toolUsage.system[toolUsage.system.id]
      });
    case ToolType.USER:
      return new UserUsage({
        tool: ORM.em.getRepository(Tool).getReference(toolUsage.user.tool.id, { wrapped: true })
      });
  }
}

export function toToolResourcesDto(toolResources?: AnyToolResource[]): ToolResources {
  if (!toolResources) return null;

  const resources: ToolResources = {};

  const codeInterpreterResources = toolResources.filter(
    (resource): resource is CodeInterpreterResource => resource.type === ToolType.CODE_INTERPRETER
  );
  if (codeInterpreterResources) {
    resources[ToolType.CODE_INTERPRETER] = {
      file_ids: codeInterpreterResources.flatMap((resource) =>
        resource.fileContainers.map((file) => file.file.id)
      )
    };
  }

  const userResources = toolResources.filter(
    (resource): resource is UserResource => resource.type === ToolType.USER
  );
  if (userResources) {
    Object.entries(groupBy(userResources, (r) => r.tool.id)).map(([toolId, toolResources]) => {
      resources[toolId] = {
        file_ids: toolResources.flatMap((resource) =>
          resource.fileContainers.map((file) => file.file.id)
        )
      };
    });
  }

  const systemResources = toolResources.filter(
    (resource): resource is SystemResource => resource.type === ToolType.SYSTEM
  );
  if (systemResources) {
    Object.entries(groupBy(systemResources, (r) => r.toolId)).map(([toolId, toolResources]) => {
      resources[toolId] = {
        file_ids: toolResources.flatMap((resource) =>
          resource.fileContainers.map((file) => file.file.id)
        )
      };
    });
  }

  const fileSearchResources = toolResources.filter(
    (resource): resource is FileSearchResource => resource.type === ToolType.FILE_SEARCH
  );
  if (fileSearchResources) {
    resources[ToolType.FILE_SEARCH] = {
      vector_store_ids: fileSearchResources.flatMap((resource) =>
        resource.vectorStoreContainers.map((container) => container.vectorStore.id)
      )
    };
  }

  return resources;
}

export async function createToolResources(
  toolResources: ToolResources | undefined
): Promise<AnyToolResource[] | undefined> {
  if (!toolResources) return;

  const resources: AnyToolResource[] = [];
  if (toolResources.code_interpreter) {
    const files = await ORM.em.getRepository(File).find({
      id: { $in: toolResources.code_interpreter.file_ids },
      purpose: { $in: [FilePurpose.ASSISTANTS, FilePurpose.ASSISTANTS_OUTPUT] }
    });
    if (files.length !== toolResources.code_interpreter.file_ids.length)
      throw new APIError({
        message: 'Not all files exist or have the right purpose',
        code: APIErrorCode.INVALID_INPUT
      });
    resources.push(new CodeInterpreterResource({ files }));
  }
  await Promise.all(
    Object.entries(toolResources)
      .filter(([resource]) => resource !== 'code_interpreter' && resource !== 'file_search')
      .map(async ([toolId, resource]) => {
        const fileIds: string[] = (resource as any).file_ids;
        const files = await ORM.em.getRepository(File).find({
          id: { $in: fileIds },
          purpose: { $in: [FilePurpose.ASSISTANTS, FilePurpose.ASSISTANTS_OUTPUT] }
        });
        if (files.length !== fileIds.length)
          throw new APIError({
            message: 'Not all files exist or have the right purpose',
            code: APIErrorCode.INVALID_INPUT
          });
        if (!Object.keys(SystemTools).includes(toolId.toUpperCase())) {
          const userTool = await ORM.em.getRepository(Tool).findOne({ id: toolId });
          if (!userTool) {
            throw new APIError({
              message: 'Tool not found',
              code: APIErrorCode.INVALID_INPUT
            });
          }
          resources.push(new UserResource({ tool: ref(userTool), files }));
        } else {
          resources.push(new SystemResource({ toolId, files }));
        }
      })
  );
  if (toolResources.file_search) {
    const vectorStores = await ORM.em.getRepository(VectorStore).find({
      id: { $in: toolResources.file_search.vector_store_ids }
    });
    if (vectorStores.length !== toolResources.file_search.vector_store_ids?.length)
      throw new APIError({
        message: 'Not all vector stores exist',
        code: APIErrorCode.INVALID_INPUT
      });
    if (vectorStores.some((vectorStore) => vectorStore.expired)) {
      throw new APIError({
        message: 'Some of the vector stores are expired',
        code: APIErrorCode.INVALID_INPUT
      });
    }
    resources.push(new FileSearchResource({ vectorStores }));
  }
  return resources;
}

function getSystemTools() {
  const arXivTool = new ArXivTool();
  const searchTool = createSearchTool();
  const wikipediaTool = new WikipediaTool();
  const weatherTool = new OpenMeteoTool();
  const pythonTool = new PythonTool({
    codeInterpreter: { url: BEE_CODE_INTERPRETER_URL ?? '' },
    storage: createPythonStorage([], null)
  });
  const fileSearch = new FileSearchTool({ vectorStores: [], maxNumResults: 0 });
  const readFile = new ReadFileTool({ files: [], fileSize: 0 });

  const systemTools = new Map<string, SystemTool>();

  systemTools.set(SystemTools.WEB_SEARCH, {
    type: ToolType.SYSTEM,
    id: SystemTools.WEB_SEARCH,
    createdAt: new Date('2024-07-24'),
    ...searchTool,
    inputSchema: searchTool.inputSchema,
    isExternal: true,
    metadata: {
      $ui_description_short: 'Retrieve real-time search results from across the internet'
    },
    userDescription:
      "Retrieve real-time search results from across the internet, including news, current events, or content from specific websites or domains. Leverages Google's indexing and search algorithms to provide relevant results, rather than functioning as a web scraper."
  });
  systemTools.set(SystemTools.WIKIPEDIA, {
    type: ToolType.SYSTEM,
    id: SystemTools.WIKIPEDIA,
    createdAt: new Date('2024-07-24'),
    ...wikipediaTool,
    inputSchema: wikipediaTool.inputSchema,
    isExternal: true,
    metadata: {
      $ui_description_short:
        'Retrieve detailed information from [Wikipedia.org](https://wikipedia.org) on a wide range of topics'
    },
    userDescription:
      'Retrieve detailed information from [Wikipedia.org](https://wikipedia.org) on a wide range of topics, including famous individuals, locations, organizations, and historical events. Ideal for obtaining comprehensive overviews or specific details on well-documented subjects. May not be suitable for lesser-known or more recent topics. The information is subject to community edits which can be inaccurate.'
  });
  systemTools.set(SystemTools.WEATHER, {
    type: ToolType.SYSTEM,
    id: SystemTools.WEATHER,
    createdAt: new Date('2024-07-25'),
    ...weatherTool,
    inputSchema: weatherTool.inputSchema,
    isExternal: true,
    metadata: {
      $ui_description_short:
        'Get real-time weather forecasts for up to 16 days and past data for 30 days'
    },
    userDescription:
      'Retrieve real-time weather forecasts including detailed information on temperature, wind speed, and precipitation. Access forecasts predicting weather up to 16 days in the future and archived forecasts for weather up to 30 days in the past. Ideal for obtaining up-to-date weather predictions and recent historical weather trends.'
  });
  systemTools.set(SystemTools.ARXIV, {
    type: ToolType.SYSTEM,
    id: SystemTools.ARXIV,
    createdAt: new Date('2024-07-25'),
    ...arXivTool,
    inputSchema: arXivTool.inputSchema,
    isExternal: true,
    metadata: {
      $ui_description_short:
        'Retrieve abstracts of research articles published on [ArXiv.org](https://arxiv.org), along with their titles, authors, publication dates, and categories'
    },
    userDescription:
      'Retrieve abstracts of research articles published on [ArXiv.org](https://arxiv.org), along with their titles, authors, publication dates, and categories. Ideal for retrieving high-level information about academic papers. The full text of articles is not provided, making it unsuitable for full-text searches or advanced analytics.'
  });
  systemTools.set('read_file', {
    type: ToolType.SYSTEM,
    id: 'read_file',
    createdAt: new Date('2024-10-02'),
    ...readFile,
    inputSchema: readFile.inputSchema,
    isExternal: false,
    metadata: {
      $ui_description_short: 'Read and interpret basic files'
    },
    userDescription:
      'Read and interpret basic files to deliver summaries, highlight key points, and facilitate file comprehension. Ideal for straightforward tasks requiring access to raw data without any processing. Text (.txt, .md, .html) and JSON files (application/json) are supported up to 5 MB. PDF (.pdf) and text-based image files (.jpg, .jpeg, .png, .tiff, .bmp, .gif) are supported by the WDU text extraction service, limited to the content window of our base model, Llama 3.1 70B, which is 5 MB. The WDU text extraction service is used to extract text from image and PDF files, while text file types are handled by the LLM directly.'
  });
  systemTools.set('function', {
    type: ToolType.FUNCTION,
    id: 'function',
    createdAt: new Date('2024-07-31'),
    description: 'Function to be executed by the user with parameters supplied by the assistant',
    name: 'Function',
    inputSchema: () => ({}),
    isExternal: false
  });
  systemTools.set('file_search', {
    type: ToolType.FILE_SEARCH,
    id: 'file_search',
    createdAt: new Date('2024-07-31'),
    ...fileSearch,
    inputSchema: fileSearch.inputSchema,
    isExternal: false,
    metadata: {
      $ui_description_short: 'Access and interpret file content by using advanced search techniques'
    },
    userDescription:
      'Read and interpret larger or more complex files using advanced search techniques where contextual understanding is required. Content parsing and chunking is used to break down large volumes of data into manageable pieces for effective analysis. Embeddings (numerical representations that capture the meaning and context of content) enable both traditional keyword and vector search. Vector search enhances the ability to identify similar content based on meaning, even if the exact words differ, improving the chances of identifying relevant information. Text (.txt, .md, .html) and JSON files (application/json) are supported up to 100 MB. PDF (.pdf) and text-based image files (.jpg, .jpeg, .png, .tiff, .bmp, .gif) are supported by the WDU text extraction service.'
  });
  systemTools.set('code_interpreter', {
    type: ToolType.CODE_INTERPRETER,
    id: 'code_interpreter',
    createdAt: new Date('2024-07-01'),
    ...pythonTool,
    inputSchema: pythonTool.inputSchema,
    isExternal: true,
    metadata: {
      $ui_description_short:
        'Execute Python code for various tasks, including data analysis, file processing, and visualizations'
    },
    userDescription:
      'Execute Python code for various tasks, including data analysis, file processing, and visualizations. Supports the installation of any library such as NumPy, Pandas, SciPy, and Matplotlib. Users can create new files or convert existing files, which are then made available for download.'
  });

  return systemTools;
}

export async function listTools({
  limit,
  after,
  before,
  order,
  order_by,
  type,
  search
}: ToolsListQuery): Promise<ToolsListResponse> {
  const allSystemTools = getSystemTools();

  const systemTools: (SystemTool | undefined)[] =
    !type || type.includes(ToolType.SYSTEM)
      ? [
          allSystemTools.get(SystemTools.WEB_SEARCH),
          allSystemTools.get(SystemTools.WIKIPEDIA),
          allSystemTools.get(SystemTools.WEATHER),
          allSystemTools.get(SystemTools.ARXIV),
          allSystemTools.get('read_file')
        ]
      : [];

  if (!type || type.includes(ToolType.FUNCTION)) {
    systemTools.push(allSystemTools.get('function'));
  }

  if (!type || type.includes(ToolType.FILE_SEARCH)) {
    systemTools.push(allSystemTools.get('file_search'));
  }
  if (BEE_CODE_INTERPRETER_URL && (!type || type.includes(ToolType.CODE_INTERPRETER))) {
    systemTools.push(allSystemTools.get(ToolType.CODE_INTERPRETER));
  }

  const userTools =
    !type || type.includes(ToolType.USER) ? await ORM.em.getRepository(Tool).find({}) : [];
  const tools = [...systemTools.filter(isDefined), ...userTools].filter((tool) => {
    if (search) {
      const regexp = new RegExp(`.*${search}.*`, 'gi');
      return regexp.test(tool.name) || regexp.test(tool.description);
    }
    return true;
  });

  const sortedTools = sortBy<any>(
    tools,
    [(data: Tool) => prop(data, snakeToCamel(order_by)).toString().toLowerCase(), order],
    [prop('createdAt'), order],
    [prop('id'), order]
  );

  const trimmedTools = pipe(
    sortedTools,
    dropWhile((tool) => (after ? tool.id !== after : false)),
    drop(after ? 1 : 0),
    takeWhile((tool) => (before ? tool.id !== before : true)),
    take(limit)
  );

  return {
    data: trimmedTools.map(toDto),
    first_id: trimmedTools.at(0)?.id ?? null,
    last_id: trimmedTools.at(-1)?.id ?? null,
    has_more: trimmedTools.length > 0 && sortedTools.at(-1)?.id !== trimmedTools.at(-1)?.id,
    total_count: sortedTools.length
  };
}

async function createCodeInterpreterTool(
  body: Extract<ToolCreateBody, { source_code: string }>
): Promise<ToolCreateResponse> {
  if (!BEE_CODE_INTERPRETER_URL) {
    throw new APIError({
      message: `Code interpreter url is not defined`,
      code: APIErrorCode.SERVICE_UNAVAILABLE
    });
  }
  try {
    const customTool = await CustomTool.fromSourceCode(
      createCodeInterpreterConnectionOptions(),
      body.source_code
    );

    const tool = new CodeInterpreterTool({
      name: body.name || customTool.name,
      sourceCode: body.source_code,
      jsonSchema: customTool.inputSchema(),
      description: customTool.description,
      metadata: body.metadata,
      userDescription: body.user_description
    });

    await ORM.em.persistAndFlush(tool);

    return toDto(tool);
  } catch (err) {
    if (err instanceof CustomToolCreateError) {
      throw new APIError({
        message: err.message,
        code: APIErrorCode.INVALID_INPUT
      });
    }
    if (err.constructor.name === 'ConnectError') {
      throw new APIError({
        message: 'Service is unavailable',
        code: APIErrorCode.INTERNAL_SERVER_ERROR
      });
    }
    throw err;
  }
}

async function createOpenApiTool(
  body: Extract<ToolCreateBody, { open_api_schema: string }>
): Promise<ToolCreateResponse> {
  const schema = parse(body.open_api_schema);
  const tool = new ApiTool({
    openApiSchema: body.open_api_schema,
    name: schema.info.title,
    description: schema.info.description,
    apiKey: body.api_key ? encrypt(body.api_key) : undefined,
    metadata: body.metadata,
    userDescription: body.user_description
  });

  await ORM.em.persistAndFlush(tool);

  return toDto(tool);
}

async function createFunctionTool(
  body: Extract<ToolCreateBody, { parameters?: any }>
): Promise<ToolCreateResponse> {
  const tool = new FunctionTool({
    name: body.name,
    description: body.description ?? '',
    parameters: body.parameters,
    metadata: body.metadata,
    userDescription: body.user_description
  });

  await ORM.em.persistAndFlush(tool);

  return toDto(tool);
}

export async function createTool(body: ToolCreateBody): Promise<ToolCreateResponse> {
  if ('source_code' in body) {
    return createCodeInterpreterTool(body);
  } else if ('open_api_schema' in body) {
    return createOpenApiTool(body);
  } else if ('parameters' in body) {
    return createFunctionTool(body);
  }
  throw new APIError({
    message: `Unsupported tools`,
    code: APIErrorCode.INVALID_INPUT
  });
}

export async function updateTool({
  tool_id,
  ...body
}: ToolUpdateBody & ToolUpdateParams): Promise<ToolUpdateResponse> {
  const tool = await ORM.em.getRepository<AnyTool>(Tool).findOneOrFail({ id: tool_id });

  tool.name = getUpdatedValue(body.name, tool.name);
  tool.description = getUpdatedValue(body.description, tool.description);
  tool.metadata = getUpdatedValue(body.metadata, tool.metadata);
  tool.userDescription = getUpdatedValue(body.user_description, tool.userDescription);

  if ('source_code' in body) {
    if (!('sourceCode' in tool)) {
      throw new APIError({
        message: 'Can not change tool executor',
        code: APIErrorCode.INVALID_INPUT
      });
    }

    if (body.source_code) {
      try {
        if (!BEE_CODE_INTERPRETER_URL) {
          throw new APIError({
            message: `Code interpreter url is not defined`,
            code: APIErrorCode.SERVICE_UNAVAILABLE
          });
        }
        tool.sourceCode = body.source_code;
        const newCustomTool = await CustomTool.fromSourceCode(
          createCodeInterpreterConnectionOptions(),
          body.source_code
        );
        tool.jsonSchema = newCustomTool.inputSchema();
        tool.description = newCustomTool.description;
      } catch (err) {
        if (err instanceof CustomToolCreateError) {
          throw new APIError({
            message: err.message,
            code: APIErrorCode.INVALID_INPUT
          });
        }
        throw err;
      }
    }
  }

  if ('open_api_schema' in body) {
    if (!('openApiSchema' in tool)) {
      throw new APIError({
        message: 'Can not change tool executor',
        code: APIErrorCode.INVALID_INPUT
      });
    }
    tool.openApiSchema = getUpdatedValue(body.open_api_schema, tool.openApiSchema);
  }

  if ('parameters' in body) {
    if (!('parameters' in tool)) {
      throw new APIError({
        message: 'Can not change tool executor',
        code: APIErrorCode.INVALID_INPUT
      });
    }
    tool.parameters = getUpdatedValue(body.parameters, tool.parameters);
  }

  await ORM.em.flush();

  return toDto(tool);
}

export async function readTool({ tool_id }: ToolReadParams): Promise<ToolReadResponse> {
  const systemTool = getSystemTools().get(tool_id);
  if (systemTool) {
    return toDto(systemTool);
  }
  const tool = await ORM.em.getRepository<AnyTool>(Tool).findOneOrFail({ id: tool_id });
  return toDto(tool);
}

export async function deleteTool({ tool_id }: ToolDeleteParams): Promise<ToolDeleteResponse> {
  const tool = await ORM.em.getRepository(Tool).findOneOrFail({ id: tool_id });

  tool.delete();
  await ORM.em.flush();

  return createDeleteResponse(tool_id, 'tool');
}
