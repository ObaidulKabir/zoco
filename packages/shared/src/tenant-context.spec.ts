import { getTenantContext, requireTenantId, runWithTenant } from './tenant-context';

describe('tenant context', () => {
  it('defaults to no tenant', () => {
    expect(getTenantContext().tenantId).toBeNull();
  });

  it('isolates tenant inside runWithTenant', () => {
    runWithTenant(
      { tenantId: 'acme', userId: 'u1', requestId: 'r1' },
      () => {
        expect(getTenantContext().tenantId).toBe('acme');
        expect(requireTenantId()).toBe('acme');
      },
    );
    expect(getTenantContext().tenantId).toBeNull();
  });

  it('requireTenantId throws without context', () => {
    expect(() => requireTenantId()).toThrow(/tenant_id missing/);
  });
});
