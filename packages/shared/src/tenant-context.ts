import { AsyncLocalStorage } from 'node:async_hooks';

export type TenantContext = {
  tenantId: string | null;
  userId: string | null;
  requestId: string;
};

const storage = new AsyncLocalStorage<TenantContext>();

export const emptyTenantContext = (requestId = 'local'): TenantContext => ({
  tenantId: null,
  userId: null,
  requestId,
});

export const runWithTenant = <T>(ctx: TenantContext, fn: () => T): T =>
  storage.run(ctx, fn);

export const getTenantContext = (): TenantContext =>
  storage.getStore() ?? emptyTenantContext();

export const requireTenantId = (): string => {
  const id = getTenantContext().tenantId;
  if (!id) {
    throw new Error('tenant_id missing from auth context');
  }
  return id;
};
