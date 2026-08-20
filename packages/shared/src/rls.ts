/** Sprint 0 stub: caller must set Postgres RLS `app.tenant_id` before querying. */
export const tenantRlsSessionSql = (tenantId: string): string =>
  `select set_config('app.tenant_id', '${tenantId.replace(/'/g, "''")}', true)`;
