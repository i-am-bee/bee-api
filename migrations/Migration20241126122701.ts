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

import { User } from '@/users/entities/user.entity';
import { OrganizationUser } from '@/administration/entities/organization-user.entity';
import { IBM_ORGANIZATION_OWNER_ID } from '@/config';

type BaseDocument = { _id: string; createdAt: Date; updatedAt: Date; [key: string]: any };

export class Migration20241126122701 extends Migration {
  async up(): Promise<void> {
    const orgOwner = await this.getCollection<BaseDocument>(OrganizationUser).findOne(
      { _id: IBM_ORGANIZATION_OWNER_ID },
      { session: this.ctx }
    );

    if (!orgOwner) {
      throw new Error('IBM organization owner not found.');
    }

    const defaultOrganization = orgOwner.organization;

    await this.getCollection(User).updateMany(
      {},
      {
        $set: {
          defaultOrganization
        }
      },
      { session: this.ctx }
    );
  }
}
