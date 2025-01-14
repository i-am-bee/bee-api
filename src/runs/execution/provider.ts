import { ChatLLM, ChatLLMOutput } from 'bee-agent-framework/llms/chat';
import { LLM, LLMInput } from 'bee-agent-framework/llms/llm';
import { BaseLLMOutput, EmbeddingOptions, EmbeddingOutput } from 'bee-agent-framework/llms/base';
import { OllamaChatLLM } from 'bee-agent-framework/adapters/ollama/chat';
import { OllamaLLM } from 'bee-agent-framework/adapters/ollama/llm';
import { Ollama } from 'ollama';
import { OpenAIChatLLM } from 'bee-agent-framework/adapters/openai/chat';
import { OpenAI } from 'openai';
import { BaseMessage } from 'bee-agent-framework/llms/primitives/message';
import { IBMVllmChatLLM } from 'bee-agent-framework/adapters/ibm-vllm/chat';
import { IBMvLLM } from 'bee-agent-framework/adapters/ibm-vllm/llm';
import { Client as IBMvLLMClient } from 'bee-agent-framework/adapters/ibm-vllm/client';
import {
  IBMVllmChatLLMPresetModel,
  IBMVllmModel
} from 'bee-agent-framework/adapters/ibm-vllm/chatPreset';
import { WatsonXChatLLM } from 'bee-agent-framework/adapters/watsonx/chat';
import { WatsonXChatLLMPresetModel } from 'bee-agent-framework/adapters/watsonx/chatPreset';
import { WatsonXLLM } from 'bee-agent-framework/adapters/watsonx/llm';

import {
  AI_BACKEND,
  IBM_VLLM_CERT_CHAIN,
  IBM_VLLM_PRIVATE_KEY,
  IBM_VLLM_ROOT_CERT,
  IBM_VLLM_URL,
  OLLAMA_URL,
  OPENAI_API_KEY,
  WATSONX_API_KEY,
  WATSONX_PROJECT_ID,
  WATSONX_REGION
} from '@/config';
import { AIBackend } from '@/runs/execution/constants';

const MAX_NEW_TOKENS = 4096;

type ChatLLMParams = { model?: string; topP?: number; temperature?: number };

interface EmbeddingModel {
  modelId: string;
  embed(input: LLMInput[], options?: EmbeddingOptions): Promise<EmbeddingOutput>;
}

interface AIProvider<
  ChatLLMType extends ChatLLM<ChatLLMOutput>,
  LLMType extends LLM<BaseLLMOutput> = any
> {
  createChatBackend: (params?: ChatLLMParams) => ChatLLMType;
  createAssistantBackend: (params?: ChatLLMParams) => ChatLLMType;
  createCodeBackend: (params?: { model?: string }) => LLMType | void;
  createEmbeddingBackend?: (params?: { model?: string }) => EmbeddingModel;
}

export class OllamaAIProvider implements AIProvider<OllamaChatLLM, OllamaLLM> {
  static client: Ollama;

  constructor() {
    OllamaAIProvider.client ??= new Ollama({ host: OLLAMA_URL ?? undefined });
  }

  createChatBackend({ model: modelId = 'llama3.1', ...params }: ChatLLMParams = {}) {
    return new OllamaChatLLM({
      client: OllamaAIProvider.client,
      modelId,
      parameters: {
        top_p: params.topP,
        temperature: params.temperature,
        num_predict: MAX_NEW_TOKENS
      }
    });
  }
  createAssistantBackend(params?: ChatLLMParams) {
    return this.createChatBackend(params);
  }

  createCodeBackend() {}

  createEmbeddingBackend({ model: modelId = 'nomic-embed-text' } = {}) {
    return new OllamaLLM({ client: OllamaAIProvider.client, modelId });
  }
}

export class OpenAIProvider implements AIProvider<OpenAIChatLLM> {
  static client: OpenAI;
  constructor() {
    OpenAIProvider.client ??= new OpenAI({ apiKey: OPENAI_API_KEY ?? undefined });
  }

  createChatBackend({ model = 'gpt-4o', ...params }: ChatLLMParams = {}) {
    return new OpenAIChatLLM({
      client: OpenAIProvider.client,
      modelId: model as OpenAI.ChatModel,
      parameters: {
        top_p: params.topP,
        temperature: params.temperature,
        max_completion_tokens: MAX_NEW_TOKENS
      }
    });
  }

  createAssistantBackend(params?: ChatLLMParams) {
    return this.createChatBackend(params);
  }

  createCodeBackend() {}

  createEmbeddingBackend({ model = 'text-embedding-3-large' } = {}) {
    return {
      chatLLM: new OpenAIChatLLM({
        client: OpenAIProvider.client,
        modelId: model as OpenAI.ChatModel
      }),
      modelId: model,
      embed(input: LLMInput[], options?: EmbeddingOptions) {
        return this.chatLLM.embed(
          [input.map((text) => BaseMessage.of({ role: 'assistant', text }))],
          options
        );
      }
    };
  }
}

export class IBMvLLMAIProvider implements AIProvider<IBMVllmChatLLM, IBMvLLM> {
  static client: IBMvLLMClient;

  constructor() {
    IBMvLLMAIProvider.client ??= new IBMvLLMClient({
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
  }

  createChatBackend({
    model = IBMVllmModel.LLAMA_3_1_70B_INSTRUCT,
    ...params
  }: ChatLLMParams = {}) {
    return IBMVllmChatLLM.fromPreset(model as IBMVllmChatLLMPresetModel, {
      client: IBMvLLMAIProvider.client,
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

  createAssistantBackend(params?: ChatLLMParams) {
    return this.createChatBackend(params);
  }

  createCodeBackend({ model: modelId = 'meta-llama/llama-3-1-70b-instruct' } = {}) {
    return new IBMvLLM({
      client: IBMvLLMAIProvider.client,
      modelId,
      parameters: {
        method: 'GREEDY',
        stopping: { include_stop_sequence: false, max_new_tokens: MAX_NEW_TOKENS }
      }
    });
  }

  createEmbeddingBackend({ model: modelId = 'baai/bge-large-en-v1.5' } = {}) {
    return new IBMvLLM({ client: IBMvLLMAIProvider.client, modelId });
  }
}

export class WatsonxAIProvider implements AIProvider<WatsonXChatLLM, WatsonXLLM> {
  get credentials() {
    if (!WATSONX_API_KEY) throw new Error('Missing WATSONX_API_KEY');
    if (!WATSONX_PROJECT_ID) throw new Error('Missing WATSONX_PROJECT_ID');
    return {
      apiKey: WATSONX_API_KEY,
      projectId: WATSONX_PROJECT_ID,
      region: WATSONX_REGION ?? undefined
    };
  }

  createChatBackend({
    model = 'meta-llama/llama-3-1-70b-instruct',
    ...params
  }: ChatLLMParams = {}) {
    return WatsonXChatLLM.fromPreset(model as WatsonXChatLLMPresetModel, {
      ...this.credentials,
      parameters: (parameters) => ({
        ...parameters,
        top_p: params.topP ?? parameters.top_p,
        temperature: params.temperature ?? parameters.temperature,
        max_new_tokens: MAX_NEW_TOKENS
      })
    });
  }

  createAssistantBackend(params?: ChatLLMParams) {
    return this.createChatBackend(params);
  }

  createCodeBackend({ model: modelId = 'meta-llama/llama-3-1-70b-instruct' } = {}) {
    return new WatsonXLLM({
      ...this.credentials,
      modelId,
      parameters: {
        decoding_method: 'greedy',
        include_stop_sequence: false,
        max_new_tokens: MAX_NEW_TOKENS
      }
    });
  }

  createEmbeddingBackend({ model: modelId = 'ibm/slate-30m-english-rtrvr-v2' } = {}) {
    return new WatsonXLLM({ ...this.credentials, modelId, region: WATSONX_REGION ?? undefined });
  }
}

export const aiProviderByBackend = {
  [AIBackend.OLLAMA]: OllamaAIProvider,
  [AIBackend.IBM_VLLM]: IBMvLLMAIProvider,
  [AIBackend.OPENAI]: OpenAIProvider,
  [AIBackend.WATSONX]: WatsonxAIProvider
};

export const defaultAIProvider = new aiProviderByBackend[AI_BACKEND]();
