import { Injectable } from '@nestjs/common';
import type { Organization } from '../../domain/organization';
import type { OrgStorePort } from '../../application/ports/org-store.port';

@Injectable()
export class InMemoryOrgStore implements OrgStorePort {
  private readonly orgs: Organization[] = [];

  list(): Promise<Organization[]> {
    return Promise.resolve([...this.orgs]);
  }
}
