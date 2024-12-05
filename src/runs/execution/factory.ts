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

import { Ollama } from 'ollama';
import { OpenAI } from 'openai';
import { Client as BAMClient } from '@ibm-generative-ai/node-sdk';
import { Client as IBMvLLLClient } from 'bee-agent-framework/adapters/ibm-vllm/client';
import { IBMVllmChatLLM } from 'bee-agent-framework/adapters/ibm-vllm/chat';
import { OllamaChatLLM } from 'bee-agent-framework/adapters/ollama/chat';
import { OpenAIChatLLM } from 'bee-agent-framework/adapters/openai/chat';
import {
  IBMVllmChatLLMPresetModel,
  IBMVllmModel
} from 'bee-agent-framework/adapters/ibm-vllm/chatPreset';
import { BAMChatLLMPresetModel } from 'bee-agent-framework/adapters/bam/chatPreset';
import { BAMChatLLM } from 'bee-agent-framework/adapters/bam/chat';
import { WatsonXChatLLM } from 'bee-agent-framework/adapters/watsonx/chat';
import { WatsonXChatLLMPresetModel } from 'bee-agent-framework/adapters/watsonx/chatPreset';
import { BAMLLM } from 'bee-agent-framework/adapters/bam/llm';
import { IBMvLLM } from 'bee-agent-framework/adapters/ibm-vllm/llm';
import { WatsonXLLM } from 'bee-agent-framework/adapters/watsonx/llm';
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

import { Agent, LLMBackend } from './constants';
import {
  createBeeStreamingHandler,
  createStreamlitStreamingHandler
} from './event-handlers/streaming';
import { AgentContext } from './execute';

import {
  BAM_API_KEY,
  IBM_VLLM_CERT_CHAIN,
  IBM_VLLM_PRIVATE_KEY,
  IBM_VLLM_ROOT_CERT,
  IBM_VLLM_URL,
  LLM_BACKEND,
  OLLAMA_URL,
  OPENAI_API_KEY,
  WATSONX_API_KEY,
  WATSONX_PROJECT_ID,
  WATSONX_REGION
} from '@/config';

const MAX_NEW_TOKENS = 4096;

export function getDefaultModel(backend: LLMBackend = LLM_BACKEND) {
  switch (backend) {
    case LLMBackend.IBM_VLLM:
      return IBMVllmModel.LLAMA_3_1_70B_INSTRUCT;
    case LLMBackend.OLLAMA:
      return 'llama3.1';
    case LLMBackend.OPENAI:
      return 'gpt-4o';
    case LLMBackend.BAM:
      return 'meta-llama/llama-3-1-70b-instruct';
    case LLMBackend.WATSONX:
      return 'meta-llama/llama-3-1-70b-instruct';
  }
}

// Clients are instantiated lazily in createLLM funciton
let vllmClient: IBMvLLLClient | null;
let ollamaClient: Ollama | null;
let openAIClient: OpenAI | null;
let bamClient: BAMClient | null;

export function createChatLLM(
  params: { model: string; topP?: number; temperature?: number },
  backend: LLMBackend = LLM_BACKEND
) {
  switch (backend) {
    case LLMBackend.IBM_VLLM: {
      vllmClient ??= new IBMvLLLClient({
        url: IBM_VLLM_URL ?? undefined,
        credentials:
          IBM_VLLM_ROOT_CERT && IBM_VLLM_CERT_CHAIN && IBM_VLLM_PRIVATE_KEY
            ? {
                rootCert: IBM_VLLM_ROOT_CERT,
                certChain: IBM_VLLM_CERT_CHAIN,
                privateKey: IBM_VLLM_PRIVATE_KEY
              }
            : undefined
      });
      return IBMVllmChatLLM.fromPreset(params.model as IBMVllmChatLLMPresetModel, {
        client: vllmClient,
        parameters: (parameters) => ({
          ...parameters,
          sampling: {
            ...parameters.sampling,
            top_p: params.topP ?? parameters.sampling?.top_p,
            temperature: params.temperature ?? parameters.sampling?.temperature
          },
          stopping: {
            ...parameters.stopping,
            max_new_tokens: MAX_NEW_TOKENS
          }
        })
      });
    }
    case LLMBackend.OLLAMA: {
      ollamaClient ??= new Ollama({ host: OLLAMA_URL ?? undefined });
      return new OllamaChatLLM({
        client: ollamaClient,
        modelId: params.model,
        parameters: {
          top_p: params.topP,
          temperature: params.temperature,
          num_predict: MAX_NEW_TOKENS
        }
      });
    }
    case LLMBackend.OPENAI: {
      openAIClient ??= new OpenAI({ apiKey: OPENAI_API_KEY ?? undefined });
      return new OpenAIChatLLM({
        client: openAIClient,
        modelId: params.model as OpenAI.ChatModel,
        parameters: {
          top_p: params.topP,
          temperature: params.temperature,
          max_completion_tokens: MAX_NEW_TOKENS
        }
      });
    }
    case LLMBackend.BAM: {
      bamClient ??= new BAMClient({ apiKey: BAM_API_KEY ?? undefined });
      return BAMChatLLM.fromPreset(params.model as BAMChatLLMPresetModel, {
        client: bamClient,
        parameters: (parameters) => ({
          ...parameters,
          top_p: params.topP ?? parameters.top_p,
          temperature: params.temperature ?? parameters.temperature,
          max_new_tokens: MAX_NEW_TOKENS
        })
      });
    }
    case LLMBackend.WATSONX: {
      if (!WATSONX_API_KEY) throw new Error('Missing WATSONX_API_KEY');
      if (!WATSONX_PROJECT_ID) throw new Error('Missing WATSONX_PROJECT_ID');
      return WatsonXChatLLM.fromPreset(params.model as WatsonXChatLLMPresetModel, {
        apiKey: WATSONX_API_KEY,
        projectId: WATSONX_PROJECT_ID,
        region: WATSONX_REGION ?? undefined,
        parameters: (parameters) => ({
          ...parameters,
          top_p: params.topP ?? parameters.top_p,
          temperature: params.temperature ?? parameters.temperature,
          max_new_tokens: MAX_NEW_TOKENS
        })
      });
    }
  }
}

// TODO make lazy client init DRY

export function createCodeLLM(backend: LLMBackend = LLM_BACKEND) {
  switch (backend) {
    case LLMBackend.IBM_VLLM: {
      vllmClient ??= new IBMvLLLClient({
        url: IBM_VLLM_URL ?? undefined,
        credentials:
          IBM_VLLM_ROOT_CERT && IBM_VLLM_CERT_CHAIN && IBM_VLLM_PRIVATE_KEY
            ? {
                rootCert: IBM_VLLM_ROOT_CERT,
                certChain: IBM_VLLM_CERT_CHAIN,
                privateKey: IBM_VLLM_PRIVATE_KEY
              }
            : undefined
      });
      return new IBMvLLM({
        client: vllmClient,
        modelId: 'meta-llama/llama-3-1-70b-instruct',
        parameters: {
          method: 'GREEDY',
          stopping: { include_stop_sequence: false, max_new_tokens: MAX_NEW_TOKENS }
        }
      });
    }
    case LLMBackend.BAM: {
      bamClient ??= new BAMClient({ apiKey: BAM_API_KEY ?? undefined });
      return new BAMLLM({
        client: bamClient,
        modelId: 'meta-llama/llama-3-1-70b-instruct',
        parameters: {
          decoding_method: 'greedy',
          include_stop_sequence: false,
          max_new_tokens: MAX_NEW_TOKENS
        }
      });
    }
    case LLMBackend.WATSONX: {
      if (!WATSONX_API_KEY) throw new Error('Missing WATSONX_API_KEY');
      if (!WATSONX_PROJECT_ID) throw new Error('Missing WATSONX_PROJECT_ID');
      return new WatsonXLLM({
        modelId: 'meta-llama/llama-3-1-70b-instruct',
        apiKey: WATSONX_API_KEY,
        projectId: WATSONX_PROJECT_ID,
        region: WATSONX_REGION ?? undefined,
        parameters: {
          decoding_method: 'greedy',
          include_stop_sequence: false,
          max_new_tokens: MAX_NEW_TOKENS
        }
      });
    }
    default:
      return undefined;
  }
}

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
