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

import { Migration } from '@mikro-orm/migrations-mongodb';

import { Artifact } from '../src/artifacts/entities/artifact.entity';

export class Migration20241209125658 extends Migration {
  async up(): Promise<void> {
    await this.getCollection(Artifact).updateMany(
      {},
      { $rename: { accessSecret: 'accessToken' } },
      { session: this.ctx }
    );
  }
}
