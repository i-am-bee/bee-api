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

import { ZodType } from 'zod';
import { PromptTemplate } from 'bee-agent-framework';
import { AnyTool } from 'bee-agent-framework/tools/base';
import { StreamlitAgent } from 'bee-agent-framework/agents/experimental/streamlit/agent';
import { BeeAgent } from 'bee-agent-framework/agents/bee/agent';
import { BeeSystemPrompt } from 'bee-agent-framework/agents/bee/prompts';
import { ChatLLM, ChatLLMOutput } from 'bee-agent-framework/llms/chat';
import { BaseMemory } from 'bee-agent-framework/memory/base';
import { StreamlitAgentSystemPrompt } from 'bee-agent-framework/agents/experimental/streamlit/prompts';
import { GraniteBeeSystemPrompt } from 'bee-agent-framework/agents/bee/runners/granite/prompts';
import { Loaded } from '@mikro-orm/core';

import { Run } from '../entities/run.entity';

import { Agent } from './constants';
import {
  createBeeStreamingHandler,
  createStreamlitStreamingHandler
} from './event-handlers/streaming';
import { AgentContext } from './execute';

export function createAgentRun(
  run: Loaded<Run, 'assistant'>,
  { llm, tools, memory }: { llm: ChatLLM<ChatLLMOutput>; tools: AnyTool[]; memory: BaseMemory },
  { signal, ctx }: { signal: AbortSignal; ctx: AgentContext }
) {
  const runArgs = [
    { prompt: null }, // messages have been loaded to agent's memory
    {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      signal,
      execution: {
        totalMaxRetries: 10,
        maxRetriesPerStep: 3,
        maxIterations: 10
      }
    }
  ] as const;
  switch (run.assistant.$.agent) {
    case Agent.BEE: {
      const agent = new BeeAgent({
        llm,
        memory,
        tools,
        templates: {
          system: getPromptTemplate(
            run,
            run.model.includes('granite') ? GraniteBeeSystemPrompt : BeeSystemPrompt
          )
        }
      });
      return [agent.run(...runArgs).observe(createBeeStreamingHandler(ctx)), agent];
    }
    case Agent.STREAMLIT: {
      const agent = new StreamlitAgent({
        llm,
        memory,
        templates: { system: getPromptTemplate(run, StreamlitAgentSystemPrompt) }
      });
      return [agent.run(...runArgs).observe(createStreamlitStreamingHandler(ctx)), agent];
    }
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
