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

import { FrameworkError, Version } from 'bee-agent-framework';
import { EventMeta, Emitter } from 'bee-agent-framework/emitter/emitter';
import { ref } from '@mikro-orm/core';
import { Role } from 'bee-agent-framework/llms/primitives/message';
import { BeeCallbacks } from 'bee-agent-framework/agents/bee/types';
import { Summary } from 'prom-client';
import { ToolError } from 'bee-agent-framework/tools/base';

import { AgentContext } from '@/runs/execution/execute.js';
import { getLogger } from '@/logger.js';
import { createToolCall, finalizeToolCall } from '@/runs/execution/tools/helpers.js';
import { RunStep, RunStepStatus } from '@/run-steps/entities/run-step.entity.js';
import { RunStepToolCalls } from '@/run-steps/entities/details/run-step-tool-calls.entity.js';
import { ORM } from '@/database.js';
import { toRunStepDeltaDto, toRunStepDto } from '@/run-steps/run-steps.service.js';
import { Message, MessageStatus } from '@/messages/message.entity.js';
import { toMessageDto } from '@/messages/messages.service.js';
import { RunStepMessageCreation } from '@/run-steps/entities/details/run-step-message-creation.entity.js';
import { RunStepThought } from '@/run-steps/entities/details/run-step-thought.entity.js';
import { RunStatus } from '@/runs/entities/run.entity.js';
import { APIError } from '@/errors/error.entity.js';
import { jobRegistry } from '@/metrics.js';
import { EmitterEvent } from '@/run-steps/entities/emitter-event.entity';
import { createClient } from '@/redis.js';
import { createApproveChannel, toRunDto } from '@/runs/runs.service';
import { RequiredToolApprove } from '@/runs/entities/requiredToolApprove.entity';
import { ToolApprovalType } from '@/runs/entities/toolApproval.entity';
import { ToolType } from '@/tools/entities/tool/tool.entity';
import { last } from 'remeda';

const agentToolExecutionTime = new Summary({
  name: 'agent_tool_execution_time_seconds',
  help: 'Agent tool execution time in seconds',
  labelNames: ['framework', 'tool'] as const,
  registers: [jobRegistry]
});

export function createStreamingHandler(ctx: AgentContext) {
  return (emitter: Emitter<BeeCallbacks>) => {
    const logger = getLogger().child({ runId: ctx.run.id });

    let toolExecutionEnd: (() => number) | null = null;

    emitter.on('toolStart', async ({ data }, meta) => {
      toolExecutionEnd = agentToolExecutionTime.startTimer({
        framework: Version,
        tool: data.tool.name
      });

      if (ctx.runStep)
        logger.warn(
          { data, step: ctx.runStep.id },
          'Tool has started while previous run step has not finished'
        );
      if (ctx.toolCall)
        logger.warn(
          { data, call: ctx.toolCall.id },
          'Tool has started while previous call has not finished'
        );

      ctx.toolCall = await createToolCall(data, ctx);
      ctx.runStep = new RunStep({
        project: ctx.run.project,
        run: ref(ctx.run),
        thread: ctx.run.thread,
        assistant: ctx.run.assistant,
        createdBy: ctx.run.createdBy,
        details: new RunStepToolCalls({
          toolCalls: [ctx.toolCall]
        }),
        metadata: {},
        event: createEventFromMeta(meta)
      });
      await ORM.em.persistAndFlush(ctx.runStep);
      await ctx.publish({
        event: 'thread.run.step.created',
        data: toRunStepDto(ctx.runStep)
      });

      const toolCall = ctx.toolCall;
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
          const client = createClient();
          await new Promise((resolve, reject) => {
            client.subscribe(createApproveChannel(ctx.run, toolCall), async (err) => {
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
            });
            client.on('message', async (_, approval) => {
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
            });
          });
        }
      }

      await ctx.publish({
        event: 'thread.run.step.in_progress',
        data: toRunStepDto(ctx.runStep)
      });
    });

    emitter.on('toolSuccess', async ({ data }) => {
      if (toolExecutionEnd) toolExecutionEnd();

      if (!ctx.runStep) {
        logger.warn({ data }, 'Tool has finished with missing run step');
        return;
      }
      if (!ctx.toolCall) {
        logger.warn({ data }, 'Tool has finished with missing call');
        return;
      }

      await finalizeToolCall(data, ctx);
    });

    emitter.on('toolError', ({ data }) => onError(ctx)(data.error));

    // onUpdate follows with a flush and publish
    emitter.on('update', async ({ data, update, meta, memory }) => {
      if (update.key === 'final_answer') {
        if (!ctx.message) {
          logger.warn({ successCall: data }, 'Agent success with missing message');
          return;
        }
        ctx.message.content = data.final_answer ?? ctx.message.content;
        ctx.message.status = MessageStatus.COMPLETED;
        await ORM.em.flush();
        await ctx.publish({ event: 'thread.message.completed', data: toMessageDto(ctx.message) });
        ctx.message = undefined;
      }
      if (
        update.key === 'final_answer' ||
        update.key === 'tool_output' ||
        update.key === 'thought'
      ) {
        if (!ctx.runStep) {
          logger.warn({ successCall: data }, 'Agent finished step with missing run step');
          return;
        }
        if (update.key === 'thought' && ctx.runStep.details instanceof RunStepThought) {
          ctx.runStep.details.content = data.thought ?? ctx.runStep.details.content;
        }
        if (update.key === 'tool_output') {
          await ORM.em.persistAndFlush(
            new Message({
              project: ctx.run.project,
              role: 'tool_call',
              content: last(memory.messages)?.text ?? '',
              thread: ctx.run.thread,
              run: ref(ctx.run),
              createdBy: ctx.run.createdBy,
              status: MessageStatus.COMPLETED
            })
          );
        }
        if (meta.success) {
          ctx.runStep.status = RunStepStatus.COMPLETED;
          await ORM.em.flush();
          await ctx.publish({
            event: 'thread.run.step.completed',
            data: toRunStepDto(ctx.runStep)
          });
        } else {
          ctx.runStep.status = RunStepStatus.FAILED;
          await ORM.em.flush();
          await ctx.publish({ event: 'thread.run.step.failed', data: toRunStepDto(ctx.runStep) });
        }
        ctx.runStep = undefined;
        ctx.toolCall = undefined;
      }
    });

    emitter.on('partialUpdate', async ({ update }, meta) => {
      if (update.key === 'final_answer') {
        if (!ctx.message) {
          if (ctx.runStep)
            logger.warn(
              { messageCall: update, step: ctx.runStep.id },
              'Message creation has started while previous run step has not finished'
            );
          ctx.message = new Message({
            project: ctx.run.project,
            role: Role.ASSISTANT,
            content: '',
            thread: ctx.run.thread,
            run: ref(ctx.run),
            createdBy: ctx.run.createdBy,
            status: MessageStatus.IN_PROGRESS
          });
          ctx.runStep = new RunStep({
            project: ctx.run.project,
            run: ref(ctx.run),
            thread: ctx.run.thread,
            assistant: ctx.run.assistant,
            createdBy: ctx.run.createdBy,
            details: new RunStepMessageCreation({ message: ref(ctx.message) }),
            event: createEventFromMeta(meta)
          });
          await ORM.em.persistAndFlush([ctx.message, ctx.runStep]);
          await ctx.publish({
            event: 'thread.run.step.created',
            data: toRunStepDto(ctx.runStep)
          });
          await ctx.publish({
            event: 'thread.run.step.in_progress',
            data: toRunStepDto(ctx.runStep)
          });
          await ctx.publish({ event: 'thread.message.created', data: toMessageDto(ctx.message) });
          await ctx.publish({
            event: 'thread.message.in_progress',
            data: toMessageDto(ctx.message)
          });
        }
        ctx.message.content += update.value;
        await ctx.publish({
          event: 'thread.message.delta',
          data: {
            id: ctx.message.id,
            object: 'thread.message.delta',
            delta: {
              role: Role.ASSISTANT,
              content: [
                {
                  index: 0,
                  type: 'text',
                  text: {
                    value: update.value
                  }
                }
              ]
            }
          }
        });
      } else if (update.key === 'thought') {
        if (!ctx.runStep) {
          ctx.runStep = new RunStep({
            project: ctx.run.project,
            run: ref(ctx.run),
            thread: ctx.run.thread,
            assistant: ctx.run.assistant,
            createdBy: ctx.run.createdBy,
            details: new RunStepThought({ content: undefined }),
            event: createEventFromMeta(meta)
          });
          await ORM.em.persistAndFlush(ctx.runStep);
          await ctx.publish({
            event: 'thread.run.step.created',
            data: toRunStepDto(ctx.runStep)
          });
          await ctx.publish({
            event: 'thread.run.step.in_progress',
            data: toRunStepDto(ctx.runStep)
          });
        }
        if (!(ctx.runStep?.details instanceof RunStepThought)) {
          logger.warn(
            { messageCall: update, step: ctx.runStep.id },
            'Invalid run step type for thought update'
          );
          return;
        }
        ctx.runStep.details.content += update.value;
        await ctx.publish({
          event: 'thread.run.step.delta',
          data: toRunStepDeltaDto(ctx.runStep, update.value)
        });
      }
    });
    emitter.on('error', ({ error }) => onError(ctx)(error));
  };
}

const onError = (ctx: AgentContext) => async (error: Error) => {
  if (ctx.message) {
    ctx.message.status = MessageStatus.INCOMPLETE;
    await ORM.em.flush();
    await ctx.publish({
      event: 'thread.message.incomplete',
      data: toMessageDto(ctx.message)
    });
    ctx.message = undefined;
  }
  if (ctx.runStep) {
    if (FrameworkError.isAbortError(error)) {
      ctx.runStep.status = RunStatus.CANCELLED;
      await ORM.em.flush();
      await ctx.publish({
        event: 'thread.run.step.cancelled',
        data: toRunStepDto(ctx.runStep)
      });
    } else {
      ctx.runStep.status = RunStepStatus.FAILED;
      ctx.runStep.lastError = APIError.from(error);
      await ORM.em.flush();
      await ctx.publish({ event: 'thread.run.step.failed', data: toRunStepDto(ctx.runStep) });
    }
    ctx.runStep = undefined;
    ctx.toolCall = undefined;
  }
};

const createEventFromMeta = (meta: EventMeta) => {
  return meta.groupId
    ? new EmitterEvent({
        id: meta.id,
        groupId: meta.groupId,
        name: meta.name,
        path: meta.path,
        runId: meta.trace?.runId,
        parentRunId: meta.trace?.parentRunId
      })
    : undefined;
};
