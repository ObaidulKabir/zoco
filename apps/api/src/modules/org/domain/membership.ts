import type { OrgRole } from './policy';

export class Membership {
  constructor(
    readonly id: string,
    readonly orgId: string,
    readonly userId: string,
    readonly email: string,
    public role: OrgRole,
    public departmentId: string | null,
    public teamId: string | null,
    readonly createdAt: Date,
  ) {}

  toPublic() {
    return {
      id: this.id,
      orgId: this.orgId,
      userId: this.userId,
      email: this.email,
      role: this.role,
      departmentId: this.departmentId,
      teamId: this.teamId,
    };
  }
}
