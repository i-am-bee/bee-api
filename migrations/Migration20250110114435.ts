import { Migration } from '@mikro-orm/migrations-mongodb';

import { Project } from '@/administration/entities/project.entity';

export class Migration20250110114435 extends Migration {
  async up(): Promise<void> {
    await this.getCollection(Project).updateMany(
      {},
      { $unset: { visibility: '' } },
      { session: this.ctx }
    );
  }
}
