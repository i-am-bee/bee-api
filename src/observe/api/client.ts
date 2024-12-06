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

import createClient from 'openapi-fetch';

import { paths } from './schema.js';

import { BEE_OBSERVE_API_AUTH_KEY, BEE_OBSERVE_API_URL } from '@/config.js';

export type Client = ReturnType<typeof createClient<paths>>;

export const client = BEE_OBSERVE_API_URL
  ? createClient<paths>({
      baseUrl: BEE_OBSERVE_API_URL,
      headers: {
        ['x-bee-authorization']: BEE_OBSERVE_API_AUTH_KEY,
        'Content-Type': 'application/json'
      }
    })
  : undefined;
