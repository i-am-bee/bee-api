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
