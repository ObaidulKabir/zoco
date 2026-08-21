import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { PoolClient } from 'pg';
import { withClient } from './pool';

const migrationsDir = join(__dirname, '../../migrations');
/** Applied by the Compose entrypoint too; re-running is safe because it is `create or replace`. */
const bootstrapDir = join(__dirname, '../../../../infra/postgres');

const sqlFilesIn = (dir: string): string[] =>
  existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.sql')).sort() : [];

const ensureLedger = (client: PoolClient) =>
  client.query(`
    create table if not exists schema_migrations (
      name       text primary key,
      applied_at timestamptz not null default now()
    )
  `);

/**
 * Postgres always bypasses row-level security for superusers, so connecting as
 * one turns every tenant policy into a no-op without a single error. Refuse
 * rather than let that reach an environment with real tenants in it.
 */
async function assertNotSuperuser(client: PoolClient): Promise<void> {
  const { rows } = await client.query<{ current_user: string; is_super: boolean }>(
    'select current_user, coalesce((select rolsuper from pg_roles where rolname = current_user), false) as is_super',
  );
  if (rows[0]?.is_super) {
    throw new Error(
      `Refusing to migrate as superuser "${rows[0].current_user}": row-level security is bypassed for ` +
        'superusers, so tenant isolation would be silently disabled. Point DATABASE_URL at a ' +
        'non-superuser role (the Compose stack creates zoqo_app for this).',
    );
  }
}

export async function runMigrations(): Promise<string[]> {
  return withClient(async (client) => {
    await assertNotSuperuser(client);
    for (const file of sqlFilesIn(bootstrapDir)) {
      await client.query(readFileSync(join(bootstrapDir, file), 'utf8'));
    }
    await ensureLedger(client);

    const { rows } = await client.query<{ name: string }>('select name from schema_migrations');
    const applied = new Set(rows.map((r) => r.name));
    const pending = sqlFilesIn(migrationsDir).filter((f) => !applied.has(f));

    for (const file of pending) {
      await client.query('begin');
      try {
        await client.query(readFileSync(join(migrationsDir, file), 'utf8'));
        await client.query('insert into schema_migrations (name) values ($1)', [file]);
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        throw new Error(`migration ${file} failed: ${(error as Error).message}`);
      }
    }
    return pending;
  });
}
