import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { ENTITIES } from './entities';

export interface DbEnvConfig {
  DATABASE_URL?: string;
  POSTGRES_URL?: string;
  DB_HOST?: string;
  DB_PORT?: string | number;
  DB_USERNAME?: string;
  DB_PASSWORD?: string;
  DB_DATABASE?: string;
  DB_AUTO_MIGRATE?: string;
  [key: string]: string | number | undefined;
}

export function buildDataSourceOptions(
  env: DbEnvConfig = process.env,
  overrides: Partial<DataSourceOptions> = {},
): DataSourceOptions {
  const dbUrl = env.DATABASE_URL || env.POSTGRES_URL || undefined;
  const rawPort = env.DB_PORT;
  const port =
    typeof rawPort === 'number'
      ? rawPort
      : rawPort
        ? parseInt(rawPort, 10) || 5432
        : 5432;

  return {
    type: 'postgres',
    url: dbUrl,
    host: env.DB_HOST || 'localhost',
    port,
    username: env.DB_USERNAME || 'erp4u_user',
    password: env.DB_PASSWORD || 'erp4u_password',
    database: env.DB_DATABASE || 'erp4u_db',
    ssl:
      dbUrl && dbUrl.includes('sslmode=require')
        ? { rejectUnauthorized: false }
        : undefined,
    entities: ENTITIES,
    migrations: [__dirname + '/migrations/*{.ts,.js}'],
    migrationsTableName: 'migrations',
    synchronize: false,
    subscribers: [],
    ...overrides,
  } as DataSourceOptions;
}

const AppDataSource = new DataSource(buildDataSourceOptions(process.env));

export default AppDataSource;
