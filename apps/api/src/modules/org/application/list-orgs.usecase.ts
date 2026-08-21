import type { Organization } from '../domain/organization';
import type { OrgDirectoryPort } from './ports/org-directory.port';

export class ListOrgsUseCase {
  constructor(private readonly directory: OrgDirectoryPort) {}

  execute(userId: string): Promise<Organization[]> {
    return this.directory.listOrgsForUser(userId);
  }
}
