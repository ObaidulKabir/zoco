import type { Organization } from '../../domain/organization';

export interface OrgStorePort {
  list(): Promise<Organization[]>;
}
