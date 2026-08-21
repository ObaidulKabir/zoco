import { orgError } from '../domain/org-error';
import type { OrgDirectoryPort } from './ports/org-directory.port';
import { wrapOrg } from './wrap-org';

export class GetOrganizationUseCase {
  constructor(private readonly directory: OrgDirectoryPort) {}

  execute(orgId: string, userId: string) {
    return wrapOrg(async () => {
      const membership = await this.directory.findMembership(orgId, userId);
      if (!membership) throw orgError('FORBIDDEN', 'Not a member of this organization');
      const org = await this.directory.findOrgById(orgId);
      if (!org) throw orgError('NOT_FOUND', 'Organization not found');
      const [departments, channels, discover] = await Promise.all([
        this.directory.listDepartments(orgId),
        this.directory.listChannels(orgId),
        this.directory.findDiscover(orgId),
      ]);
      return {
        organization: org.toPublic(),
        membership: membership.toPublic(),
        departments: departments.map((d) => d.toPublic()),
        channels: channels.map((c) => c.toPublic()),
        discoverProfile: discover?.toPublic() ?? null,
      };
    });
  }
}
