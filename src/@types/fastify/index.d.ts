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

/* eslint-disable @typescript-eslint/no-unused-vars */

import fastify, { FastifyReply, FastifyRequest } from 'fastify';
import { RequestContextData } from '@fastify/request-context';
import { Loaded } from '@mikro-orm/core';

import type { AuthFn } from '@/auth/authentication.ts';
import { ProjectPrincipal } from '@/administration/entities/project-principal.entity';
import { OrganizationUser } from '@/administration/entities/organization-user.entity';
import { ProjectApiKey } from '@/administration/entities/project-api-key.entity';
import { Artifact } from '@/artifacts/entities/artifact.entity';

declare module 'fastify' {
  interface FastifyInstance<
    HttpServer = Server,
    HttpRequest = IncomingMessage,
    HttpResponse = ServerResponse
  > {
    auth: AuthFn;
  }
}

declare module '@fastify/request-context' {
  interface RequestContextData {
    req: FastifyRequest;
    res: FastifyReply;

    user?: Loaded<User>;
    organizationUser?: Loaded<OrganizationUser>;
    apiKey?: Loaded<ProjectApiKey>;
    projectPrincipal?: Loaded<ProjectPrincipal>;
    artifact?: Loaded<Artifact>;
  }
}
