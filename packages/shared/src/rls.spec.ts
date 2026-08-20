import { tenantRlsSessionSql } from './rls';

describe('tenantRlsSessionSql', () => {
  it('sets app.tenant_id and escapes quotes', () => {
    expect(tenantRlsSessionSql("acme")).toContain("set_config('app.tenant_id', 'acme', true)");
    expect(tenantRlsSessionSql("a'b")).toContain("'a''b'");
  });
});
