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

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

import { LastAssistants } from './dtos/last_assistant.dto.js';
import { ModulesToPackagesQuery, ModulesToPackagesResponse } from './dtos/modules-to-packages.js';

import { ORM } from '@/database.js';
import { Assistant } from '@/assistants/assistant.entity.js';
import { toDto } from '@/assistants/assistants.service.js';
import { getProjectPrincipal } from '@/administration/helpers.js';
import { PACKAGE_DB } from '@/config.js';

const db = await open({
  filename: PACKAGE_DB,
  driver: sqlite3.cached.Database,
  mode: sqlite3.OPEN_READONLY
});

export async function lastAssistants(): Promise<LastAssistants> {
  const projectPrincipal = getProjectPrincipal();
  const assistants = await ORM.em.aggregate(Assistant, [
    { $match: { project: projectPrincipal.project.id, deletedAt: { $exists: false } } },
    {
      $lookup: {
        from: 'run',
        localField: '_id',
        pipeline: [
          { $match: { createdBy: projectPrincipal.id } },
          { $sort: { createdAt: -1 } },
          { $limit: 1 }
        ],
        foreignField: 'assistant',
        as: 'runs'
      }
    },
    { $set: { lastRun: { $arrayElemAt: ['$runs', 0] } } },
    { $match: { lastRun: { $ne: undefined } } },
    {
      $sort: { 'lastRun.createdAt': -1 }
    },
    { $limit: 4 },
    { $set: { id: '$_id' } }
  ]);

  return assistants.map(toDto);
}

export async function modulesToPackages({
  modules
}: ModulesToPackagesQuery): Promise<ModulesToPackagesResponse> {
  const results = await db.all<{ guess: string }[]>(
    `SELECT DISTINCT guess FROM module_to_pypi_package WHERE module_name IN (${Array.from('?'.repeat(modules.length)).join(',')})`,
    modules
  );
  return {
    packages: results.map((result) => result.guess)
  };
}
