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

import { FastifyPluginAsyncJsonSchemaToTs } from '@fastify/type-provider-json-schema-to-ts';
import { StatusCodes } from 'http-status-codes';

import {
  RunCreateBody,
  RunCreateParams,
  runCreateBodySchema,
  runCreateParamsSchema,
  runCreateResponseSchema,
  runCreateStreamSchema
} from './dtos/run-create.js';
import {
  cancelRun,
  createRun,
  createThreadRun,
  listRuns,
  readRun,
  readRunTrace,
  submitToolApproval,
  submitToolInputs,
  submitToolOutput,
  updateRun
} from './runs.service.js';
import { RunReadParams, runReadParamsSchema, runReadResponseSchema } from './dtos/run-read.js';
import {
  RunsListParams,
  RunsListQuery,
  runsListParamsSchema,
  runsListQuerySchema,
  runsListResponseSchema
} from './dtos/runs-list.js';
import {
  RunCancelParams,
  runCancelParamsSchema,
  runCancelResponseSchema
} from './dtos/run-cancel.js';
import {
  ThreadRunCreateBody,
  threadRunCreateBodySchema,
  threadRunCreateResponseSchema,
  threadRunCreateStreamSchema
} from './dtos/thread-run-create.js';
import { traceReadParamsSchema, traceReadResponseSchema } from './dtos/trace-read.js';
import {
  RunSubmitToolOutputsBody,
  RunSubmitToolOutputsParams,
  runSubmitToolOutputsBodySchema,
  runSubmitToolOutputsParamsSchema,
  runSubmitToolOutputsResponseSchema,
  runSubmitToolOutputsStreamSchema
} from './dtos/run-submit-tool-outputs.js';
import {
  RunUpdateBody,
  runUpdateBodySchema,
  RunUpdateParams,
  runUpdateParamsSchema,
  runUpdateResponseSchema
} from './dtos/run-update.js';
import {
  RunSubmitToolApprovalsBody,
  runSubmitToolApprovalsBodySchema,
  RunSubmitToolApprovalsParams,
  runSubmitToolApprovalsParamsSchema,
  runSubmitToolApprovalsResponseSchema,
  runSubmitToolApprovalsStreamSchema
} from './dtos/run-submit-tool-approvals.js';
import {
  runSubmitToolInputsBodySchema,
  RunSubmitToolInputsParams,
  runSubmitToolInputsParamsSchema,
  RunSubmitToolInputsBody,
  runSubmitToolInputsResponseSchema,
  runSubmitToolInputsStreamSchema
} from './dtos/run-submit-tool-inputs.js';

import { Tag } from '@/swagger.js';

export const runsModule: FastifyPluginAsyncJsonSchemaToTs = async (app) => {
  app.post<{ Params: RunCreateParams; Body: RunCreateBody }>(
    '/threads/:thread_id/runs',
    {
      schema: {
        params: runCreateParamsSchema,
        body: runCreateBodySchema,
        response: {
          [StatusCodes.OK]: {
            content: {
              'application/json': { schema: runCreateResponseSchema },
              'text/event-stream': { schema: runCreateStreamSchema }
            }
          }
        },
        tags: [Tag.OPENAI_ASSISTANTS_API]
      },
      preHandler: app.auth(),
      config: {
        rateLimit: {
          max: 26 // global rate limit +1 for the UI
        }
      }
    },
    async (req) => createRun({ ...req.params, ...req.body })
  );

  app.post<{ Body: ThreadRunCreateBody }>(
    '/threads/runs',
    {
      schema: {
        body: threadRunCreateBodySchema,
        response: {
          [StatusCodes.OK]: {
            content: {
              'application/json': { schema: threadRunCreateResponseSchema },
              'text/event-stream': { schema: threadRunCreateStreamSchema }
            }
          }
        },
        tags: [Tag.OPENAI_ASSISTANTS_API]
      },
      preHandler: app.auth(),
      config: {
        rateLimit: {
          max: 26 // global rate limit +1 for the UI
        }
      }
    },
    async (req) => createThreadRun(req.body)
  );

  app.get<{ Params: RunReadParams }>(
    '/threads/:thread_id/runs/:run_id',
    {
      schema: {
        params: runReadParamsSchema,
        response: { [StatusCodes.OK]: runReadResponseSchema },
        tags: [Tag.OPENAI_ASSISTANTS_API]
      },
      preHandler: app.auth()
    },
    async (req) => {
      return readRun(req.params);
    }
  );

  app.post<{ Params: RunUpdateParams; Body: RunUpdateBody }>(
    '/threads/:thread_id/runs/:run_id',
    {
      schema: {
        params: runUpdateParamsSchema,
        body: runUpdateBodySchema,
        response: { [StatusCodes.OK]: runUpdateResponseSchema },
        tags: [Tag.OPENAI_ASSISTANTS_API]
      },
      preHandler: app.auth()
    },
    async (req) => {
      return updateRun({ ...req.params, ...req.body });
    }
  );

  app.get<{ Params: RunReadParams }>(
    '/threads/:thread_id/runs/:run_id/trace',
    {
      schema: {
        params: traceReadParamsSchema,
        response: { [StatusCodes.OK]: traceReadResponseSchema },
        tags: [Tag.BEE_API]
      },
      preHandler: app.auth()
    },
    async (req) => {
      return readRunTrace(req.params);
    }
  );

  app.get<{ Params: RunsListParams; Querystring: RunsListQuery }>(
    '/threads/:thread_id/runs',
    {
      schema: {
        params: runsListParamsSchema,
        querystring: runsListQuerySchema,
        response: { [StatusCodes.OK]: runsListResponseSchema },
        tags: [Tag.OPENAI_ASSISTANTS_API]
      },
      preHandler: app.auth()
    },
    async (req) => {
      return listRuns({ ...req.params, ...req.query });
    }
  );

  app.post<{ Params: RunCancelParams }>(
    '/threads/:thread_id/runs/:run_id/cancel',
    {
      schema: {
        params: runCancelParamsSchema,
        response: { [StatusCodes.OK]: runCancelResponseSchema },
        tags: [Tag.OPENAI_ASSISTANTS_API]
      },
      preHandler: app.auth()
    },
    async (req) => {
      return cancelRun(req.params);
    }
  );

  app.post<{ Params: RunSubmitToolOutputsParams; Body: RunSubmitToolOutputsBody }>(
    '/threads/:thread_id/runs/:run_id/submit_tool_outputs',
    {
      schema: {
        params: runSubmitToolOutputsParamsSchema,
        body: runSubmitToolOutputsBodySchema,
        response: {
          [StatusCodes.OK]: {
            content: {
              'application/json': { schema: runSubmitToolOutputsResponseSchema },
              'text/event-stream': { schema: runSubmitToolOutputsStreamSchema }
            }
          }
        },
        tags: [Tag.OPENAI_ASSISTANTS_API]
      },
      preHandler: app.auth(),
      config: {
        rateLimit: {
          max: 26 // global rate limit +1 for the UI
        }
      }
    },
    async (req) => submitToolOutput({ ...req.params, ...req.body })
  );

  app.post<{ Params: RunSubmitToolApprovalsParams; Body: RunSubmitToolApprovalsBody }>(
    '/threads/:thread_id/runs/:run_id/submit_tool_approvals',
    {
      schema: {
        params: runSubmitToolApprovalsParamsSchema,
        body: runSubmitToolApprovalsBodySchema,
        response: {
          [StatusCodes.OK]: {
            content: {
              'application/json': { schema: runSubmitToolApprovalsResponseSchema },
              'text/event-stream': { schema: runSubmitToolApprovalsStreamSchema }
            }
          }
        },
        tags: [Tag.BEE_API]
      },
      preHandler: app.auth(),
      config: {
        rateLimit: {
          max: 26 // global rate limit +1 for the UI
        }
      }
    },
    async (req) => submitToolApproval({ ...req.params, ...req.body })
  );

  app.post<{ Params: RunSubmitToolInputsParams; Body: RunSubmitToolInputsBody }>(
    '/threads/:thread_id/runs/:run_id/submit_tool_inputs',
    {
      schema: {
        params: runSubmitToolInputsParamsSchema,
        body: runSubmitToolInputsBodySchema,
        response: {
          [StatusCodes.OK]: {
            content: {
              'application/json': { schema: runSubmitToolInputsResponseSchema },
              'text/event-stream': { schema: runSubmitToolInputsStreamSchema }
            }
          }
        },
        tags: [Tag.BEE_API]
      },
      preHandler: app.auth(),
      config: {
        rateLimit: {
          max: 26 // global rate limit +1 for the UI
        }
      }
    },
    async (req) => submitToolInputs({ ...req.params, ...req.body })
  );
};
