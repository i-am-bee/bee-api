import { BaseMessage } from 'bee-agent-framework/llms/primitives/message';
import { LLMError } from 'bee-agent-framework/llms/base';
import dayjs from 'dayjs';

import {
  ChatCompletionCreateBody,
  ChatCompletionCreateResponse
} from './dtos/chat-completion-create';
import { ChatMessageRole } from './constants';

import { createChatLLM, getDefaultModel } from '@/runs/execution/factory';
import { getLogger } from '@/logger';
import { APIError, APIErrorCode } from '@/errors/error.entity';
import { generatePrefixedObjectId } from '@/utils/id';

const getChatLogger = () => getLogger();

export async function createChatCompletion({
  model = getDefaultModel(),
  messages
}: ChatCompletionCreateBody): Promise<ChatCompletionCreateResponse> {
  const llm = createChatLLM({ model });
  try {
    const output = await llm.generate(
      messages.map(({ role, content }) => BaseMessage.of({ role, text: content }))
    );
    return {
      id: generatePrefixedObjectId('chatcmpl'),
      object: 'chat.completion',
      created: dayjs().unix(),
      model,
      choices: output.messages.map((message, index) => {
        if (message.role !== ChatMessageRole.ASSISTANT)
          throw new LLMError(`Unexpected message role ${message.role}`);
        return {
          index,
          message: { role: message.role, content: message.text }
        };
      })
    };
  } catch (err) {
    getChatLogger().error({ err }, 'LLM generation failed');
    if (err instanceof LLMError) {
      throw new APIError({ code: APIErrorCode.SERVICE_ERROR, message: err.message });
    }
    throw err;
  }
}
