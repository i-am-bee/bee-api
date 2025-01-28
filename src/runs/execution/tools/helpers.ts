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
  AnyTool,
  BaseToolRunOptions,
  AnyTool as FrameworkTool,
  StringToolOutput,
  ToolError,
  ToolOutput
} from 'bee-agent-framework/tools/base';
import { setProp } from 'bee-agent-framework/internals/helpers/object';
import { PythonTool } from 'bee-agent-framework/tools/python/python';
import { PythonToolOutput } from 'bee-agent-framework/tools/python/output';
import { Loaded, ref } from '@mikro-orm/core';
import { CustomTool } from 'bee-agent-framework/tools/custom';
import { ArXivTool, ArXivToolOutput } from 'bee-agent-framework/tools/arxiv';
import { OpenMeteoTool } from 'bee-agent-framework/tools/weather/openMeteo';
import { SimilarityToolOutput } from 'bee-agent-framework/tools/similarity';
import { GoogleSearchTool } from 'bee-agent-framework/tools/search/googleSearch';
import { uniqueBy } from 'remeda';
import { z } from 'zod';
import { LLMChatTemplates } from 'bee-agent-framework/adapters/shared/llmChatTemplates';
import { DuckDuckGoSearchTool } from 'bee-agent-framework/tools/search/duckDuckGoSearch';
import { SearchToolOptions, SearchToolOutput } from 'bee-agent-framework/tools/search/base';
import { PromptTemplate } from 'bee-agent-framework/template';
import { CalculatorTool } from 'bee-agent-framework/tools/calculator';
import { LLMTool } from 'bee-agent-framework/tools/llm';

import { AgentContext } from '../execute.js';
import { getRunVectorStores } from '../helpers.js';
import {
  CodeInterpreterTool,
  CodeInterpreterTool as CodeInterpreterUserTool
} from '../../../tools/entities/tool/code-interpreter-tool.entity.js';
import { ApiTool as ApiCallUserTool } from '../../../tools/entities/tool/api-tool.entity.js';
import { RedisCache } from '../cache.js';

import { createPythonStorage } from './python-tool-storage.js';
import { FunctionTool, FunctionToolOutput } from './function.js';
import { FileSearchTool, FileSearchToolOutput } from './file-search-tool.js';
import { ApiCallTool } from './api-call-tool.js';
import { ReadFileTool } from './read-file-tool.js';

import { CodeInterpreterCall } from '@/tools/entities/tool-calls/code-interpreter-call.entity.js';
import { ORM } from '@/database.js';
import { getLogger } from '@/logger.js';
import { Tool, ToolExecutor, ToolType } from '@/tools/entities/tool/tool.entity.js';
import { CodeInterpreterUsage } from '@/tools/entities/tool-usages/code-interpreter-usage.entity.js';
import {
  BEE_CODE_INTERPRETER_CA_CERT,
  BEE_CODE_INTERPRETER_CERT,
  BEE_CODE_INTERPRETER_KEY,
  BEE_CODE_INTERPRETER_URL
} from '@/config.js';
import { FileContainer } from '@/files/entities/files-container.entity.js';
import { FunctionUsage } from '@/tools/entities/tool-usages/function-usage.entity.js';
import { FunctionCall } from '@/tools/entities/tool-calls/function-call.entity.js';
import { SystemCall, SystemTools } from '@/tools/entities/tool-calls/system-call.entity.js';
import { UserCall } from '@/tools/entities/tool-calls/user-call.entity.js';
import { SystemUsage } from '@/tools/entities/tool-usages/system-usage.entity.js';
import { UserUsage } from '@/tools/entities/tool-usages/user-usage.entity.js';
import { FileSearchUsage } from '@/tools/entities/tool-usages/file-search-usage.entity.js';
import { FileSearchCall } from '@/tools/entities/tool-calls/file-search-call.entity.js';
import { FunctionTool as FunctionUserTool } from '@/tools/entities/tool/function-tool.entity.js';
import { wikipediaTool } from '@/runs/execution/tools/wikipedia-tool';
import { LoadedRun } from '@/runs/execution/types.js';
import { CodeInterpreterResource } from '@/tools/entities/tool-resources/code-interpreter-resource.entity.js';
import { File } from '@/files/entities/file.entity.js';
import { Attachment } from '@/messages/attachment.entity.js';
import { SystemResource } from '@/tools/entities/tool-resources/system-resource.entity.js';
import { createSearchTool } from '@/runs/execution/tools/search-tool';
import { sharedRedisCacheClient, withRedisClient } from '@/redis.js';
import { defaultAIProvider } from '@/runs/execution/provider';
import { ToolSecret } from '@/tools/entities/tool-secret.entity.js';
import { createApproveChannel, createToolInputChannel, toRunDto } from '@/runs/runs.service.js';
import { RequiredToolInput } from '@/runs/entities/requiredToolInput.entity.js';
import { ToolApprovalType } from '@/runs/entities/toolApproval.entity.js';
import { RequiredToolApprove } from '@/runs/entities/requiredToolApprove.entity.js';
import decrypt from '@/utils/crypto/decrypt.js';

const searchCache: SearchToolOptions['cache'] = new RedisCache({
  client: sharedRedisCacheClient,
  keyPrefix: 'search:',
  ttlSeconds: 60 * 60
});

export function createCodeInterpreterConnectionOptions() {
  if (!BEE_CODE_INTERPRETER_URL) throw new Error('Missing code interpreter URL');
  return {
    url: BEE_CODE_INTERPRETER_URL,
    connectionOptions: {
      ...(BEE_CODE_INTERPRETER_CA_CERT ? { ca: BEE_CODE_INTERPRETER_CA_CERT } : {}),
      ...(BEE_CODE_INTERPRETER_CERT ? { cert: BEE_CODE_INTERPRETER_CERT } : {}),
      ...(BEE_CODE_INTERPRETER_KEY ? { key: BEE_CODE_INTERPRETER_KEY } : {})
    }
  } as const;
}

export async function getTools(run: LoadedRun, context: AgentContext): Promise<FrameworkTool[]> {
  const tools: FrameworkTool[] = [];

  const vectorStores = getRunVectorStores(run.assistant.$, run.thread.$);
  for (const vectorStore of vectorStores) {
    vectorStore.lastActiveAt = new Date(); // side effect
  }

  const fileSearchUsage = run.tools.find(
    (tool): tool is FileSearchUsage => tool.type === ToolType.FILE_SEARCH
  );
  if (fileSearchUsage) {
    if (vectorStores.length > 0) {
      tools.push(
        new FileSearchTool({ vectorStores, maxNumResults: fileSearchUsage.maxNumResults })
      );
    }
  }

  const webSearchUsage = run.tools.find(
    (tool): tool is SystemUsage =>
      tool.type === ToolType.SYSTEM && tool.toolId === SystemTools.WEB_SEARCH
  );
  if (webSearchUsage) {
    tools.push(createSearchTool({ cache: searchCache }));
  }

  const wikipediaUsage = run.tools.find(
    (tool): tool is SystemUsage =>
      tool.type === ToolType.SYSTEM && tool.toolId === SystemTools.WIKIPEDIA
  );
  if (wikipediaUsage) tools.push(wikipediaTool());

  const llmUsage = run.tools.find(
    (tool): tool is SystemUsage => tool.type === ToolType.SYSTEM && tool.toolId === SystemTools.LLM
  );
  if (llmUsage) {
    tools.push(new LLMTool({ llm: defaultAIProvider.createChatBackend() }));
  }

  const calculatorUsage = run.tools.find(
    (tool): tool is SystemUsage =>
      tool.type === ToolType.SYSTEM && tool.toolId === SystemTools.CALCULATOR
  );
  if (calculatorUsage) tools.push(new CalculatorTool());

  const weatherUsage = run.tools.find(
    (tool): tool is SystemUsage =>
      tool.type === ToolType.SYSTEM && tool.toolId === SystemTools.WEATHER
  );
  if (weatherUsage)
    tools.push(
      new OpenMeteoTool({
        retryOptions: {
          maxRetries: 3
        }
      })
    );

  const arxivUsage = run.tools.find(
    (tool): tool is SystemUsage =>
      tool.type === ToolType.SYSTEM && tool.toolId === SystemTools.ARXIV
  );
  if (arxivUsage) tools.push(new ArXivTool());

  const codeInterpreterUsage = run.tools.find(
    (tool): tool is CodeInterpreterUsage => tool.type === ToolType.CODE_INTERPRETER
  );
  const customUsages = run.tools.filter(
    (toolUsage): toolUsage is Loaded<UserUsage, 'tool'> => toolUsage.type === ToolType.USER
  );

  const executorId = `user-${run.createdBy.id}`;

  if (codeInterpreterUsage || customUsages.length > 0) {
    if (BEE_CODE_INTERPRETER_URL) {
      const codeInterpreter = createCodeInterpreterConnectionOptions();
      const files = [
        ...(run.assistant.$.toolResources ?? []),
        ...(run.thread.$.toolResources ?? [])
      ]
        .filter(
          (resource): resource is Loaded<CodeInterpreterResource> =>
            resource.type === ToolType.CODE_INTERPRETER
        )
        .flatMap((resource) => resource.fileContainers as Loaded<FileContainer, 'file'>[])
        .flatMap((container) => container.file.$);

      if (codeInterpreterUsage) {
        const codeLLM = defaultAIProvider.createCodeBackend();
        tools.push(
          new PythonTool({
            codeInterpreter,
            storage: createPythonStorage(files, run),
            preprocess: codeLLM
              ? {
                  llm: codeLLM,
                  promptTemplate: new PromptTemplate({
                    schema: z.object({ input: z.string() }),
                    template: LLMChatTemplates.get('llama3.1').template.render({
                      messages: [
                        {
                          system: [
                            `Your task is to fix the provided code that may or may not contain a syntax error.\nIMPORTANT: the output must NOT contain any additional comments or explanation, and must NOT be wrapped in a markdown code block.`
                          ],
                          user: [],
                          assistant: [],
                          ipython: []
                        },
                        {
                          system: [],
                          user: [`{{input}}`],
                          assistant: [],
                          ipython: []
                        }
                      ]
                    })
                  })
                }
              : undefined
          })
        );
      }
      tools.push(
        ...customUsages.map((toolUsage) => {
          switch (toolUsage.tool.$.executor) {
            case ToolExecutor.CODE_INTERPRETER:
              return new CustomTool({
                codeInterpreter,
                executorId,
                description: toolUsage.tool.$.description,
                sourceCode: (<CodeInterpreterUserTool>toolUsage.tool.$).sourceCode,
                name: toolUsage.tool.$.name,
                inputSchema: (<CodeInterpreterUserTool>toolUsage.tool.$).jsonSchema
              });
            case ToolExecutor.FUNCTION:
              return new FunctionTool({
                name: toolUsage.tool.$.name,
                description: toolUsage.tool.$.description,
                parameters: (<FunctionUserTool>toolUsage.tool.$).parameters,
                context
              });
            case ToolExecutor.API:
              return new ApiCallTool({
                name: toolUsage.tool.$.name,
                description: toolUsage.tool.$.description,
                openApiSchema: (<ApiCallUserTool>toolUsage.tool.$).openApiSchema,
                context,
                apiKey: (<ApiCallUserTool>toolUsage.tool.$).apiKey
              });
          }
        })
      );
    } else {
      getLogger()
        .child({ runId: run.id })
        .warn('Code execution was requested but skipped due to being disabled');
    }
  }

  const readFileUsage = run.tools.find(
    (tool): tool is SystemUsage =>
      tool.type === ToolType.SYSTEM && tool.toolId === SystemTools.READ_FILE
  );
  if (readFileUsage) {
    const files = [...(run.assistant.$.toolResources ?? []), ...(run.thread.$.toolResources ?? [])]
      .filter(
        (resource): resource is Loaded<SystemResource> =>
          resource.type === ToolType.SYSTEM && resource.toolId === SystemTools.READ_FILE
      )
      .flatMap((resource) => resource.fileContainers as Loaded<FileContainer, 'file'>[])
      .flatMap((container) => container.file.$);

    tools.push(
      new ReadFileTool({
        fileSize: 500_000,
        files,
        retryOptions: { maxRetries: 0 }
      })
    );
  }

  const functionUsages = run.tools.filter(
    (tool): tool is FunctionUsage => tool.type === ToolType.FUNCTION
  );
  functionUsages.forEach((usage) => {
    tools.push(
      new FunctionTool({
        name: usage.name,
        description: usage.description,
        parameters: usage.parameters,
        context
      })
    );
  });

  return tools;
}

export async function getAllReadableRunFiles(run: LoadedRun): Promise<Loaded<File>[]> {
  const attachedFiles = run.thread.$.messages.$.map(
    (message) =>
      message.attachments?.map((attachment) => (attachment as Loaded<Attachment, 'file'>).file.$) ??
      []
  ).flat();
  const resourceFiles = [
    ...(run.assistant.$.toolResources ?? []),
    ...(run.thread.$.toolResources ?? [])
  ]
    .filter((resource): resource is Loaded<CodeInterpreterResource> => 'fileContainers' in resource)
    .flatMap((resource) => resource.fileContainers as Loaded<FileContainer, 'file'>[])
    .filter((fileContainer) => fileContainer.file.$.extraction)
    .flatMap((container) => container.file.$);
  return uniqueBy([...resourceFiles, ...attachedFiles], (file) => file.id);
}

export async function createToolCall(
  {
    tool,
    input
  }: {
    tool: FrameworkTool;
    input: unknown;
  },
  { run }: AgentContext
) {
  if (tool instanceof FileSearchTool) {
    return new FileSearchCall({
      input: await tool.parse(input).then((result) => result.query)
    });
  } else if (tool.name === wikipediaTool().name) {
    return new SystemCall({
      toolId: SystemTools.WIKIPEDIA,
      input: await tool.parse(input)
    });
  } else if (tool instanceof GoogleSearchTool || tool instanceof DuckDuckGoSearchTool) {
    return new SystemCall({
      toolId: SystemTools.WEB_SEARCH,
      input: await tool.parse(input)
    });
  } else if (tool instanceof OpenMeteoTool) {
    return new SystemCall({
      toolId: SystemTools.WEATHER,
      input: await tool.parse(input)
    });
  } else if (tool instanceof ArXivTool) {
    return new SystemCall({
      toolId: SystemTools.ARXIV,
      input: await tool.parse(input)
    });
  } else if (tool instanceof PythonTool) {
    return new CodeInterpreterCall({
      input: await tool.parse(input).then((result) => result.code)
    });
  } else if (tool instanceof ReadFileTool) {
    return new SystemCall({
      toolId: SystemTools.READ_FILE,
      input: await tool.parse(input)
    });
  } else if (tool instanceof LLMTool) {
    return new SystemCall({
      toolId: SystemTools.LLM,
      input: await tool.parse(input)
    });
  } else if (tool instanceof CalculatorTool) {
    return new SystemCall({
      toolId: SystemTools.CALCULATOR,
      input: await tool.parse(input)
    });
  } else if (tool instanceof FunctionTool) {
    return new FunctionCall({ name: tool.name, arguments: JSON.stringify(input) });
  } else if (tool instanceof CustomTool || tool instanceof ApiCallTool) {
    const [toolEntity] = await ORM.em
      .getRepository(Tool)
      .find({ name: tool.name, project: run.project });
    return new UserCall({
      tool: ref(toolEntity),
      arguments: JSON.stringify(input)
    });
  }
  throw new Error(`Unexpected tool ${tool.name}`);
}

export async function finalizeToolCall(
  {
    result
  }: {
    result: ToolOutput;
  },
  { toolCall }: AgentContext
) {
  if (!toolCall) throw new Error(`No tool call to finalize`);

  if (toolCall instanceof SystemCall) {
    switch (toolCall.toolId) {
      case SystemTools.WIKIPEDIA: {
        if (!(result instanceof SimilarityToolOutput)) throw new TypeError();
        toolCall.output = result.result;
        break;
      }
      case SystemTools.WEB_SEARCH: {
        if (!(result instanceof SearchToolOutput)) throw new TypeError();
        toolCall.output = result.results;
        break;
      }
      case SystemTools.ARXIV: {
        if (!(result instanceof ArXivToolOutput)) throw new TypeError();
        toolCall.output = result.result;
        break;
      }
      case SystemTools.WEATHER: {
        toolCall.output = result;
        break;
      }
      case SystemTools.CALCULATOR:
      case SystemTools.LLM:
      case SystemTools.READ_FILE: {
        if (!(result instanceof StringToolOutput)) throw new TypeError();
        toolCall.output = result.result;
        break;
      }
    }
  } else if (toolCall instanceof CodeInterpreterCall) {
    if (!(result instanceof PythonToolOutput)) throw new TypeError();
    toolCall.logs = [result.stdout, result.stderr];
    toolCall.fileContainers = result.outputFiles?.map(
      (file) => new FileContainer({ file: ref(File, file.id) })
    );
  } else if (toolCall instanceof FunctionCall) {
    if (!(result instanceof FunctionToolOutput)) throw new TypeError();
    toolCall.output = result.result;
  } else if (toolCall instanceof FileSearchCall) {
    if (!(result instanceof FileSearchToolOutput)) throw new TypeError();
    toolCall.results = result.results;
  } else if (toolCall instanceof UserCall) {
    if (!(result instanceof StringToolOutput)) throw new TypeError();
    toolCall.output = result.result;
  } else {
    throw new Error(`Unexpected tool call`);
  }
}

export async function requireToolApproval(ctx: AgentContext) {
  const { toolCall } = ctx;
  if (toolCall) {
    if (
      ctx.run.toolApprovals?.find(
        (approval) =>
          approval.toolId ===
          (toolCall.type === ToolType.USER
            ? toolCall.tool.id
            : toolCall.type === ToolType.SYSTEM
              ? toolCall.toolId
              : toolCall.type)
      )?.requireApproval === ToolApprovalType.ALWAYS
    ) {
      await withRedisClient(
        (client) =>
          new Promise((resolve, reject) => {
            client.subscribe(createApproveChannel(ctx.run, toolCall), async (err) => {
              try {
                if (err) {
                  reject(err);
                } else {
                  ctx.run.requireAction(
                    new RequiredToolApprove({
                      toolCalls: [...(ctx.run.requiredAction?.toolCalls ?? []), toolCall]
                    })
                  );
                  await ORM.em.flush();
                  await ctx.publish({
                    event: 'thread.run.requires_action',
                    data: toRunDto(ctx.run)
                  });
                  await ctx.publish({
                    event: 'done',
                    data: '[DONE]'
                  });
                }
              } catch (err) {
                reject(err);
              }
            });
            client.on('message', async (_, approval) => {
              try {
                ctx.run.submitAction();
                await ORM.em.flush();
                if (approval !== 'true') {
                  reject(
                    new ToolError('User has not approved this tool to run.', [], {
                      isFatal: false,
                      isRetryable: false
                    })
                  );
                }
                resolve(true);
              } catch (err) {
                reject(err);
              }
            });
          })
      );
    }
  }
}

export async function requireToolInput(
  ctx: AgentContext,
  { tool: frameworkTool, options }: { tool: AnyTool; options: BaseToolRunOptions }
) {
  const { toolCall } = ctx;
  if (toolCall) {
    if (toolCall.type === 'user') {
      const tool = await ORM.em.getRepository(Tool).findOneOrFail(toolCall.tool.id);

      if (tool instanceof CodeInterpreterTool) {
        const toolSecrets = await ORM.em
          .getRepository(ToolSecret)
          .find({ tool: toolCall.tool.id, createdBy: ctx.run.createdBy, project: ctx.run.project });
        const fulfilledSecrets: { [key: string]: string } = (tool.secrets ?? []).reduce(
          (acc, secretName) => {
            const secret = toolSecrets.find((ts) => ts.name === secretName);
            return {
              ...acc,
              [secretName]: secret ? decrypt(secret.value) : undefined
            };
          },
          {}
        );
        const missingSecrets = Object.entries(fulfilledSecrets)
          .filter(([_, value]) => !value)
          .map(([key]) => key);
        if (missingSecrets.length > 0)
          await withRedisClient(
            (client) =>
              new Promise((resolve, reject) => {
                client.subscribe(createToolInputChannel(ctx.run, toolCall), async (err) => {
                  try {
                    if (err) {
                      reject(err);
                    } else {
                      ctx.run.requireAction(
                        new RequiredToolInput({
                          toolCalls: [...(ctx.run.requiredAction?.toolCalls ?? []), toolCall],
                          inputFields: missingSecrets
                        })
                      );
                      await ORM.em.flush();
                      await ctx.publish({
                        event: 'thread.run.requires_action',
                        data: toRunDto(ctx.run)
                      });
                      await ctx.publish({
                        event: 'done',
                        data: '[DONE]'
                      });
                    }
                  } catch (err) {
                    reject(err);
                  }
                });
                client.on('message', async (_, inputs) => {
                  try {
                    ctx.run.submitAction();
                    await ORM.em.flush();
                    const newSecrest = JSON.parse(inputs);

                    newSecrest.forEach((secret: { name: string; value: string }) => {
                      fulfilledSecrets[secret.name] = secret.value;
                    });

                    if (frameworkTool instanceof CustomTool) {
                      Object.entries(fulfilledSecrets).forEach(([key, value]) =>
                        setProp(options, ['env', key], value)
                      );
                    } else {
                      reject(
                        new ToolError('Invalid tool type', [], {
                          isFatal: true,
                          isRetryable: false
                        })
                      );
                    }
                    resolve(true);
                  } catch (err) {
                    reject(err);
                  }
                });
              })
          );
      }
    }
  }
}
