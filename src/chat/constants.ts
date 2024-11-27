export const ChatMessageRole = {
  SYSTEM: 'system',
  USER: 'user',
  ASSISTANT: 'assistant'
} as const;
export type ChatMessageRole = (typeof ChatMessageRole)[keyof typeof ChatMessageRole];
