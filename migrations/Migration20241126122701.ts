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
