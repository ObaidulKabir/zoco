import { closePool, isPostgresEnabled } from './db/pool';
import { runMigrations } from './db/migrator';
import { loadRootEnv } from './load-env';

export async function migrate(): Promise<void> {
  loadRootEnv();
  if (!isPostgresEnabled()) {
    throw new Error('DATABASE_URL is not set; nothing to migrate');
  }
  const applied = await runMigrations();
  // eslint-disable-next-line no-console
  console.log(applied.length ? `migrate: applied ${applied.join(', ')}` : 'migrate: already up to date');
}

if (require.main === module) {
  migrate()
    .then(() => closePool())
    .catch(async (error: Error) => {
      // eslint-disable-next-line no-console
      console.error(error.message);
      await closePool();
      process.exit(1);
    });
}
