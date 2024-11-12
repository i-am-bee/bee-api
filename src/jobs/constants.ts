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

export const QueueName = {
  RUNS: 'runs',
  RUNS_CLEANUP: 'runs:cleanup',
  THREADS_CLEANUP: 'threads:cleanup',
  VECTOR_STORES_CLEANUP: 'vectorStores:cleanup',
  VECTOR_STORES_FILE_PROCESSOR: 'vectorStores:fileProcessor',
  FILES_EXTRACTION_NODE: 'files:extraction:node',
  FILES_EXTRACTION_PYTHON: 'files:extraction:python',
  FILES_CLEANUP: 'files:cleanup'
} as const;
export type QueueName = (typeof QueueName)[keyof typeof QueueName];
