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

import { Assistant } from '@/assistants/assistant.entity';
import { Agent } from '@/runs/execution/constants';

export class Migration20241121182852 extends Migration {
  async up(): Promise<void> {
    await this.getCollection(Assistant).updateMany(
      {},
      { $set: { agent: Agent.BEE } },
      { session: this.ctx }
    );
  }
}
