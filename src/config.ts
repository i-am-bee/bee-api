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

import 'dotenv/config';
import { difference } from 'remeda';

import {
  CodeInterpreterStorageBackend,
  LLMBackend,
  SearchToolBackend
} from './runs/execution/constants';
import { EmbeddingBackend } from './embedding/constants';
import { ExtractionBackend } from './files/extraction/constants';

import { QueueName } from '@/jobs/constants.js';

function getEnv(name: keyof typeof process.env): string;
function getEnv(name: keyof typeof process.env, fallback: string): string;
function getEnv(name: keyof typeof process.env, fallback: null): string | null;
function getEnv(name: keyof typeof process.env, fallback?: string | null): string | null {
  const env = process.env[name];
  if (env) return env;
  else if (fallback !== undefined) return fallback;
  else throw new Error(`Missing env ${name}`);
}

function getStringArray<AllowedValues extends string[]>(
  name: keyof typeof process.env,
  allowedValues: AllowedValues,
  fallback?: AllowedValues
): AllowedValues {
  const items = getEnv(name, null)?.split(',') ?? fallback ?? [];
  const unknownValues = difference(items, allowedValues);
  if (unknownValues.length) throw Error(`Unknown items ${unknownValues.join(',')} in ${name}`);
  return items as AllowedValues;
}

function getEnum<T extends string[]>(
  name: keyof typeof process.env,
  allowedValues: T,
  fallback?: T[number]
): T[number] {
  const value = getEnv(name, null) ?? fallback;
  if (!value || !allowedValues.includes(value))
    throw Error(`Invalid enum value ${value} in ${name}`);
  return value as T[number];
}

export const GIT_TAG = getEnv('GIT_TAG', 'dev');

export const PORT = parseInt(getEnv('PORT', '4000'));
export const LOG_LEVEL = getEnv('LOG_LEVEL', 'info');
export const SHUTDOWN_GRACEFUL_PERIOD = parseInt(getEnv('SHUTDOWN_GRACEFUL_PERIOD', '5000'));

export const MONGODB_URL = getEnv('MONGODB_URL');
export const MONGODB_DATABASE_NAME = getEnv('MONGODB_DATABASE_NAME');
export const MONGODB_CA_CERT = getEnv('MONGODB_CA_CERT', null);

export const REDIS_URL = getEnv('REDIS_URL');
export const REDIS_CA_CERT = getEnv('REDIS_CA_CERT', null);
export const REDIS_CACHE_URL = getEnv('REDIS_CACHE_URL');
export const REDIS_CACHE_CA_CERT = getEnv('REDIS_CACHE_CA_CERT', null);

export const AUTH_SERVER_PORT = parseInt(getEnv('AUTH_SERVER_PORT', '0'));
export const AUTH_WELL_KNOWN = getEnv('AUTH_WELL_KNOWN');
export const AUTH_CLIENT_ID = getEnv('AUTH_CLIENT_ID');
export const AUTH_CLIENT_SECRET = getEnv('AUTH_CLIENT_SECRET');
export const AUTH_AUDIENCE = getEnv('AUTH_AUDIENCE');

// Backends
export const LLM_BACKEND = getEnum('LLM_BACKEND', Object.values(LLMBackend));
export const EMBEDDING_BACKEND = getEnum('EMBEDDING_BACKEND', Object.values(EmbeddingBackend));
export const EXTRACTION_BACKEND = getEnum('EXTRACTION_BACKEND', Object.values(ExtractionBackend));

export const OLLAMA_URL = getEnv('OLLAMA_URL', null);

export const IBM_VLLM_URL = getEnv('IBM_VLLM_URL', null);
export const IBM_VLLM_ROOT_CERT = getEnv('IBM_VLLM_ROOT_CERT', null);
export const IBM_VLLM_CERT_CHAIN = getEnv('IBM_VLLM_CERT_CHAIN', null);
export const IBM_VLLM_PRIVATE_KEY = getEnv('IBM_VLLM_PRIVATE_KEY', null);

export const OPENAI_API_KEY = getEnv('OPENAI_API_KEY', null);

export const BAM_API_KEY = getEnv('BAM_API_KEY', null);

export const WATSONX_API_KEY = getEnv('WATSONX_API_KEY', null);
export const WATSONX_PROJECT_ID = getEnv('WATSONX_PROJECT_ID', null);
export const WATSONX_REGION = getEnv('WATSONX_REGION', null);

export const CAIKIT_URL = getEnv('CAIKIT_URL', null);
export const CAIKIT_CA_CERT = getEnv('CAIKIT_CA_CERT', null);
export const CAIKIT_CERT = getEnv('CAIKIT_CERT', null);
export const CAIKIT_KEY = getEnv('CAIKIT_KEY', null);

export const WDU_URL = getEnv('WDU_URL', null);

export const BEE_CODE_INTERPRETER_URL = getEnv('BEE_CODE_INTERPRETER_URL', null);
export const BEE_CODE_INTERPRETER_CA_CERT = getEnv('BEE_CODE_INTERPRETER_CA_CERT', null);
export const BEE_CODE_INTERPRETER_CERT = getEnv('BEE_CODE_INTERPRETER_CERT', null);
export const BEE_CODE_INTERPRETER_KEY = getEnv('BEE_CODE_INTERPRETER_KEY', null);

export const BEE_CODE_INTERPRETER_BUCKET_FILE_STORAGE = getEnv(
  'BEE_CODE_INTERPRETER_BUCKET_FILE_STORAGE',
  null
);

export const BEE_CODE_INTERPRETER_FILE_STORAGE_PATH = getEnv(
  'BEE_CODE_INTERPRETER_FILE_STORAGE_PATH',
  null
);

export const BEE_CODE_INTERPRETER_STORAGE_BACKEND = getEnum(
  'BEE_CODE_INTERPRETER_STORAGE_BACKEND',
  Object.values(CodeInterpreterStorageBackend)
);

export const SEARCH_TOOL_BACKEND = getEnum(
  'SEARCH_TOOL_BACKEND',
  Object.values(SearchToolBackend),
  SearchToolBackend.DUCK_DUCK_GO
);
export const BEE_GOOGLE_SEARCH_API_KEY = getEnv('BEE_GOOGLE_SEARCH_API_KEY', null);
export const BEE_GOOGLE_SEARCH_CSE_ID = getEnv('BEE_GOOGLE_SEARCH_CSE_ID', null);

export const S3_ENDPOINT = getEnv('S3_ENDPOINT');
export const S3_ACCESS_KEY_ID = getEnv('S3_ACCESS_KEY_ID');
export const S3_SECRET_ACCESS_KEY = getEnv('S3_SECRET_ACCESS_KEY');
export const S3_BUCKET_FILE_STORAGE = getEnv('S3_BUCKET_FILE_STORAGE');

export const PROMETHEUS_PUSHGATEWAY_URL = getEnv('PROMETHEUS_PUSHGATEWAY_URL', null);

export const BEE_OBSERVE_API_URL = getEnv('BEE_OBSERVE_API_URL', null);
export const BEE_OBSERVE_API_AUTH_KEY = getEnv('BEE_OBSERVE_API_AUTH_KEY', null);
if (BEE_OBSERVE_API_URL && !BEE_OBSERVE_API_AUTH_KEY) {
  throw new Error('Missing env BEE_OBSERVE_API_AUTH_KEY');
}

export const MILVUS_HOST = getEnv('MILVUS_HOST', '127.0.0.1');
export const MILVUS_PORT = getEnv('MILVUS_PORT', '19530');
export const MILVUS_USERNAME = getEnv('MILVUS_USERNAME');
export const MILVUS_PASSWORD = getEnv('MILVUS_PASSWORD');
export const MILVUS_DATABASE_NAME = getEnv('MILVUS_DATABASE_NAME', 'default');
export const MILVUS_USE_TLS = getEnv('MILVUS_USE_TLS', 'true') == 'true';
export const MILVUS_CA_CERT = Buffer.from(getEnv('MILVUS_CA_CERT', ''));
export const MILVUS_CERT = Buffer.from(getEnv('MILVUS_CERT', ''));
export const MILVUS_KEY = Buffer.from(getEnv('MILVUS_KEY', ''));

export const HTTP_PROXY_URL = getEnv('HTTP_PROXY_URL', null);

if (MILVUS_USE_TLS && (!MILVUS_CA_CERT || !MILVUS_CERT || !MILVUS_KEY)) {
  throw new Error('MILVUS TLS is enabled but required certificates are not provided');
}

// cannot import QueueName object due to cyclic import, using this weaker type-check
const allowedQueues = Object.values(QueueName);
export const RUN_BULLMQ_WORKERS = getStringArray('RUN_BULLMQ_WORKERS', allowedQueues, []);

export const CRYPTO_CIPHER_KEY = Buffer.from(getEnv('CRYPTO_CIPHER_KEY'), 'base64');

// TODO remove after org/project management is ready
export const ORGANIZATION_ID_DEFAULT = getEnv('ORGANIZATION_ID_DEFAULT', null);
export const ORGANIZATION_OWNER_ID_DEFAULT = getEnv('ORGANIZATION_OWNER_ID_DEFAULT');
export const PROJECT_ID_DEFAULT = getEnv('PROJECT_ID_DEFAULT', null);
export const PROJECT_ADMIN_ID_DEFAULT = getEnv('PROJECT_ADMIN_ID_DEFAULT');

const RUNS_QUOTA_DAILY_RAW = getEnv('RUNS_QUOTA_DAILY', null);
export const RUNS_QUOTA_DAILY = RUNS_QUOTA_DAILY_RAW ? parseInt(RUNS_QUOTA_DAILY_RAW) : Infinity;

const VECTOR_STORE_FILE_QUOTA_DAILY_RAW = getEnv('VECTOR_STORE_FILE_QUOTA_DAILY', null);
export const VECTOR_STORE_FILE_QUOTA_DAILY = VECTOR_STORE_FILE_QUOTA_DAILY_RAW
  ? parseInt(VECTOR_STORE_FILE_QUOTA_DAILY_RAW)
  : Infinity;

export const ARTIFACT_SECRET_RATE_LIMIT = parseInt(getEnv('ARTIFACT_SECRET_RATE_LIMIT', '25'));
