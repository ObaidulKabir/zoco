import { Pool, type PoolClient, type QueryResultRow } from 'pg';

let pool: Pool | null = null;

export const databaseUrl = (): string | undefined => {
  const url = process.env.DATABASE_URL?.trim();
  return url ? url : undefined;
};

/**
 * Persistence is chosen explicitly, not inferred from DATABASE_URL, because
 * .env.example ships a connection string and a developer without Postgres
 * running should still get a working API on the in-memory stores.
 */
export const isPostgresEnabled = (): boolean =>
  process.env.PERSISTENCE === 'postgres' && Boolean(databaseUrl());

export const getPool = (): Pool => {
  if (pool) return pool;
  const connectionString = databaseUrl();
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  pool = new Pool({ connectionString, max: Number(process.env.PG_POOL_MAX ?? 10) });
  return pool;
};

export const closePool = async (): Promise<void> => {
  if (!pool) return;
  const closing = pool;
  pool = null;
  await closing.end();
};

export const query = async <T extends QueryResultRow>(text: string, values: unknown[] = []): Promise<T[]> => {
  const result = await getPool().query<T>(text, values);
  return result.rows;
};

export const withClient = async <T>(fn: (client: PoolClient) => Promise<T>): Promise<T> => {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
};

/**
 * Runs a unit of work with the `app.tenant_id` GUC set, so the RLS policies in
 * 002_org.sql narrow every statement to that organization. set_config is
 * transaction-local, hence the explicit transaction.
 */
export const withTenant = async <T>(tenantId: string, fn: (client: PoolClient) => Promise<T>): Promise<T> =>
  withClient(async (client) => {
    await client.query('begin');
    try {
      await client.query('select zoqo_set_tenant($1)', [tenantId]);
      const result = await fn(client);
      await client.query('commit');
      return result;
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
  });
