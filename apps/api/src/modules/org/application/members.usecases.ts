import { orgError } from '../domain/org-error';
import { canManageOrg, ORG_ROLES, type OrgRole } from '../domain/policy';
import type { OrgDirectoryPort } from './ports/org-directory.port';
import { wrapOrg } from './wrap-org';

export class ListMembersUseCase {
  constructor(private readonly directory: OrgDirectoryPort) {}

  execute(orgId: string, userId: string) {
    return wrapOrg(async () => {
      if (!(await this.directory.findMembership(orgId, userId))) {
        throw orgError('FORBIDDEN', 'Not a member of this organization');
      }
      const members = await this.directory.listMemberships(orgId);
      return members.map((m) => m.toPublic());
    });
  }
}

export class UpdateMemberRoleUseCase {
  constructor(private readonly directory: OrgDirectoryPort) {}

  execute(input: { orgId: string; actorId: string; userId: string; role?: string; departmentId?: string | null }) {
    return wrapOrg(async () => {
      const actor = await this.directory.findMembership(input.orgId, input.actorId);
      const member = await this.directory.findMembership(input.orgId, input.userId);
      if (!member) throw orgError('NOT_FOUND', 'Member not found');
      const selfAssign = actor && actor.userId === member.userId && input.departmentId !== undefined && !input.role;
      if (!selfAssign && (!actor || !canManageOrg(actor.role))) {
        throw orgError('FORBIDDEN', 'Only owners and admins can change roles');
      }
      if (input.role) {
        if (member.role === 'owner') throw orgError('FORBIDDEN', 'Cannot change the owner');
        if (!(ORG_ROLES as readonly string[]).includes(input.role) || input.role === 'owner') {
          throw orgError('VALIDATION_ERROR', 'Role is invalid', [
            { field: 'role', message: 'Role is invalid', code: 'INVALID' },
          ]);
        }
        member.role = input.role as OrgRole;
      }
      if (input.departmentId !== undefined) member.departmentId = input.departmentId;
      await this.directory.saveMembership(member);
      return member.toPublic();
    });
  }
}

export class RemoveMemberUseCase {
  constructor(private readonly directory: OrgDirectoryPort) {}

  execute(input: { orgId: string; actorId: string; userId: string }) {
    return wrapOrg(async () => {
      const actor = await this.directory.findMembership(input.orgId, input.actorId);
      if (!actor || !canManageOrg(actor.role)) {
        throw orgError('FORBIDDEN', 'Only owners and admins can remove members');
      }
      const member = await this.directory.findMembership(input.orgId, input.userId);
      if (!member) throw orgError('NOT_FOUND', 'Member not found');
      if (member.role === 'owner') throw orgError('FORBIDDEN', 'Cannot remove the owner');
      await this.directory.deleteMembership(input.orgId, input.userId);
    });
  }
}
