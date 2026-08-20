import { ListOrgsUseCase } from './list-orgs.usecase';
import type { OrgStorePort } from './ports/org-store.port';
import { Organization } from '../domain/organization';

class OrgStore implements OrgStorePort {
  constructor(private readonly orgs: Organization[]) {}
  list() {
    return Promise.resolve(this.orgs);
  }
}

describe('ListOrgsUseCase', () => {
  it('returns no organizations until Sprint 2 seed', async () => {
    const usecase = new ListOrgsUseCase(new OrgStore([]));
    await expect(usecase.execute()).resolves.toEqual([]);
  });

  it('returns organizations from the store', async () => {
    const org = new Organization('1', 'Acme', 'acme');
    const usecase = new ListOrgsUseCase(new OrgStore([org]));
    await expect(usecase.execute()).resolves.toEqual([org]);
  });
});
