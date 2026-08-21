import { newOrgId } from '../domain/ids';
import { orgError } from '../domain/org-error';
import { canManageOrg } from '../domain/policy';
import { Team } from '../domain/team';
import type { OrgDirectoryPort } from './ports/org-directory.port';
import { wrapOrg } from './wrap-org';

export class ListTeamsUseCase {
  constructor(private readonly directory: OrgDirectoryPort) {}

  execute(orgId: string, userId: string) {
    return wrapOrg(async () => {
      if (!(await this.directory.findMembership(orgId, userId))) {
        throw orgError('FORBIDDEN', 'Not a member of this organization');
      }
      return (await this.directory.listTeams(orgId)).map((t) => t.toPublic());
    });
  }
}

export class CreateTeamUseCase {
  constructor(private readonly directory: OrgDirectoryPort) {}

  execute(input: { orgId: string; actorId: string; departmentId: string; name: string; description?: string }) {
    return wrapOrg(async () => {
      const actor = await this.directory.findMembership(input.orgId, input.actorId);
      if (!actor || !canManageOrg(actor.role)) {
        throw orgError('FORBIDDEN', 'Only owners and admins can manage teams');
      }
      const dept = await this.directory.findDepartment(input.orgId, input.departmentId);
      if (!dept) throw orgError('NOT_FOUND', 'Department not found');
      const name = input.name.trim();
      if (name.length < 2 || name.length > 100) {
        throw orgError('VALIDATION_ERROR', 'Team name must be 2–100 characters', [
          { field: 'name', message: 'Team name must be 2–100 characters', code: 'INVALID' },
        ]);
      }
      const team = new Team(newOrgId(), input.orgId, dept.id, name, input.description?.trim() ?? '');
      await this.directory.saveTeam(team);
      return team.toPublic();
    });
  }
}

export class UpdateTeamUseCase {
  constructor(private readonly directory: OrgDirectoryPort) {}

  execute(input: { orgId: string; actorId: string; teamId: string; name?: string; description?: string }) {
    return wrapOrg(async () => {
      const actor = await this.directory.findMembership(input.orgId, input.actorId);
      if (!actor || !canManageOrg(actor.role)) {
        throw orgError('FORBIDDEN', 'Only owners and admins can manage teams');
      }
      const team = await this.directory.findTeam(input.orgId, input.teamId);
      if (!team) throw orgError('NOT_FOUND', 'Team not found');
      if (input.name) team.name = input.name.trim();
      if (input.description !== undefined) team.description = input.description.trim();
      await this.directory.saveTeam(team);
      return team.toPublic();
    });
  }
}

export class DeleteTeamUseCase {
  constructor(private readonly directory: OrgDirectoryPort) {}

  execute(input: { orgId: string; actorId: string; teamId: string }) {
    return wrapOrg(async () => {
      const actor = await this.directory.findMembership(input.orgId, input.actorId);
      if (!actor || !canManageOrg(actor.role)) {
        throw orgError('FORBIDDEN', 'Only owners and admins can manage teams');
      }
      const team = await this.directory.findTeam(input.orgId, input.teamId);
      if (!team) throw orgError('NOT_FOUND', 'Team not found');
      const assigned = (await this.directory.listMemberships(input.orgId)).filter((m) => m.teamId === team.id);
      for (const member of assigned) {
        member.teamId = null;
        await this.directory.saveMembership(member);
      }
      await this.directory.deleteTeam(input.orgId, team.id);
    });
  }
}
