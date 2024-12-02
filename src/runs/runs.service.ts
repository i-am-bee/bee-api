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

import { FilterQuery, Loaded, QueryOrder, ref } from '@mikro-orm/core';

import { RunCreateBody, RunCreateParams, RunCreateResponse } from './dtos/run-create.js';
import { Run, RunStatus } from './entities/run.entity.js';
import type { Run as RunDto } from './dtos/run.js';
import { RunReadParams, RunReadResponse } from './dtos/run-read.js';
import { RunsListParams, RunsListQuery, RunsListResponse } from './dtos/runs-list.js';
import { RunCancelParams, RunCancelResponse } from './dtos/run-cancel.js';
import { queue } from './jobs/runs.queue.js';
import { ThreadRunCreateBody, ThreadRunCreateResponse } from './dtos/thread-run-create.js';
import { TraceReadResponse } from './dtos/trace-read.js';
import {
  RunSubmitToolOutputsBody,
  RunSubmitToolOutputsParams,
  RunSubmitToolOutputsResponse
} from './dtos/run-submit-tool-outputs.js';
import { FunctionTool } from './execution/tools/function.js';
import { RunUpdateBody, RunUpdateParams, RunUpdateResponse } from './dtos/run-update.js';
import {
  RunSubmitToolApprovalsBody,
  RunSubmitToolApprovalsParams,
  RunSubmitToolApprovalsResponse
} from './dtos/run-submit-tool-approvals.js';
import { RequiredToolOutput } from './entities/requiredToolOutput.entity.js';
import { RequiredToolApprove } from './entities/requiredToolApprove.entity.js';
import { ToolApproval, ToolApprovalType } from './entities/toolApproval.entity.js';
import { RequiredActionType } from './entities/requiredAction.entity.js';

import { ORM } from '@/database.js';
import { Thread } from '@/threads/thread.entity.js';
import { Assistant } from '@/assistants/assistant.entity.js';
import { getServiceLogger } from '@/logger.js';
import { createThread } from '@/threads/threads.service.js';
import { createPaginatedResponse, getListCursor } from '@/utils/pagination.js';
import { createPublisher, subscribeAndForward } from '@/streaming/pubsub.js';
import { listenToSocketClose } from '@/utils/networking.js';
import { APIError, APIErrorCode } from '@/errors/error.entity.js';
import { toErrorDto } from '@/errors/plugin.js';
import { createToolUsage, toToolCallDto, toToolUsageDto } from '@/tools/tools.service.js';
import { Tool, ToolType } from '@/tools/entities/tool/tool.entity.js';
import type { Trace as TraceDto } from '@/observe/dtos/trace.js';
import { Trace } from '@/observe/entities/trace.entity.js';
import { QueueName } from '@/jobs/constants.js';
import { getRunVectorStores } from '@/runs/execution/helpers.js';
import { getUpdatedValue } from '@/utils/update.js';
import { RunStep } from '@/run-steps/entities/run-step.entity.js';
import { RunStepDetailsType } from '@/run-steps/entities/details/run-step-details.entity.js';
import { createClient } from '@/redis.js';
import { ToolCall } from '@/tools/entities/tool-calls/tool-call.entity.js';
import { SystemTools } from '@/tools/entities/tool-calls/system-call.entity.js';
import { ensureRequestContextData } from '@/context.js';
import { getProjectPrincipal } from '@/administration/helpers.js';
import { RUNS_QUOTA_DAILY } from '@/config.js';
import { dayjs, getLatestDailyFixedTime } from '@/utils/datetime.js';

export async function assertRunsQuota(newRuns = 1) {
  const count = await ORM.em.getRepository(Run).count({
    createdBy: getProjectPrincipal(),
    createdAt: { $gte: getLatestDailyFixedTime().toDate() }
  });
  if (count + newRuns > RUNS_QUOTA_DAILY) {
    throw new APIError({
      message: 'Your daily runs quota has been exceeded',
      code: APIErrorCode.TOO_MANY_REQUESTS
    });
  }
}

const getRunsLogger = (runId?: string) => getServiceLogger('runs').child({ runId });

type RunStepWithEvent = Omit<RunStep, 'event'> & { event: Required<RunStep>['event'] };

export function toRunDto(run: Loaded<Run>): RunDto {
  return {
    id: run.id,
    object: 'thread.run',
    thread_id: run.thread.id,
    assistant_id: run.assistant.id,
    status: run.status,
    last_error: run.lastError ? toErrorDto(run.lastError) : null,
    required_action:
      run.requiredAction instanceof RequiredToolOutput
        ? {
            type: 'submit_tool_outputs',
            submit_tool_outputs: { tool_calls: run.requiredAction.toolCalls.map(toToolCallDto) }
          }
        : run.requiredAction instanceof RequiredToolApprove
          ? {
              type: 'submit_tool_approvals',
              submit_tool_approvals: { tool_calls: run.requiredAction.toolCalls.map(toToolCallDto) }
            }
          : null,
    tools: run.tools.map(toToolUsageDto) ?? [],
    instructions: run.instructions ?? null,
    additional_instructions: run.additionalInstructions ?? null,
    metadata: run.metadata ?? {},
    created_at: dayjs(run.createdAt).unix(),
    started_at: run.startedAt ? dayjs(run.startedAt).unix() : null,
    expires_at: dayjs(run.expiresAt).unix(),
    cancelled_at: run.cancelledAt ? dayjs(run.cancelledAt).unix() : null,
    completed_at: run.completedAt ? dayjs(run.completedAt).unix() : null,
    failed_at: run.failedAt ? dayjs(run.failedAt).unix() : null,
    model: run.model,
    top_p: run.topP,
    temperature: run.temperature
  };
}

function toTraceDto(trace: Trace, { runSteps }: { runSteps: RunStepWithEvent[] }): TraceDto {
  return {
    id: trace.id,
    iterations: runSteps.map((step) => ({
      id: step.id,
      event: {
        group_id: step.event.groupId
      }
    }))
  };
}

export async function createRun({
  thread_id,
  assistant_id,
  tools: toolsParam,
  stream,
  instructions,
  additional_instructions: additionalInstructions,
  metadata,
  model,
  top_p,
  temperature,
  tool_approvals
}: RunCreateParams & RunCreateBody): Promise<RunCreateResponse | void> {
  const thread = await ORM.em.getRepository(Thread).findOneOrFail(
    { id: thread_id },
    // Incorrect MikroORM typing for embedded entities
    { populate: ['toolResources.vectorStoreContainers.vectorStore'] as any[] }
  );
  const assistant = await ORM.em.getRepository(Assistant).findOneOrFail(
    {
      id: assistant_id
    },
    // Incorrect MikroORM typing for embedded entities
    { populate: ['toolResources.vectorStoreContainers.vectorStore'] as any[] }
  );
  const customToolIds =
    toolsParam?.flatMap((toolUsage) =>
      toolUsage.type === ToolType.USER ? toolUsage.user.tool.id : []
    ) ?? [];
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
  if (tool_approvals?.length) {
    const databaseTools = Object.keys(tool_approvals).filter(
      (id) =>
        ![
          ToolType.CODE_INTERPRETER,
          ToolType.FILE_SEARCH,
          ToolType.FUNCTION,
          ...(Object.values(SystemTools) as string[])
        ].includes(id)
    );
    const tools = await ORM.em.getRepository(Tool).find({
      id: {
        $in: databaseTools
      }
    });

    if (tools.length !== databaseTools.length) {
      throw new APIError({
        message: 'Some tool in tool_approvals not found',
        code: APIErrorCode.INVALID_INPUT
      });
    }
  }

  await assertRunsQuota();

  const run = new Run({
    thread: ref(thread),
    assistant: ref(assistant),
    tools: toolsParam?.map(createToolUsage) ?? assistant.tools,
    instructions: instructions ?? assistant.instructions,
    additionalInstructions: additionalInstructions ?? undefined,
    metadata,
    model: model ?? assistant.model,
    topP: top_p ?? assistant.topP,
    temperature: temperature ?? assistant.temperature,
    toolApprovals: tool_approvals
      ? Object.entries(tool_approvals).map(
          ([tool, approval]) =>
            new ToolApproval({
              toolId: tool,
              requireApproval: approval.require as ToolApprovalType
            })
        )
      : undefined
  });
  ORM.em.persist(run);

  for (const vectorStore of getRunVectorStores(assistant, thread)) {
    if (vectorStore.expired) throw Error('The attached vector-store is expired.');
  }

  await ORM.em.flush();

  const queueAndPublish = async () => {
    const publish = createPublisher(run);
    try {
      await publish({ event: 'thread.run.created', data: toRunDto(run) });
      await queue.add(QueueName.RUNS, { runId: run.id }, { jobId: run.id });
      await publish({ event: 'thread.run.queued', data: toRunDto(run) });
    } catch (err) {
      getRunsLogger(run.id).error({ err }, 'Failed to create run job');
      run.fail(
        new APIError({
          message: 'Failed to create run job',
          code: APIErrorCode.INTERNAL_SERVER_ERROR
        })
      );
      await ORM.em.flush();
      await publish({ event: 'thread.run.failed', data: toRunDto(run) });
      await publish({ event: 'done', data: '[DONE]' });
    }
  };

  if (stream) {
    const req = ensureRequestContextData('req');
    const res = ensureRequestContextData('res');
    const controller = new AbortController();
    const unsub = listenToSocketClose(req.socket, () => controller.abort());
    try {
      await subscribeAndForward(run, res, {
        signal: controller.signal,
        onReady: queueAndPublish,
        onFailed: queueAndPublish
      });
    } finally {
      unsub();
    }
  } else {
    await queueAndPublish();
    return toRunDto(run);
  }
}

export async function createThreadRun({
  thread,
  ...rest
}: ThreadRunCreateBody): Promise<ThreadRunCreateResponse | void> {
  const newThread = await createThread(thread ?? {});
  try {
    return await createRun({ thread_id: newThread.id, ...rest });
  } catch (err) {
    try {
      await ORM.em.removeAndFlush(ORM.em.getRepository(Thread).getReference(newThread.id));
    } catch (err) {
      getRunsLogger().warn({ err }, 'Thread cleanup failed');
    }
    throw err;
  }
}

export async function readRun({ thread_id, run_id }: RunReadParams): Promise<RunReadResponse> {
  const run = await ORM.em.getRepository(Run).findOneOrFail({
    id: run_id,
    thread: thread_id
  });
  return toRunDto(run);
}

export async function updateRun({
  thread_id,
  run_id,
  metadata
}: RunUpdateParams & RunUpdateBody): Promise<RunUpdateResponse> {
  const run = await ORM.em.getRepository(Run).findOneOrFail({
    id: run_id,
    thread: thread_id
  });
  run.metadata = getUpdatedValue(metadata, run.metadata);
  await ORM.em.flush();
  return toRunDto(run);
}

export async function readRunTrace({
  thread_id,
  run_id
}: RunReadParams): Promise<TraceReadResponse> {
  const run = await ORM.em.getRepository(Run).findOneOrFail({
    id: run_id,
    thread: thread_id
  });

  if (!run.trace) {
    throw new APIError({
      message: `The trace does not exist`,
      code: APIErrorCode.NOT_FOUND
    });
  }

  const runSteps = await ORM.em.getRepository(RunStep).find(
    {
      run: run_id,
      // I cast to any because of ts problem with $in[....]
      details: {
        type: { $in: [RunStepDetailsType.MESSAGE_CREATION, RunStepDetailsType.TOOL_CALLS] as any[] }
      },
      event: { $ne: null }
    },
    {
      orderBy: { createdAt: QueryOrder.ASC },
      limit: 100 // safe check: we will not load a large amount of steps
    }
  );

  // double check that each step has event
  const runStepsWithEvent = runSteps.filter(
    (step: RunStep): step is RunStepWithEvent => !!step.event
  );

  return toTraceDto(run.trace, { runSteps: runStepsWithEvent });
}

export async function listRuns({
  thread_id,
  limit,
  after,
  before,
  order,
  order_by,
  ...rest
}: RunsListParams & RunsListQuery): Promise<RunsListResponse> {
  const where: FilterQuery<Run> = { thread: thread_id };
  const ids = rest['ids[]'];
  if (ids) {
    where.id = { $in: ids };
  }
  const repo = ORM.em.getRepository(Run);
  const cursor = await getListCursor<Run>(where, { limit, order, order_by, after, before }, repo);
  return createPaginatedResponse(cursor, toRunDto);
}

export async function cancelRun({
  thread_id,
  run_id
}: RunCancelParams): Promise<RunCancelResponse> {
  const run = await ORM.em.getRepository(Run).findOneOrFail({
    id: run_id,
    thread: thread_id
  });
  if (run.status !== RunStatus.IN_PROGRESS && run.status !== RunStatus.REQUIRES_ACTION)
    throw new APIError({
      message: 'Only progressing or waiting runs can be cancelled',
      code: APIErrorCode.INVALID_INPUT
    });

  run.startCancel();
  await ORM.em.flush();
  await createPublisher(run)({ event: 'thread.run.cancelling', data: toRunDto(run) });
  return toRunDto(run);
}

export async function submitToolOutput({
  thread_id,
  run_id,
  tool_outputs,
  stream
}: RunSubmitToolOutputsParams &
  RunSubmitToolOutputsBody): Promise<RunSubmitToolOutputsResponse | void> {
  const run = await ORM.em.getRepository(Run).findOneOrFail({ id: run_id, thread: thread_id });

  if (
    run.status !== RunStatus.REQUIRES_ACTION ||
    !run.requiredAction ||
    run.requiredAction?.type !== RequiredActionType.OUTPUT
  )
    throw new APIError({
      message: 'No tool output is required for the run',
      code: APIErrorCode.INVALID_INPUT
    });

  const suppliedToolCalls = tool_outputs.map(({ tool_call_id, output }) => {
    const toolCall = run.requiredAction?.toolCalls.find(({ id }) => id === tool_call_id);
    if (!toolCall)
      throw new APIError({
        message: `Unexpected tool call ${tool_call_id}`,
        code: APIErrorCode.INVALID_INPUT
      });
    return { toolCall, output };
  });
  if (suppliedToolCalls.length < run.requiredAction.toolCalls.length)
    throw new APIError({
      message: 'Missing tool calls',
      code: APIErrorCode.INVALID_INPUT
    });

  const submit = async () => {
    await Promise.all(
      suppliedToolCalls.map(({ toolCall, output }) => {
        switch (toolCall.type) {
          case ToolType.FUNCTION:
            return FunctionTool.submit(output, { run, toolCallId: toolCall.id });
          default:
            throw new Error('Unexpected tool call type');
        }
      })
    );
  };

  return continueRun({ stream, run, submit });
}

export function createApproveChannel(run: Run, toolCall: ToolCall) {
  return `run:${run.id}:call:${toolCall.id}:approve`;
}

export async function submitToolApproval({
  thread_id,
  run_id,
  tool_approvals,
  stream
}: RunSubmitToolApprovalsParams &
  RunSubmitToolApprovalsBody): Promise<RunSubmitToolApprovalsResponse | void> {
  const run = await ORM.em.getRepository(Run).findOneOrFail({ id: run_id, thread: thread_id });

  if (
    run.status !== RunStatus.REQUIRES_ACTION ||
    !run.requiredAction ||
    run.requiredAction?.type !== RequiredActionType.APPROVE
  )
    throw new APIError({
      message: 'No approval is required for the run',
      code: APIErrorCode.INVALID_INPUT
    });

  const suppliedToolCalls = tool_approvals.map(({ tool_call_id, approve }) => {
    const toolCall = run.requiredAction?.toolCalls.find(({ id }) => id === tool_call_id);
    if (!toolCall)
      throw new APIError({
        message: `Unexpected tool call ${tool_call_id}`,
        code: APIErrorCode.INVALID_INPUT
      });
    return { toolCall, approve };
  });
  if (suppliedToolCalls.length < run.requiredAction.toolCalls.length)
    throw new APIError({
      message: 'Missing tool calls',
      code: APIErrorCode.INVALID_INPUT
    });

  const redisClient = createClient();
  const submit = async () => {
    await Promise.all(
      suppliedToolCalls.map(({ toolCall, approve }) => {
        redisClient.publish(createApproveChannel(run, toolCall), approve.toString());
      })
    );
  };

  return continueRun({ stream, run, submit });
}

async function continueRun({
  stream,
  run,
  submit
}: {
  stream: boolean | null | undefined;
  run: Run;
  submit: () => Promise<void>;
}) {
  if (stream) {
    const req = ensureRequestContextData('req');
    const res = ensureRequestContextData('res');
    const controller = new AbortController();
    const unsub = listenToSocketClose(req.socket, () => controller.abort());
    try {
      await subscribeAndForward(run, res, {
        signal: controller.signal,
        onReady: submit,
        onFailed: submit
      });
    } finally {
      unsub();
    }
  } else {
    await submit();
    return toRunDto(run);
  }
}
