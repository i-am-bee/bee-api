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

import { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import { ORM } from '../database.js';
import { User } from '../users/entities/user.entity.js';

import { AuthSecret, determineAuthType, scryptSecret } from './utils.js';
import { validateAccessToken } from './accessToken.js';

import { APIError, APIErrorCode } from '@/errors/error.entity.js';
import { ProjectApiKey } from '@/administration/entities/project-api-key.entity.js';
import { ProjectPrincipal } from '@/administration/entities/project-principal.entity.js';
import { OrganizationUser } from '@/administration/entities/organization-user.entity.js';
import { PrincipalType } from '@/administration/entities/principals/principal.entity.js';
import { getLogger } from '@/logger.js';
import { Artifact } from '@/artifacts/entities/artifact.entity.js';

export async function getTrustedIdentity(request: FastifyRequest) {
  const authType = determineAuthType(request);
  switch (authType.type) {
    case AuthSecret.ACCESS_TOKEN:
      return await validateAccessToken(authType.value);
    default:
      throw new APIError({
        message: 'Invalid identity',
        code: APIErrorCode.AUTH_ERROR
      });
  }
}

const ORGANIZATION_HEADER = 'x-organization';
const PROJECT_HEADER = 'x-project';

// This needs to be async, otherwise "done" callback would need to be used
// See: https://github.com/fastify/fastify-auth
const authJwt = async (request: FastifyRequest, jwtToken: string) => {
  const { sub, email, preferred_username } = await validateAccessToken(jwtToken);

  const user = await ORM.em.getRepository(User).findOne({ externalId: sub });
  if (!user)
    throw new APIError({
      message: `User not found`,
      code: APIErrorCode.AUTH_ERROR
    });

  // Add email and name for existing emails
  // TODO remove once all accounts have been populated
  if (!user.email || !user.name) {
    user.email = email;
    user.name = preferred_username;
    await ORM.em.flush();
  }

  request.requestContext.set('user', user);

  const organization = request.headers[ORGANIZATION_HEADER];
  if (organization) {
    if (typeof organization !== 'string')
      throw new APIError({ message: 'Invalid organization', code: APIErrorCode.INVALID_INPUT });

    const orgUser = await ORM.em
      .getRepository(OrganizationUser)
      .findOne({ user: user.id, organization }, { filters: { orgAdministrationAccess: false } });
    if (!orgUser)
      throw new APIError({
        message: `Organization not found`,
        code: APIErrorCode.AUTH_ERROR
      });
    request.requestContext.set('organizationUser', orgUser);
  }

  const project = request.headers[PROJECT_HEADER];
  if (project) {
    if (typeof project !== 'string')
      throw new APIError({ message: 'Invalid project', code: APIErrorCode.INVALID_INPUT });

    const orgUser = request.requestContext.get('organizationUser');
    if (!orgUser)
      throw new APIError({ message: 'Missing organization', code: APIErrorCode.INVALID_INPUT });

    const projectPrincipal = await ORM.em
      .getRepository(ProjectPrincipal)
      .findOne(
        { project, principal: { type: PrincipalType.USER, user: orgUser } },
        { populate: ['project'], filters: { projectAdministrationAccess: false } }
      );
    if (!projectPrincipal)
      throw new APIError({
        message: `Project user not found`,
        code: APIErrorCode.AUTH_ERROR
      });
    request.requestContext.set('projectPrincipal', projectPrincipal);
  }
};

const authApiKey = async (request: FastifyRequest, apiKey: string) => {
  const key = await ORM.em
    .getRepository(ProjectApiKey)
    .findOne(
      { key: scryptSecret(apiKey) },
      { populate: ['createdBy'], filters: { projectAdministrationAccess: false } }
    );
  if (!key) {
    throw new APIError({
      message: `Key not found`,
      code: APIErrorCode.AUTH_ERROR
    });
  }
  request.requestContext.set('apiKey', key);
  request.requestContext.set('projectPrincipal', key.createdBy.$);
  try {
    await ORM.em.nativeUpdate(
      ProjectApiKey,
      { id: key.id },
      { lastUsedAt: new Date() },
      { filters: { projectAdministrationAccess: false } }
    );
  } catch (e) {
    getLogger().warn('lastUsedAt not updated');
  }
};

const authArtifactSecret = async (request: FastifyRequest, accessToken: string) => {
  const artifact = await ORM.em
    .getRepository(Artifact)
    .findOne({ accessToken }, { filters: { principalAccess: false } });
  if (!artifact) {
    throw new APIError({
      message: `Artifact not found`,
      code: APIErrorCode.AUTH_ERROR
    });
  }
  request.requestContext.set('artifact', artifact);
};

export type AuthFn = (allowedTypes?: AuthSecret[]) => (request: FastifyRequest) => Promise<void>;

const auth: AuthFn =
  (allowedTypes = [AuthSecret.ACCESS_TOKEN, AuthSecret.API_KEY]) =>
  async (request) => {
    const authType = determineAuthType(request);

    if (!allowedTypes.includes(authType.type)) {
      throw new APIError({
        message: 'Invalid authorization',
        code: APIErrorCode.AUTH_ERROR
      });
    }

    switch (authType.type) {
      case AuthSecret.ACCESS_TOKEN:
        await authJwt(request, authType.value);
        break;
      case AuthSecret.API_KEY:
        await authApiKey(request, authType.value);
        break;
      case AuthSecret.ARTIFACT_SECRET:
        await authArtifactSecret(request, authType.value);
        break;
      case AuthSecret.UNKNOWN:
        break;
    }

    request.log.info(
      {
        authType: authType.type,
        apiKey: request.requestContext.get('apiKey')?.id,
        user: request.requestContext.get('user')?.id,
        organizationUser: request.requestContext.get('organizationUser')?.id,
        projectPrincipal: request.requestContext.get('projectPrincipal')?.id,
        artifact: request.requestContext.get('artifact')?.id
      },
      'Authenticated'
    );
  };

export const authPlugin: FastifyPluginAsync = fp.default(async (app: FastifyInstance) => {
  app.decorate('auth', auth);
});
