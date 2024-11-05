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

import { requestContext } from '@fastify/request-context';

import { APIError, APIErrorCode } from '@/errors/error.entity';
import { API_KEY_PREFIX } from '@/auth/utils';

export function getOrganizationUser() {
  const orgUser = requestContext.get('organizationUser');
  if (!orgUser)
    throw new APIError({ message: 'Organization user not found', code: APIErrorCode.NOT_FOUND });
  return orgUser;
}

export function getProjectPrincipal() {
  const projectPrincipal = requestContext.get('projectPrincipal');
  if (!projectPrincipal)
    throw new APIError({ message: 'Project principal not found', code: APIErrorCode.NOT_FOUND });
  return projectPrincipal;
}

export const redactProjectKeyValue = (key: string) =>
  key.replace(
    key.substring(API_KEY_PREFIX.length + 2, key.length - 2),
    '*'.repeat(key.length - 12)
  );
