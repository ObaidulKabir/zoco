import { Department } from '../domain/department';
import { newOrgId } from '../domain/ids';
import { orgError } from '../domain/org-error';
import { canManageOrg, MAX_DEPT_LEVEL } from '../domain/policy';
import type { OrgDirectoryPort } from './ports/org-directory.port';
import { wrapOrg } from './wrap-org';

const requireAdmin = async (directory: OrgDirectoryPort, orgId: string, userId: string) => {
  const actor = await directory.findMembership(orgId, userId);
  if (!actor || !canManageOrg(actor.role)) {
    throw orgError('FORBIDDEN', 'Only owners and admins can manage departments');
  }
  return actor;
};

export class ListDepartmentsUseCase {
  constructor(private readonly directory: OrgDirectoryPort) {}

  execute(orgId: string, userId: string) {
    return wrapOrg(async () => {
      if (!(await this.directory.findMembership(orgId, userId))) {
        throw orgError('FORBIDDEN', 'Not a member of this organization');
      }
      return (await this.directory.listDepartments(orgId)).map((d) => d.toPublic());
    });
  }
}

export class CreateDepartmentUseCase {
  constructor(private readonly directory: OrgDirectoryPort) {}

  execute(input: { orgId: string; actorId: string; name: string; description?: string; parentId?: string | null }) {
    return wrapOrg(async () => {
      await requireAdmin(this.directory, input.orgId, input.actorId);
      const name = input.name.trim();
      if (name.length < 2 || name.length > 100) {
        throw orgError('VALIDATION_ERROR', 'Department name must be 2–100 characters', [
          { field: 'name', message: 'Department name must be 2–100 characters', code: 'INVALID' },
        ]);
      }
      let level = 1;
      if (input.parentId) {
        const parent = await this.directory.findDepartment(input.orgId, input.parentId);
        if (!parent) throw orgError('NOT_FOUND', 'Parent department not found');
        level = parent.level + 1;
        if (level > MAX_DEPT_LEVEL) {
          throw orgError('VALIDATION_ERROR', `Departments cannot exceed ${MAX_DEPT_LEVEL} levels`, [
            { field: 'parentId', message: `Departments cannot exceed ${MAX_DEPT_LEVEL} levels`, code: 'LIMIT' },
          ]);
        }
      }
      const dept = new Department(
        newOrgId(),
        input.orgId,
        name,
        input.description?.trim() ?? '',
        input.parentId ?? null,
        level,
      );
      await this.directory.saveDepartment(dept);
      return dept.toPublic();
    });
  }
}

export class UpdateDepartmentUseCase {
  constructor(private readonly directory: OrgDirectoryPort) {}

  execute(input: { orgId: string; actorId: string; deptId: string; name?: string; description?: string }) {
    return wrapOrg(async () => {
      await requireAdmin(this.directory, input.orgId, input.actorId);
      const dept = await this.directory.findDepartment(input.orgId, input.deptId);
      if (!dept) throw orgError('NOT_FOUND', 'Department not found');
      if (input.name) dept.name = input.name.trim();
      if (input.description !== undefined) dept.description = input.description.trim();
      await this.directory.saveDepartment(dept);
      return dept.toPublic();
    });
  }
}

export class DeleteDepartmentUseCase {
  constructor(private readonly directory: OrgDirectoryPort) {}

  execute(input: { orgId: string; actorId: string; deptId: string; reassignToDepartmentId?: string }) {
    return wrapOrg(async () => {
      await requireAdmin(this.directory, input.orgId, input.actorId);
      const dept = await this.directory.findDepartment(input.orgId, input.deptId);
      if (!dept) throw orgError('NOT_FOUND', 'Department not found');
      const members = (await this.directory.listMemberships(input.orgId)).filter((m) => m.departmentId === dept.id);
      const teams = (await this.directory.listTeams(input.orgId)).filter((t) => t.departmentId === dept.id);
      const children = (await this.directory.listDepartments(input.orgId)).filter((d) => d.parentId === dept.id);
      if (members.length || teams.length || children.length) {
        if (!input.reassignToDepartmentId) {
          throw orgError('VALIDATION_ERROR', 'Reassign members and teams before deleting this department', [
            { field: 'reassignToDepartmentId', message: 'Reassignment is required', code: 'REQUIRED' },
          ]);
        }
        const target = await this.directory.findDepartment(input.orgId, input.reassignToDepartmentId);
        if (!target) throw orgError('NOT_FOUND', 'Reassignment department not found');
        for (const member of members) {
          member.departmentId = target.id;
          await this.directory.saveMembership(member);
        }
        for (const team of teams) {
          team.departmentId = target.id;
          await this.directory.saveTeam(team);
        }
        for (const child of children) {
          child.parentId = target.id;
          await this.directory.saveDepartment(child);
        }
      }
      await this.directory.deleteDepartment(input.orgId, dept.id);
    });
  }
}
