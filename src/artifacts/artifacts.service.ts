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

import { FilterQuery, Loaded, ref } from '@mikro-orm/core';
import dayjs from 'dayjs';

import { ArtifactCreateBody, ArtifactCreateResponse } from './dtos/artifact-create.js';
import type { Artifact as ArtifactDto } from './dtos/artifact.js';
import { Artifact, ArtifactType } from './entities/artifact.entity.js';
import { ArtifactReadParams, ArtifactReadResponse } from './dtos/artifact-read.js';
import {
  ArtifactUpdateBody,
  ArtifactUpdateParams,
  ArtifactUpdateResponse
} from './dtos/artifact-update.js';
import { ArtifactDeleteParams, ArtifactDeleteResponse } from './dtos/artifact-delete.js';
import { AppArtifact } from './entities/app-artifact.entity.js';
import {
  ArtifactSharedReadParams,
  ArtifactSharedReadQuery,
  ArtifactSharedReadResponse
} from './dtos/artifact-shared-read.js';
import { ArtifactsListQuery, ArtifactsListResponse } from './dtos/artifacts-list.js';
import { ArtifactShared } from './dtos/artifact-shared.js';

import { Message } from '@/messages/message.entity.js';
import { APIError, APIErrorCode } from '@/errors/error.entity.js';
import { createDeleteResponse } from '@/utils/delete.js';
import { getUpdatedValue } from '@/utils/update.js';
import { createPaginatedResponse, getListCursor } from '@/utils/pagination.js';
import { ORM } from '@/database.js';
import { ARTIFACT_KEY_PREFIX } from '@/auth/utils.js';

export function toDto(artifact: Loaded<Artifact>): ArtifactDto {
  return {
    ...toSharedDto(artifact),
    object: 'artifact',
    thread_id: artifact.thread?.id ?? null,
    message_id: artifact.message?.id ?? null,
    share_url: artifact.accessToken
      ? `/v1/artifacts/${artifact.id}/shared?token=${artifact.accessToken}`
      : null
  };
}

export function toSharedDto(artifact: Loaded<Artifact>): ArtifactShared {
  const dto = {
    id: artifact.id,
    object: 'artifact.shared' as const,
    type: artifact.type,
    metadata: artifact.metadata ?? {},
    created_at: dayjs(artifact.createdAt).unix(),
    source_code: (artifact as AppArtifact).sourceCode,
    name: artifact.name,
    description: artifact.description ?? null
  };
  switch (artifact.type) {
    case ArtifactType.APP:
      return {
        ...dto,
        source_code: (artifact as AppArtifact).sourceCode
      };
  }
}

function getToken() {
  return `${ARTIFACT_KEY_PREFIX}${crypto.randomBytes(24).toString('base64url')}`;
}

export async function createArtifact(body: ArtifactCreateBody): Promise<ArtifactCreateResponse> {
  const message = body.message_id
    ? await ORM.em.getRepository(Message).findOneOrFail({ id: body.message_id })
    : undefined;

  switch (body.type) {
    case ArtifactType.APP: {
      const artifact = new AppArtifact({
        thread: message && ref(message.thread),
        message: message && ref(message),
        sourceCode: body.source_code,
        metadata: body.metadata ?? undefined,
        accessToken: body.shared === true ? getToken() : undefined,
        name: body.name,
        description: body.description
      });
      await ORM.em.persistAndFlush(artifact);
      return toDto(artifact);
    }
    default:
      throw new APIError({
        message: 'Artifact type not supported',
        code: APIErrorCode.INVALID_INPUT
      });
  }
}

export async function readArtifact({
  artifact_id
}: ArtifactReadParams): Promise<ArtifactReadResponse> {
  const artifact = await ORM.em.getRepository(Artifact).findOneOrFail({
    id: artifact_id
  });
  return toDto(artifact);
}

export async function readSharedArtifact({
  token,
  artifact_id
}: ArtifactSharedReadParams & ArtifactSharedReadQuery): Promise<ArtifactSharedReadResponse> {
  const artifact = await ORM.em.getRepository(Artifact).findOneOrFail(
    {
      id: artifact_id,
      accessToken: token
    },
    { filters: { principalAccess: false } }
  );

  return toSharedDto(artifact);
}

export async function updateArtifact({
  artifact_id,
  metadata,
  name,
  description,
  shared,
  message_id,
  source_code
}: ArtifactUpdateParams & ArtifactUpdateBody): Promise<ArtifactUpdateResponse> {
  const artifact = await ORM.em.getRepository(Artifact).findOneOrFail({
    id: artifact_id
  });
  artifact.metadata = getUpdatedValue(metadata, artifact.metadata);
  artifact.name = getUpdatedValue(name, artifact.name);
  artifact.description = getUpdatedValue(description, artifact.description);
  if (message_id) {
    const message = await ORM.em.getRepository(Message).findOneOrFail({ id: message_id });
    artifact.message = getUpdatedValue(ref(message), artifact.message);
    artifact.thread = getUpdatedValue(ref(message.thread), artifact.thread);
  }
  if (source_code) {
    if (!(artifact instanceof AppArtifact)) {
      throw new APIError({
        message: `Source code is not supported for ${artifact.type} artifact.`,
        code: APIErrorCode.INVALID_INPUT
      });
    }
    artifact.sourceCode = getUpdatedValue(source_code, artifact.sourceCode);
  }
  if (!artifact.accessToken && shared === true) {
    artifact.accessToken = getToken();
  } else if (artifact.accessToken && shared === false) {
    artifact.accessToken = undefined;
  }
  await ORM.em.flush();
  return toDto(artifact);
}

export async function listArtifacts({
  limit,
  after,
  before,
  order,
  order_by,
  search,
  type
}: ArtifactsListQuery): Promise<ArtifactsListResponse> {
  const where: FilterQuery<Artifact> = {};

  if (search) {
    const regexp = new RegExp(search, 'i');
    where.$or = [{ description: regexp }, { name: regexp }];
  }

  if (type && type.length > 0) {
    where.type = { $in: type };
  }

  const repo = ORM.em.getRepository(Artifact);
  const cursor = await getListCursor<Artifact>(
    where,
    { limit, order, order_by, after, before },
    repo
  );
  return createPaginatedResponse(cursor, toDto);
}

export async function deleteArtifact({
  artifact_id
}: ArtifactDeleteParams): Promise<ArtifactDeleteResponse> {
  const artifact = await ORM.em.getRepository(Artifact).findOneOrFail({ id: artifact_id });

  artifact.delete();
  await ORM.em.flush();

  return createDeleteResponse(artifact_id, 'artifact');
}
