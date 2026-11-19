import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { ENTITIES } from '../../src/database/entities';
import { buildDataSourceOptions } from '../../src/database/data-source';

async function main() {
  const ds = new DataSource(
    buildDataSourceOptions(process.env, {
      entities: ENTITIES,
      migrations: [],
      synchronize: true,
    }),
  );

  await ds.initialize();
  try {
    console.log(
      `Schema synchronized to ${process.env.DB_DATABASE || 'erp4u_db'} (${ds.entityMetadatas.length} entities).`,
    );
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error('schema-sync failed:', err);
  process.exit(1);
});
