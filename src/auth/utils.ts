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

import crypto from 'node:crypto';

import { FastifyRequest } from 'fastify';

export const AuthSecret = {
  ACCESS_TOKEN: 'access_token',
  API_KEY: 'key',
  UNKNOWN: 'unknown'
} as const;
export type AuthSecret = (typeof AuthSecret)[keyof typeof AuthSecret];

interface AuthTypeAccessToken {
  type: typeof AuthSecret.ACCESS_TOKEN;
  value: string;
}

interface AuthTypeApiKey {
  type: typeof AuthSecret.API_KEY;
  value: string;
}

interface AuthTypeUnknown {
  type: typeof AuthSecret.UNKNOWN;
}

type AuthType = AuthTypeAccessToken | AuthTypeApiKey | AuthTypeUnknown;

const BEARER_PREFIX = 'Bearer ';
export const API_KEY_PREFIX = 'sk-proj-';

const API_KEY_SIZE = 32;

export const determineAuthType = (req: FastifyRequest): AuthType => {
  if (req.headers.authorization) {
    const firstPart = req.headers.authorization.substring(0, BEARER_PREFIX.length);
    const secondPart = req.headers.authorization.substring(BEARER_PREFIX.length).trim();
    if (firstPart === BEARER_PREFIX && secondPart.length > 0) {
      if (secondPart.startsWith(API_KEY_PREFIX) && secondPart.length > API_KEY_PREFIX.length) {
        return {
          value: secondPart,
          type: AuthSecret.API_KEY
        };
      } else {
        return {
          value: secondPart,
          type: AuthSecret.ACCESS_TOKEN
        };
      }
    }
  }
  return {
    type: AuthSecret.UNKNOWN
  };
};

export function scryptApiKey(apiKey: string) {
  // We expect the key to be random and high entropy, therefore constant salt is not an issue
  return crypto.scryptSync(apiKey, 'salt', 64).toString('hex');
}

export function generateApiKey() {
  return `${API_KEY_PREFIX}${crypto.randomBytes(API_KEY_SIZE).toString('base64url')}`;
}
