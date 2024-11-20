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

export const RUN_EXPIRATION_MILLISECONDS = 10 * 60 * 1000;
export const STATUS_POLL_INTERVAL = 5 * 1000;

export const Agent = {
  BEE: 'bee',
  STREAMLIT: 'streamlit'
} as const;
export type Agent = (typeof Agent)[keyof typeof Agent];

export const LLMBackend = {
  OLLAMA: 'ollama',
  IBM_VLLM: 'ibm-vllm',
  OPENAI: 'openai',
  BAM: 'bam',
  WATSONX: 'watsonx'
} as const;
export type LLMBackend = (typeof LLMBackend)[keyof typeof LLMBackend];

export const CodeInterpreterStorageBackend = {
  S3: 's3',
  FILESYSTEM: 'filesystem'
} as const;
export type CodeInterpreterStorageBackend = (typeof LLMBackend)[keyof typeof LLMBackend];

export const SearchToolBackend = {
  GOOGLE: 'google',
  DUCK_DUCK_GO: 'duck-duck-go'
} as const;
export type SearchToolBackend = (typeof SearchToolBackend)[keyof typeof SearchToolBackend];
