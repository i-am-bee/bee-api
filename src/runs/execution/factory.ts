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

import { Run } from '../entities/run.entity';

import { LLMBackend } from './constants';

import {
  GENAI_API_KEY,
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

export function createChatLLM(run: Loaded<Run>, backend: LLMBackend = LLM_BACKEND) {
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
      return IBMVllmChatLLM.fromPreset(run.model as IBMVllmChatLLMPresetModel, {
        client: vllmClient,
        parameters: (parameters) => ({
          ...parameters,
          sampling: {
            ...parameters.sampling,
            top_p: run.topP ?? parameters.sampling?.top_p,
            temperature: run.temperature ?? parameters.sampling?.temperature
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
        modelId: run.model,
        parameters: {
          top_p: run.topP,
          temperature: run.temperature,
          num_predict: MAX_NEW_TOKENS
        }
      });
    }
    case LLMBackend.OPENAI: {
      openAIClient ??= new OpenAI({ apiKey: OPENAI_API_KEY ?? undefined });
      return new OpenAIChatLLM({
        client: openAIClient,
        modelId: run.model as OpenAI.ChatModel,
        parameters: {
          top_p: run.topP,
          temperature: run.temperature,
          max_completion_tokens: MAX_NEW_TOKENS
        }
      });
    }
    case LLMBackend.BAM: {
      bamClient ??= new BAMClient({ apiKey: GENAI_API_KEY ?? undefined });
      return BAMChatLLM.fromPreset(run.model as BAMChatLLMPresetModel, {
        client: bamClient,
        parameters: (parameters) => ({
          ...parameters,
          top_p: run.topP ?? parameters.top_p,
          temperature: run.temperature ?? parameters.temperature,
          max_new_tokens: MAX_NEW_TOKENS
        })
      });
    }
    case LLMBackend.WATSONX: {
      if (!WATSONX_API_KEY) throw new Error('Missing WATSONX_API_KEY');
      if (!WATSONX_PROJECT_ID) throw new Error('Missing WATSONX_PROJECT_ID');
      return WatsonXChatLLM.fromPreset(run.model as WatsonXChatLLMPresetModel, {
        apiKey: WATSONX_API_KEY,
        projectId: WATSONX_PROJECT_ID,
        region: WATSONX_REGION ?? undefined,
        parameters: (parameters) => ({
          ...parameters,
          top_p: run.topP ?? parameters.top_p,
          temperature: run.temperature ?? parameters.temperature,
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
        modelId: 'ibm/granite-34b-code-instruct',
        parameters: {
          method: 'GREEDY',
          stopping: { include_stop_sequence: false, max_new_tokens: MAX_NEW_TOKENS }
        }
      });
    }
    case LLMBackend.BAM: {
      bamClient ??= new BAMClient({ apiKey: GENAI_API_KEY ?? undefined });
      return new BAMLLM({
        client: bamClient,
        modelId: 'ibm/granite-34b-code-instruct',
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
        modelId: 'ibm/granite-34b-code-instruct',
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
