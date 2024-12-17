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

import { Loaded } from '@mikro-orm/core';
import mime from 'mime';
import { recursiveSplitString } from 'bee-agent-framework/internals/helpers/string';
import ibm from 'ibm-cos-sdk';

import { s3Client } from '../files.service';
import { DoclingExtraction } from '../entities/extractions/docling-extraction.entity';
import { WDUExtraction } from '../entities/extractions/wdu-extraction.entity';
import { UnstructuredOpensourceExtraction } from '../entities/extractions/unstructured-opensource-extraction.entity';
import { UnstructuredAPIExtraction } from '../entities/extractions/unstructured-api-extraction.entity';
import { nodeQueue, pythonQueue } from '../jobs/extraction.queue';
import { OCTET_STREAM_MIME_TYPE } from '../utils/mime';

import { ExtractionBackend } from './constants';
import { DoclingChunksExtraction, UnstructuredExtractionDocument } from './types';

import { File } from '@/files/entities/file.entity';
import { EXTRACTION_BACKEND, S3_BUCKET_FILE_STORAGE } from '@/config';
import { ORM } from '@/database';
import { QueueName } from '@/jobs/constants';

export const withAbort = <A, B>(value: ibm.Request<A, B>, signal?: AbortSignal) => {
  const handler = () => value.abort();
  signal?.addEventListener('abort', handler);
  return value.promise().finally(() => signal?.removeEventListener('abort', handler));
};

function isNativeDoclingFormat(mimeType: string): boolean {
  const extension = mime.getExtension(mimeType);
  if (!extension) return false;
  return [
    'docx',
    'dotx',
    'docm',
    'dotm',
    'pptx',
    'potx',
    'ppsx',
    'pptm',
    'potm',
    'ppsm',
    'pdf',
    'md',
    'html',
    'htm',
    'xhtml',
    'jpg',
    'jpeg',
    'png',
    'tif',
    'tiff',
    'bmp',
    'adoc',
    'asciidoc',
    'asc',
    'xlsx'
  ].includes(extension);
}

export function supportsExtraction(
  mimeType: string = OCTET_STREAM_MIME_TYPE,
  backend: ExtractionBackend = EXTRACTION_BACKEND
): boolean {
  switch (backend) {
    case ExtractionBackend.DOCLING: {
      return (
        mimeType.startsWith('text/') ||
        mimeType === 'application/json' ||
        isNativeDoclingFormat(mimeType)
      );
    }
    case ExtractionBackend.WDU:
      return (
        mimeType.startsWith('text/') ||
        mimeType.startsWith('image/') ||
        ['application/json', 'application/pdf'].includes(mimeType)
      );
    case ExtractionBackend.UNSTRUCTURED_OPENSOURCE:
    case ExtractionBackend.UNSTRUCTURED_API: {
      const extension = mime.getExtension(mimeType);
      if (!extension) return false;
      return [
        'bmp',
        'csv',
        'doc',
        'docx',
        'eml',
        'epub',
        'heic',
        'html',
        'jpeg',
        'png',
        'md',
        'msg',
        'odt',
        'org',
        'p7s',
        'pdf',
        'png',
        'ppt',
        'pptx',
        'rst',
        'rtf',
        'tiff',
        'txt',
        'tsv',
        'xls',
        'xlsx',
        'xml',
        'json',
        'vtt'
      ].includes(extension);
    }
  }
}

export async function scheduleExtraction(
  file: Loaded<File>,
  backend: ExtractionBackend = EXTRACTION_BACKEND
) {
  switch (backend) {
    case ExtractionBackend.DOCLING: {
      const mimeType = file.mimeType;
      if (!mimeType) throw new Error('Missing mime type');

      file.extraction = new DoclingExtraction({ jobId: file.id });
      await ORM.em.flush();
      if (
        !isNativeDoclingFormat(mimeType) &&
        (mimeType.startsWith('text/') || mimeType === 'application/json')
      ) {
        await nodeQueue.add(
          QueueName.FILES_EXTRACTION_NODE,
          {
            fileId: file.id,
            backend
          },
          { jobId: file.id }
        );
      } else {
        await pythonQueue.add(
          QueueName.FILES_EXTRACTION_PYTHON,
          {
            fileId: file.id,
            backend
          },
          { jobId: file.id }
        );
      }
      break;
    }
    case ExtractionBackend.WDU: {
      file.extraction = new WDUExtraction({ jobId: file.id });
      await ORM.em.flush();
      await nodeQueue.add(
        QueueName.FILES_EXTRACTION_NODE,
        {
          fileId: file.id,
          backend
        },
        { jobId: file.id }
      );
      break;
    }
    case ExtractionBackend.UNSTRUCTURED_OPENSOURCE: {
      file.extraction = new UnstructuredOpensourceExtraction({ jobId: file.id });
      await ORM.em.flush();
      await pythonQueue.add(
        QueueName.FILES_EXTRACTION_PYTHON,
        {
          fileId: file.id,
          backend
        },
        { jobId: file.id }
      );
      break;
    }
    case ExtractionBackend.UNSTRUCTURED_API: {
      file.extraction = new UnstructuredAPIExtraction({ jobId: file.id });
      await ORM.em.flush();
      await pythonQueue.add(
        QueueName.FILES_EXTRACTION_PYTHON,
        {
          fileId: file.id,
          backend
        },
        { jobId: file.id }
      );
      break;
    }
  }
}

type AvailableKeys<T> = Exclude<T extends T ? keyof T : never, keyof unknown[]>;

const keyByProvider = {
  [ExtractionBackend.DOCLING]: ['documentStorageId', 'chunksStorageId', 'textStorageId'],
  [ExtractionBackend.WDU]: ['storageId'],
  [ExtractionBackend.UNSTRUCTURED_OPENSOURCE]: ['storageId'],
  [ExtractionBackend.UNSTRUCTURED_API]: ['storageId']
} as const satisfies Record<ExtractionBackend, AvailableKeys<typeof File.prototype.extraction>[]>;

export async function removeExtraction(file: Loaded<File>, signal?: AbortSignal) {
  const extraction = file.extraction;
  if (!extraction) throw new Error('No extraction to remove');

  await Promise.all(
    keyByProvider[extraction.backend].map(async (property) => {
      const Key = extraction[property as keyof typeof extraction];
      if (Key) {
        await withAbort(s3Client.deleteObject({ Bucket: S3_BUCKET_FILE_STORAGE, Key }), signal);
      }
    })
  );

  file.extraction = undefined;
  await ORM.em.flush();
}

export async function getExtractedText(file: Loaded<File>, signal?: AbortSignal): Promise<string> {
  const extraction = file.extraction;
  if (!extraction) throw new Error('Extraction not found');
  switch (extraction.backend) {
    case ExtractionBackend.WDU: {
      if (!extraction.storageId) throw new Error('Extraction missing');
      const object = await withAbort(
        s3Client.getObject({
          Bucket: S3_BUCKET_FILE_STORAGE,
          Key: extraction.storageId
        }),
        signal
      );
      const body = object.Body;
      if (!body) throw new Error('Invalid Body of a file');
      return body.toString('utf-8');
    }
    case ExtractionBackend.DOCLING: {
      if (!extraction.textStorageId) throw new Error('Extraction missing');
      return readTextFile(extraction.textStorageId, signal);
    }
    case ExtractionBackend.UNSTRUCTURED_OPENSOURCE:
    case ExtractionBackend.UNSTRUCTURED_API: {
      if (!extraction.storageId) throw new Error('Extraction missing');
      const elements = JSON.parse(
        await readTextFile(extraction.storageId, signal)
      ) as UnstructuredExtractionDocument;
      return elements.map((element) => element.text).join('');
    }
  }
}

export async function getExtractedChunks(file: Loaded<File>, signal?: AbortSignal) {
  const extraction = file.extraction;
  if (!extraction) throw new Error('Extraction not found');
  switch (extraction.backend) {
    case ExtractionBackend.DOCLING: {
      if (!extraction.chunksStorageId) {
        if (!extraction.textStorageId) throw new Error('Extraction missing');
        const text = await getExtractedText(file, signal);
        const splitter = recursiveSplitString(text, {
          size: 400,
          overlap: 200,
          separators: ['\n\n', '\n', ' ', '']
        });
        return Array.from(splitter);
      }
      const chunks = JSON.parse(
        await readTextFile(extraction.chunksStorageId, signal)
      ) as DoclingChunksExtraction;
      return chunks.map((c) => c.text);
    }
    case ExtractionBackend.WDU: {
      const text = await getExtractedText(file, signal);
      const splitter = recursiveSplitString(text, {
        size: 400,
        overlap: 200,
        separators: ['\n\n', '\n', ' ', '']
      });
      return Array.from(splitter);
    }
    case ExtractionBackend.UNSTRUCTURED_OPENSOURCE:
    case ExtractionBackend.UNSTRUCTURED_API: {
      if (!extraction.storageId) throw new Error('Extraction missing');
      const elements = JSON.parse(
        await readTextFile(extraction.storageId, signal)
      ) as UnstructuredExtractionDocument;
      return elements
        .filter((element) => element.type === 'CompositeElement')
        .map((element) => element.text);
    }
  }
}

async function readTextFile(key: string, signal?: AbortSignal) {
  const object = await withAbort(
    s3Client.getObject({
      Bucket: S3_BUCKET_FILE_STORAGE,
      Key: key
    }),
    signal
  );
  const body = object.Body;
  if (!body) throw new Error('Invalid Body of a file');
  const data = body.toString('utf-8');
  return data;
}
