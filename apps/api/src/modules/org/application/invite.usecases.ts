import type { ClockPort, MailerPort } from '@zoqo/shared';
import { Invitation } from '../domain/invitation';
import { newOrgId, randomToken, sha256 } from '../domain/ids';
import { orgError } from '../domain/org-error';
import { MemberProfile } from '../domain/member-profile';
import { Membership } from '../domain/membership';
import { FREE_MEMBER_CAP, INVITE_ROLES, INVITE_TTL_MS, canInvite, type InviteRole } from '../domain/policy';
import { parseInviteEmails } from './parse-emails';
import type { InviteRegistryPort } from './ports/invite-registry.port';
import type { OrgDirectoryPort } from './ports/org-directory.port';
import type { PeoplePort } from './ports/people.port';
import { wrapOrg } from './wrap-org';

export class InviteMembersUseCase {
  constructor(
    private readonly directory: OrgDirectoryPort,
    private readonly people: PeoplePort,
    private readonly mailer: MailerPort,
    private readonly clock: ClockPort,
    private readonly webUrl: string,
    private readonly inviteRegistry: InviteRegistryPort,
  ) {}

  execute(input: { orgId: string; actorId: string; emails?: string[]; csv?: string; role?: string; departmentId?: string }) {
    return wrapOrg(async () => {
      const actor = await this.directory.findMembership(input.orgId, input.actorId);
      const org = await this.directory.findOrgById(input.orgId);
      if (!actor || !org) throw orgError('FORBIDDEN', 'Not a member of this organization');
      if (!canInvite(actor.role, org.settings.invitationPolicy)) {
        throw orgError('FORBIDDEN', 'You cannot invite members under the current policy');
      }
      const role = (input.role ?? 'member') as InviteRole;
      if (!(INVITE_ROLES as readonly string[]).includes(role)) {
        throw orgError('VALIDATION_ERROR', 'Invite role must be member, manager, or admin', [
          { field: 'role', message: 'Invite role must be member, manager, or admin', code: 'INVALID' },
        ]);
      }
      const emails = parseInviteEmails({ emails: input.emails, csv: input.csv });
      const now = this.clock.now();
      const used = (await this.directory.countMemberships(org.id)) + (await this.directory.countPendingInvites(org.id, now));
      if (used + emails.length > FREE_MEMBER_CAP) {
        throw orgError('VALIDATION_ERROR', `Free tier allows at most ${FREE_MEMBER_CAP} members`, [
          { field: 'emails', message: `Free tier allows at most ${FREE_MEMBER_CAP} members`, code: 'LIMIT' },
        ]);
      }
      const created = [];
      for (const email of emails) {
        const existingMember = (await this.directory.listMemberships(org.id)).find((m) => m.email === email);
        if (existingMember) {
          throw orgError('DUPLICATE', 'That person is already a member', [
            { field: 'emails', message: `${email} is already a member`, code: 'DUPLICATE' },
          ]);
        }
        const previous = await this.directory.findInvitationByEmail(org.id, email);
        if (previous?.isPending(now)) {
          throw orgError('DUPLICATE', 'An invitation is already pending for that email', [
            { field: 'emails', message: 'An invitation is already pending for that email', code: 'DUPLICATE' },
          ]);
        }
        const token = randomToken();
        const expiresAt = new Date(now.getTime() + INVITE_TTL_MS);
        const invite = new Invitation(
          newOrgId(),
          org.id,
          email,
          role,
          input.departmentId ?? null,
          sha256(token),
          expiresAt,
          'pending',
        );
        await this.directory.saveInvitation(invite);
        await this.inviteRegistry.record({ tokenHash: invite.tokenHash, email, expiresAt });
        const existing = await this.people.findByEmail(email);
        const link = `${this.webUrl}/invite/accept?token=${token}`;
        await this.mailer.send({
          to: email,
          subject: `You've been invited to join ${org.name}`,
          text: existing
            ? `You've been invited to join ${org.name}. Accept: ${link}`
            : `You've been invited to join ${org.name}. Register, then accept: ${this.webUrl}/register?invite=${token}`,
        });
        created.push({ ...invite.toPublic(), token });
      }
      return { invitations: created };
    });
  }
}

export class AcceptInviteUseCase {
  constructor(
    private readonly directory: OrgDirectoryPort,
    private readonly people: PeoplePort,
    private readonly clock: ClockPort,
  ) {}

  execute(input: { userId: string; token: string }) {
    return wrapOrg(async () => {
      const person = await this.people.findById(input.userId);
      if (!person) throw orgError('UNAUTHORIZED', 'Unknown user');
      const invite = await this.directory.findInvitationByTokenHash(sha256(input.token));
      const now = this.clock.now();
      if (!invite || !invite.isPending(now)) {
        throw orgError('VALIDATION_ERROR', 'Invitation is invalid or expired', [
          { field: 'token', message: 'Invitation is invalid or expired', code: 'INVALID' },
        ]);
      }
      if (invite.email !== person.email) {
        throw orgError('FORBIDDEN', 'This invitation was sent to a different email');
      }
      if (await this.directory.findMembership(invite.orgId, person.id)) {
        throw orgError('DUPLICATE', 'Already a member of this organization');
      }
      const org = await this.directory.findOrgById(invite.orgId);
      if (!org) throw orgError('NOT_FOUND', 'Organization not found');
      const membership = new Membership(
        newOrgId(),
        org.id,
        person.id,
        person.email,
        invite.role,
        invite.departmentId,
        null,
        now,
      );
      await this.directory.saveMembership(membership);
      invite.status = 'accepted';
      await this.directory.saveInvitation(invite);
      const general = await this.directory.findChannelBySlug(org.id, 'general');
      if (general) {
        general.addMember(person.id);
        await this.directory.saveChannel(general);
      }
      await this.directory.saveProfile(
        new MemberProfile(person.id, org.id, person.name, '', '', null, org.timezone, 'en', '', 'offline'),
      );
      return { membership: membership.toPublic(), channel: general?.toPublic() ?? null };
    });
  }
}
