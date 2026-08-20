/**
 * Sprint 0 stub. Real migrations live under infra/postgres and run via Compose init.
 * Sprint 2+ will replace this with a versioned migrator owned by each module.
 */
export async function migrate(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('migrate: RLS helper applied by postgres docker-entrypoint (000_rls_helper.sql)');
}

if (require.main === module) {
  void migrate();
}
