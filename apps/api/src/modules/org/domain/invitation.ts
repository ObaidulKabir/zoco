import type { InviteRole } from './policy';

export type InvitationStatus = 'pending' | 'accepted' | 'expired';

export class Invitation {
  constructor(
    readonly id: string,
    readonly orgId: string,
    readonly email: string,
    readonly role: InviteRole,
    readonly departmentId: string | null,
    readonly tokenHash: string,
    readonly expiresAt: Date,
    public status: InvitationStatus,
  ) {}

  isPending(now: Date): boolean {
    return this.status === 'pending' && this.expiresAt.getTime() > now.getTime();
  }

  toPublic() {
    return {
      id: this.id,
      orgId: this.orgId,
      email: this.email,
      role: this.role,
      departmentId: this.departmentId,
      expiresAt: this.expiresAt.toISOString(),
      status: this.status,
    };
  }
}
