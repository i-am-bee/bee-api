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

import { Loaded } from '@mikro-orm/core';
import { TokenMemory } from 'bee-agent-framework/memory/tokenMemory';
import { BaseMessage } from 'bee-agent-framework/llms/primitives/message';
import { Version } from 'bee-agent-framework';
import { BeeAgent } from 'bee-agent-framework/agents/bee/agent';
import { Summary } from 'prom-client';
import dayjs from 'dayjs';
import { isTruthy } from 'remeda';
import { createObserveConnector } from 'bee-observe-connector';

import { Run } from '../entities/run.entity.js';
import { toRunDto } from '../runs.service.js';

import {
  addFileToToolResource,
  checkFileExistsOnToolResource,
  createToolResource,
  getPromptTemplate
} from './helpers.js';
import { getTools } from './tools/helpers.js';
import { createChatLLM } from './factory.js';

import { ORM } from '@/database.js';
import { getLogger } from '@/logger.js';
import { createPublisher } from '@/streaming/pubsub.js';
import { APIError } from '@/errors/error.entity.js';
import { jobRegistry } from '@/metrics.js';
import { getTraceLogger } from '@/observe/utils.js';
import { watchForCancellation } from '@/utils/jobs.js';
import { Trace } from '@/observe/entities/trace.entity.js';
import { RunStep } from '@/run-steps/entities/run-step.entity.js';
import { Message } from '@/messages/message.entity.js';
import { AnyToolCall } from '@/tools/entities/tool-calls/tool-call.entity.js';
import { createStreamingHandler } from '@/runs/execution/event-handlers/streaming.js';
import { LoadedRun } from '@/runs/execution/types.js';
import { UserResource } from '@/tools/entities/tool-resources/user-resource.entity.js';
import { SystemResource } from '@/tools/entities/tool-resources/system-resource.entity.js';
import { BEE_OBSERVE_API_AUTH_KEY, BEE_OBSERVE_API_URL } from '@/config.js';
import { Attachment } from '@/messages/attachment.entity';

const agentExecutionTime = new Summary({
  name: 'agent_execution_time_seconds',
  help: 'Agent execution time in seconds',
  labelNames: ['framework'] as const,
  registers: [jobRegistry]
});

export type AgentContext = {
  run: Loaded<Run>;
  publish: ReturnType<typeof createPublisher>;
  runStep?: Loaded<RunStep>;
  message?: Loaded<Message>;
  toolCall?: Loaded<AnyToolCall>;
};

export async function executeRun(run: LoadedRun) {
  const runLogger = getLogger().child({ runId: run.id });

  const llm = createChatLLM(run);

  const publish = createPublisher(run);

  // create messages and add file ids to message content
  const messages = run.thread.$.messages.$.filter((message) => !message.deletedAt).map((message) =>
    message.role === 'tool_call'
      ? new BaseMessage('assistant', message.content, { createdAt: message.createdAt })
      : new BaseMessage(
          message.role,
          `${message.content}${message.attachments && message.attachments.length > 0 ? `\n\nFiles:\n${message.attachments.map((attachment) => (attachment as Loaded<Attachment, 'file'>).file.$.filename).join('\n')}` : ''}`,
          {
            createdAt: message.createdAt
          }
        )
  );
  console.log(messages);

  // add all files from the message attachments to the thread tool_resources
  const attachments = run.thread.$.messages.$.getItems()
    .filter((m) => !m.run && m.attachments)
    .flatMap((m) => m.attachments ?? []);

  for (const attachment of attachments) {
    const toolResources = run.thread.$.toolResources ?? [];

    await Promise.all(
      (attachment.tools ?? [])?.map(async (tool) => {
        const existingToolResources = toolResources.filter(
          (tr) =>
            tr.type === tool.type &&
            (tr instanceof UserResource
              ? tool.id === tr.tool.id
              : tr instanceof SystemResource
                ? tool.id === tr.toolId
                : true)
        );
        if (existingToolResources.length > 0) {
          const fileExistsChecks = await Promise.all(
            existingToolResources.map(async (existingToolResource) =>
              checkFileExistsOnToolResource(existingToolResource, attachment.file)
            )
          );
          const fileExists = fileExistsChecks.some(isTruthy);
          if (!fileExists) addFileToToolResource(existingToolResources[0], attachment.file);
        } else {
          const newResource = await createToolResource(tool.type, [attachment.file], tool.id);
          newResource && toolResources.push(newResource);
        }
      })
    );

    run.thread.$.toolResources = toolResources;
  }

  const memory = new TokenMemory({
    llm
  });
  await memory.addMany(messages);

  run.start();
  await ORM.em.flush();
  await publish({ event: 'thread.run.in_progress', data: toRunDto(run) });

  const context = { run, publish } as AgentContext;

  const agent = new BeeAgent({
    llm,
    memory,
    tools: await getTools(run, context),
    templates: {
      system: getPromptTemplate(run)
    }
  });

  const cancellationController = new AbortController();
  const unsub = watchForCancellation(Run, run, () => cancellationController.abort());

  const expirationSignal = AbortSignal.timeout(dayjs(run.expiresAt).diff(dayjs(), 'milliseconds'));

  try {
    const endAgentExecutionTimer = agentExecutionTime.labels({ framework: Version }).startTimer();
    const agentRunPromise = agent
      .run(
        { prompt: null }, // messages have been loaded to agent's memory
        {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          signal: AbortSignal.any([cancellationController.signal, expirationSignal]),
          execution: {
            totalMaxRetries: 10,
            maxRetriesPerStep: 3,
            maxIterations: 10
          }
        }
      )
      .observe(createStreamingHandler(context));

    // apply observe middleware only when the observe API is enabled
    if (BEE_OBSERVE_API_URL && BEE_OBSERVE_API_AUTH_KEY) {
      agentRunPromise.middleware(
        createObserveConnector({
          api: {
            baseUrl: BEE_OBSERVE_API_URL,
            apiAuthKey: BEE_OBSERVE_API_AUTH_KEY,
            ignored_keys: [
              'apiToken',
              'apiKey',
              'cseId',
              'accessToken',
              'proxy',
              'username',
              'password'
            ]
          },
          cb: async (err, traceResponse) => {
            if (err) {
              getTraceLogger().warn({ err }, 'bee-observe API error');
            } else if (traceResponse) {
              run.trace = new Trace({ id: traceResponse.result.id });
            }
          }
        })
      );
    }

    await agentRunPromise;

    endAgentExecutionTimer();
    run.complete();

    await ORM.em.flush();
    await publish({ event: 'thread.run.completed', data: toRunDto(run) });
  } catch (err) {
    if (expirationSignal.aborted) {
      run.expire();
      await ORM.em.flush();
      await publish({ event: 'thread.run.expired', data: toRunDto(run) });
      return;
    } else if (cancellationController.signal.aborted) {
      run.cancel();
      await ORM.em.flush();
      await publish({ event: 'thread.run.cancelled', data: toRunDto(run) });
      return;
    }

    runLogger.error({ err }, 'Run execution failed');
    run.fail(APIError.from(err));
    await ORM.em.flush();
    await publish({ event: 'thread.run.failed', data: toRunDto(run) });
    return;
  } finally {
    await publish({ event: 'done', data: '[DONE]' });
    unsub();
    agent.destroy();
  }
}
