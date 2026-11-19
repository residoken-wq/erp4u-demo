import { AsyncResource } from 'async_hooks';
import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { PostgresDriver } from 'typeorm/driver/postgres/PostgresDriver';
import {
  assertValidTenantSchema,
  buildSetSearchPathSql,
  TenantContext,
} from './tenant-context';

export interface TenantPgClient {
  __erp4uSchema?: string;
  query: (
    sql: string,
    cb?: (err?: Error | null, res?: unknown) => void,
  ) => unknown;
  release?: (err?: unknown) => void;
}

type ReleaseFn = (err?: unknown) => void;
type PoolConnectCallback = (
  err: Error | undefined | null,
  client: TenantPgClient,
  release: ReleaseFn,
) => void;

export interface PgPoolLike {
  __erp4uTenantHookInstalled?: boolean;
  connect: {
    (cb: PoolConnectCallback): void;
    (): Promise<TenantPgClient>;
    (cb?: PoolConnectCallback): void | Promise<TenantPgClient>;
  };
}

const logger = new Logger('TenantConnectionHook');

function applySearchPath(
  client: TenantPgClient,
  schema: string,
  release: ReleaseFn,
  done: (err?: Error | null) => void,
): void {
  if (client.__erp4uSchema === schema) {
    done(null);
    return;
  }

  let sql: string;
  try {
    sql = buildSetSearchPathSql(schema);
  } catch (err) {
    try {
      release(err);
    } catch {
      // ignore release failure
    }
    done(err as Error);
    return;
  }

  client.query(sql, (queryErr?: Error | null) => {
    if (queryErr) {
      try {
        release(queryErr);
      } catch {
        // ignore release failure
      }
      done(queryErr);
      return;
    }
    client.__erp4uSchema = schema;
    done(null);
  });
}

export function wrapPgPoolConnect(pool: PgPoolLike): void {
  if (!pool || typeof pool.connect !== 'function') {
    return;
  }
  if (pool.__erp4uTenantHookInstalled) {
    return;
  }

  const originalConnect = pool.connect.bind(pool) as (
    cb?: PoolConnectCallback,
  ) => void | Promise<TenantPgClient>;

  const wrappedConnect = function (
    cb?: PoolConnectCallback,
  ): void | Promise<TenantPgClient> {
    let ctx: TenantContext;
    try {
      ctx = TenantContext.current();
      assertValidTenantSchema(ctx.schema);
    } catch (err) {
      if (typeof cb === 'function') {
        const boundCb = AsyncResource.bind(cb);
        process.nextTick(() =>
          boundCb(err as Error, undefined as unknown as TenantPgClient, () => {}),
        );
        return;
      }
      return Promise.reject(err);
    }

    if (typeof cb === 'function') {
      const boundCb = AsyncResource.bind(cb);
      originalConnect((err, client, release) => {
        if (err || !client) {
          boundCb(err, client, release);
          return;
        }
        applySearchPath(client, ctx.schema, release, (applyErr) => {
          if (applyErr) {
            boundCb(applyErr, undefined as unknown as TenantPgClient, () => {});
            return;
          }
          boundCb(undefined, client, release);
        });
      });
      return;
    }

    return Promise.resolve(
      originalConnect() as Promise<TenantPgClient>,
    ).then(
      (client) =>
        new Promise<TenantPgClient>((resolve, reject) => {
          const release: ReleaseFn = (releaseErr?: unknown) => {
            if (typeof client.release === 'function') {
              client.release(releaseErr);
            }
          };
          applySearchPath(client, ctx.schema, release, (applyErr) => {
            if (applyErr) {
              reject(applyErr);
              return;
            }
            resolve(client);
          });
        }),
    );
  };

  pool.connect = wrappedConnect as PgPoolLike['connect'];
  pool.__erp4uTenantHookInstalled = true;
}

export function installTenantConnectionHook(dataSource: DataSource): boolean {
  if (!dataSource || !dataSource.isInitialized) {
    return false;
  }

  const driver = dataSource.driver as unknown as PostgresDriver & {
    master?: PgPoolLike;
    slaves?: PgPoolLike[];
  };

  if (!driver || !driver.master) {
    logger.warn(
      'PostgresDriver master pool not found on DataSource; skipping tenant connection hook.',
    );
    return false;
  }

  wrapPgPoolConnect(driver.master);

  if (Array.isArray(driver.slaves)) {
    for (const slavePool of driver.slaves) {
      wrapPgPoolConnect(slavePool);
    }
  }

  return true;
}

@Injectable()
export class TenantConnectionHook implements OnModuleInit {
  constructor(
    @Optional()
    @InjectDataSource()
    private readonly dataSource?: DataSource,
  ) {}

  onModuleInit(): void {
    if (this.dataSource) {
      installTenantConnectionHook(this.dataSource);
    }
  }
}
