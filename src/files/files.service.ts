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

import { createHash } from 'node:crypto';

import { FilterQuery, Loaded, ref, Ref } from '@mikro-orm/core';
import ibm from 'ibm-cos-sdk';
import { MultipartFile } from '@fastify/multipart';
import dayjs from 'dayjs';

import { File } from './entities/file.entity.js';
import { File as FileDto } from './dtos/file.js';
import { FileCreateBody, FileCreateResponse } from './dtos/file-create.js';
import { FileReadParams, FileReadResponse } from './dtos/file-read.js';
import { FileDeleteParams, FileDeleteResponse } from './dtos/file-delete.js';
import { FilesListQuery, FilesListResponse } from './dtos/files-list.js';
import { FileContentReadParams, FileContentReadResponse } from './dtos/file-content-read.js';
import { scheduleExtraction, supportsExtraction } from './extraction/helpers.js';
import { deriveMimeType } from './utils/mime.js';

import { PassthroughHash } from '@/utils/streams.js';
import { ORM } from '@/database.js';
import { getServiceLogger } from '@/logger.js';
import { createPaginatedResponse, getListCursor } from '@/utils/pagination.js';
import {
  S3_ACCESS_KEY_ID,
  S3_BUCKET_FILE_STORAGE,
  S3_ENDPOINT,
  S3_SECRET_ACCESS_KEY
} from '@/config.js';
import { APIError, APIErrorCode } from '@/errors/error.entity.js';
import { listenToSocketClose } from '@/utils/networking.js';
import { createDeleteResponse } from '@/utils/delete.js';
import { Thread } from '@/threads/thread.entity.js';
import { ensureRequestContextData } from '@/context.js';
import { Project } from '@/administration/entities/project.entity.js';
import { getProjectPrincipal } from '@/administration/helpers.js';

const getFilesLogger = (fileId?: string) => getServiceLogger('file').child({ fileId });

export const s3Client = new ibm.S3({
  endpoint: S3_ENDPOINT,
  s3ForcePathStyle: true, // Needed for MinIO
  credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY }
});

const USER_FILES_STORAGE_LIMIT = 10_000_000_000;
const USER_FILE_SIZE_LIMIT = 100_000_000;
const CONTENT_SIZE_CORRECTION = 500;

async function getProjectStorageSize(project: Ref<Project>) {
  const aggregation = (await ORM.em.aggregate(File, [
    { $match: { project: project.id } },
    { $group: { _id: null, totalSize: { $sum: '$bytes' } } }
  ])) as { totalSize: number }[];
  return aggregation.at(0)?.totalSize ?? 0;
}

export function toFileDto(file: Loaded<File>): FileDto {
  return {
    id: file.id,
    created_at: dayjs(file.createdAt).unix(),
    purpose: file.purpose,
    bytes: file.bytes,
    object: 'file',
    filename: file.filename,
    depends_on: file.dependsOn
      ? {
          thread: {
            id: file.dependsOn.id
          }
        }
      : undefined
  };
}

export async function createFile({
  purpose,
  file: multipartFile,
  depends_on_thread_id
}: FileCreateBody): Promise<FileCreateResponse> {
  const req = ensureRequestContextData('req');

  const userStorageSize = await getProjectStorageSize(getProjectPrincipal().project);
  const allowedFileSize = Math.min(
    USER_FILE_SIZE_LIMIT,
    USER_FILES_STORAGE_LIMIT - userStorageSize
  );

  // quick content size check before uploading (subtracting CONTENT_SIZE_CORRECTION because of parameters size)
  const contentLength = parseInt(req.headers['content-length'] ?? 'NaN');
  if (contentLength && contentLength - CONTENT_SIZE_CORRECTION > allowedFileSize) {
    throw new APIError({
      message: `Content is too large`,
      code: APIErrorCode.INVALID_INPUT
    });
  }

  const { filename, mimetype, file: content } = multipartFile as MultipartFile;

  const dependsOn = depends_on_thread_id
    ? ref(await ORM.em.getRepository(Thread).findOneOrFail({ id: depends_on_thread_id }))
    : undefined;
  const file = new File({
    purpose,
    filename,
    bytes: 0,
    contentHash: '',
    mimeType: deriveMimeType(mimetype, filename),
    dependsOn
  });

  const storageLimitExceeded = () => file.bytes > allowedFileSize;
  const passthroughHash = new PassthroughHash({ hash: createHash('sha256') });

  const s3request = s3Client.upload({
    Bucket: S3_BUCKET_FILE_STORAGE,
    Key: file.storageId,
    Body: content.compose(passthroughHash),
    ContentType: file.mimeType
  });
  const unsub = listenToSocketClose(req.socket, () => s3request.abort());
  s3request.on('httpUploadProgress', (progress) => {
    getFilesLogger().trace({ progress }, 'Upload progress');
    file.bytes = progress.total ?? file.bytes;
    if (storageLimitExceeded()) s3request.abort();
  });
  try {
    await s3request.promise();
    const head = await s3Client
      .headObject({ Bucket: S3_BUCKET_FILE_STORAGE, Key: file.storageId })
      .promise();
    file.contentHash = passthroughHash.hash.digest('hex');
    file.bytes = head.ContentLength ?? 0;
    await ORM.em.persistAndFlush(file);
    getFilesLogger(file.id).info('File created');

    (async () => {
      if (supportsExtraction(file.mimeType)) {
        try {
          await scheduleExtraction(file);
        } catch (err) {
          getFilesLogger(file.id).warn({ err }, 'Failed to schedule extraction');
        }
      }
    })();

    return toFileDto(file);
  } catch (err) {
    if (storageLimitExceeded())
      throw new APIError({ message: 'Storage limit exceeded', code: APIErrorCode.INVALID_INPUT });
    throw err;
  } finally {
    unsub();
  }
}

export async function readFile({ file_id }: FileReadParams): Promise<FileReadResponse> {
  const file = await ORM.em
    .getRepository(File)
    .findOneOrFail({ id: file_id }, { filters: { hasAccess: {} } });
  return toFileDto(file);
}

export async function deleteFile({ file_id }: FileDeleteParams): Promise<FileDeleteResponse> {
  const file = await ORM.em.getRepository(File).findOneOrFail({ id: file_id });

  file.delete();

  await ORM.em.flush();
  getFilesLogger(file.id).info('File deleted');
  return createDeleteResponse(file_id, 'file');
}

export async function listFiles({
  limit,
  after,
  before,
  order,
  order_by,
  show_dependent,
  ...rest
}: FilesListQuery): Promise<FilesListResponse> {
  const where: FilterQuery<File> = {};
  const ids = rest['ids[]'];
  if (ids) {
    where.id = { $in: ids };
  }
  if (!show_dependent) {
    where.dependsOn = { $exists: false };
  }
  const repo = ORM.em.getRepository(File);
  const cursor = await getListCursor<File>(where, { limit, order, order_by, after, before }, repo);
  return createPaginatedResponse(cursor, toFileDto);
}

export async function getExtractedFileStats(file: Loaded<File>) {
  if (!file.extraction?.storageId) throw new Error('Extraction not found');
  return s3Client
    .headObject({
      Bucket: S3_BUCKET_FILE_STORAGE,
      Key: file.extraction.storageId
    })
    .promise();
}

export async function getExtractedFileObject(file: Loaded<File>) {
  if (!file.extraction?.storageId) throw new Error('Extraction not found');
  return s3Client
    .getObject({
      Bucket: S3_BUCKET_FILE_STORAGE,
      Key: file.extraction.storageId
    })
    .promise();
}

export async function readFileContent({
  file_id
}: FileContentReadParams): Promise<FileContentReadResponse> {
  const file = await ORM.em.getRepository(File).findOneOrFail({ id: file_id });

  const head = await s3Client
    .headObject({
      Bucket: S3_BUCKET_FILE_STORAGE,
      Key: file.storageId
    })
    .promise();

  const content = s3Client
    .getObject({
      Bucket: S3_BUCKET_FILE_STORAGE,
      Key: file.storageId
    })
    .createReadStream();

  return ensureRequestContextData('res')
    .header(
      'content-type',
      // derivation is used for backwards compatibility
      deriveMimeType(file.mimeType ?? head.ContentType, file.filename)
    )
    .send(content);
}
