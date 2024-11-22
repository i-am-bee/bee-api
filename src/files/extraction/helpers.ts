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

export function supportsExtraction(
  mimeType: string = OCTET_STREAM_MIME_TYPE,
  backend: ExtractionBackend = EXTRACTION_BACKEND
): boolean {
  switch (backend) {
    case ExtractionBackend.DOCLING: {
      const extension = mime.getExtension(mimeType);
      if (!extension) return false;
      return (
        mimeType.startsWith('text/') ||
        mimeType === 'application/json' ||
        ['docx', 'html', 'jpeg', 'pdf', 'pptx', 'png'].includes(extension)
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
      file.extraction = new DoclingExtraction({ jobId: file.id });
      await ORM.em.flush();
      if (file.mimeType?.startsWith('text/') || file.mimeType === 'application/json') {
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

export async function removeExtraction(file: Loaded<File>) {
  const extraction = file.extraction;
  if (!extraction) throw new Error('No extraction to remove');
  switch (extraction.backend) {
    case ExtractionBackend.DOCLING:
      if (extraction.documentStorageId)
        await s3Client
          .deleteObject({ Bucket: S3_BUCKET_FILE_STORAGE, Key: extraction.documentStorageId })
          .promise();
      if (extraction.chunksStorageId)
        await s3Client
          .deleteObject({ Bucket: S3_BUCKET_FILE_STORAGE, Key: extraction.chunksStorageId })
          .promise();
      if (extraction.textStorageId)
        await s3Client
          .deleteObject({ Bucket: S3_BUCKET_FILE_STORAGE, Key: extraction.textStorageId })
          .promise();
      break;
    case ExtractionBackend.WDU:
      if (extraction.storageId)
        await s3Client
          .deleteObject({ Bucket: S3_BUCKET_FILE_STORAGE, Key: extraction.storageId })
          .promise();
      break;
    case ExtractionBackend.UNSTRUCTURED_OPENSOURCE:
    case ExtractionBackend.UNSTRUCTURED_API:
      if (extraction.storageId)
        await s3Client
          .deleteObject({ Bucket: S3_BUCKET_FILE_STORAGE, Key: extraction.storageId })
          .promise();
      break;
  }
  file.extraction = undefined;
  await ORM.em.flush();
}

export async function getExtractedText(file: Loaded<File>) {
  const extraction = file.extraction;
  if (!extraction) throw new Error('Extraction not found');
  switch (extraction.backend) {
    case ExtractionBackend.WDU: {
      if (!extraction.storageId) throw new Error('Extraction missing');
      const object = await s3Client
        .getObject({
          Bucket: S3_BUCKET_FILE_STORAGE,
          Key: extraction.storageId
        })
        .promise();
      const body = object.Body;
      if (!body) throw new Error('Invalid Body of a file');
      return body.toString('utf-8');
    }
    case ExtractionBackend.DOCLING: {
      if (!extraction.textStorageId) throw new Error('Extraction missing');
      return readTextFile(extraction.textStorageId);
    }
    case ExtractionBackend.UNSTRUCTURED_OPENSOURCE:
    case ExtractionBackend.UNSTRUCTURED_API: {
      if (!extraction.storageId) throw new Error('Extraction missing');
      const elements = JSON.parse(
        await readTextFile(extraction.storageId)
      ) as UnstructuredExtractionDocument;
      return elements.map((element) => element.text).join('');
    }
  }
}

export async function getExtractedChunks(file: Loaded<File>) {
  const extraction = file.extraction;
  if (!extraction) throw new Error('Extraction not found');
  switch (extraction.backend) {
    case ExtractionBackend.DOCLING: {
      if (!extraction.chunksStorageId) {
        if (!extraction.textStorageId) throw new Error('Extraction missing');
        const text = await getExtractedText(file);
        const splitter = recursiveSplitString(text, {
          size: 400,
          overlap: 200,
          separators: ['\n\n', '\n', ' ', '']
        });
        return Array.from(splitter);
      }
      const chunks = JSON.parse(
        await readTextFile(extraction.chunksStorageId)
      ) as DoclingChunksExtraction;
      return chunks.map((c) => c.text);
    }
    case ExtractionBackend.WDU: {
      const text = await getExtractedText(file);
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
        await readTextFile(extraction.storageId)
      ) as UnstructuredExtractionDocument;
      return elements
        .filter((element) => element.type === 'CompositeElement')
        .map((element) => element.text);
    }
  }
}

async function readTextFile(key: string) {
  const object = await s3Client
    .getObject({
      Bucket: S3_BUCKET_FILE_STORAGE,
      Key: key
    })
    .promise();
  const body = object.Body;
  if (!body) throw new Error('Invalid Body of a file');
  const data = body.toString('utf-8');
  return data;
}
