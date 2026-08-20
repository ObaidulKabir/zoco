import type { Organization } from '../domain/organization';
import type { OrgStorePort } from './ports/org-store.port';

export class ListOrgsUseCase {
  constructor(private readonly store: OrgStorePort) {}

  execute(): Promise<Organization[]> {
    return this.store.list();
  }
}
