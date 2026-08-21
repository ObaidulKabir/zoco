import { FixedClock, InMemoryMailer, InMemoryObjectStorage } from '@zoqo/shared';
import { InMemoryOrgDirectory } from '../../src/modules/org/infrastructure/persistence/in-memory-org-directory';
import { CreateOrganizationUseCase } from '../../src/modules/org/application/create-organization.usecase';
import { GetOrganizationUseCase } from '../../src/modules/org/application/get-organization.usecase';
import { AcceptInviteUseCase, InviteMembersUseCase } from '../../src/modules/org/application/invite.usecases';
import {
  CreateDepartmentUseCase,
  DeleteDepartmentUseCase,
  ListDepartmentsUseCase,
  UpdateDepartmentUseCase,
} from '../../src/modules/org/application/departments.usecases';
import { ListMembersUseCase, RemoveMemberUseCase, UpdateMemberRoleUseCase } from '../../src/modules/org/application/members.usecases';
import {
  GetProfileUseCase,
  RequestAvatarUploadUseCase,
  RequestLogoUploadUseCase,
  UpdateProfileUseCase,
} from '../../src/modules/org/application/profile.usecases';
import { UpdateOrgSettingsUseCase } from '../../src/modules/org/application/settings.usecase';
import { CreateTeamUseCase, DeleteTeamUseCase, ListTeamsUseCase, UpdateTeamUseCase } from '../../src/modules/org/application/teams.usecases';
import type { InviteRegistryPort } from '../../src/modules/org/application/ports/invite-registry.port';
import type { OrgAuditPort } from '../../src/modules/org/application/ports/org-audit.port';
import type { PeoplePort, Person } from '../../src/modules/org/application/ports/people.port';
import { parseInviteEmails } from '../../src/modules/org/application/parse-emails';
import { slugify, uniqueSlug, validateIndustry, validateOrgName } from '../../src/modules/org/domain/validation';
import { canInvite } from '../../src/modules/org/domain/policy';
import { wrapOrg } from '../../src/modules/org/application/wrap-org';

class People implements PeoplePort {
  constructor(private readonly persons: Person[]) {}
  findById(id: string) {
    return Promise.resolve(this.persons.find((p) => p.id === id) ?? null);
  }
  findByEmail(email: string) {
    return Promise.resolve(this.persons.find((p) => p.email === email) ?? null);
  }
}

class Audit implements OrgAuditPort {
  events: Array<{ type: string }> = [];
  async record(event: { type: string }) {
    this.events.push(event);
  }
}

class InviteRegistry implements InviteRegistryPort {
  recorded: Array<{ tokenHash: string; email: string; expiresAt: Date }> = [];
  async record(input: { tokenHash: string; email: string; expiresAt: Date }) {
    this.recorded.push(input);
  }
}

const sarah = { id: 's1', email: 'sarah@acme.test', name: 'Sarah Chen' };
const pat = { id: 'p1', email: 'pat@acme.test', name: 'Pat' };
const rahim = { id: 'r1', email: 'rahim@nodi.test', name: 'Rahim' };

describe('org use cases', () => {
  const clock = new FixedClock(new Date('2026-08-20T12:00:00Z'));
  const setup = () => {
    const directory = new InMemoryOrgDirectory();
    const people = new People([sarah, pat, rahim]);
    const mailer = new InMemoryMailer();
    const storage = new InMemoryObjectStorage();
    const audit = new Audit();
    const inviteRegistry = new InviteRegistry();
    const create = new CreateOrganizationUseCase(directory, people, clock);
    return { directory, people, mailer, storage, audit, create, inviteRegistry };
  };

  it('creates org with owner, defaults, slug, and discover stub', async () => {
    const { create, directory } = setup();
    const result = await create.execute({
      userId: sarah.id,
      name: 'Acme',
      industry: 'Software',
      size: '11-50',
      country: 'bd',
      timezone: 'Asia/Dhaka',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.organization.slug).toBe('acme');
    expect(result.value.membership.role).toBe('owner');
    expect(result.value.departments.map((d) => d.name)).toEqual(['General', 'Management']);
    expect(result.value.channels.map((c) => c.slug)).toEqual(['general', 'announcements']);
    expect(result.value.discoverProfile?.published).toBe(false);
    expect(await directory.countOrgsForUser(sarah.id)).toBe(1);
  });

  it('suffixes colliding slugs and rejects invalid industry', async () => {
    const { create } = setup();
    await create.execute({
      userId: sarah.id,
      name: 'Acme',
      industry: 'Software',
      size: '11-50',
      country: 'BD',
      timezone: 'Asia/Dhaka',
    });
    const second = await create.execute({
      userId: sarah.id,
      name: 'Acme',
      industry: 'Software',
      size: '11-50',
      country: 'BD',
      timezone: 'Asia/Dhaka',
    });
    expect(second.ok && second.value.organization.slug).toBe('acme-2');
    const bad = await create.execute({
      userId: sarah.id,
      name: 'X',
      industry: 'Nope',
      size: '11-50',
      country: 'BD',
      timezone: 'Asia/Dhaka',
    });
    expect(bad.ok).toBe(false);
  });

  it('invites, accepts into #general, and isolates tenants', async () => {
    const { create, directory, people, mailer, inviteRegistry } = setup();
    const acme = await create.execute({
      userId: sarah.id,
      name: 'Acme',
      industry: 'Software',
      size: '11-50',
      country: 'BD',
      timezone: 'Asia/Dhaka',
    });
    const nodi = await create.execute({
      userId: rahim.id,
      name: 'Nodi Traders',
      industry: 'Trading',
      size: '1-10',
      country: 'BD',
      timezone: 'Asia/Dhaka',
    });
    expect(acme.ok && nodi.ok).toBe(true);
    if (!acme.ok || !nodi.ok) return;
    const invite = new InviteMembersUseCase(directory, people, mailer, clock, 'http://web', inviteRegistry);
    const sent = await invite.execute({
      orgId: acme.value.organization.id,
      actorId: sarah.id,
      emails: ['pat@acme.test'],
      role: 'member',
    });
    expect(sent.ok && sent.value.invitations).toHaveLength(1);
    expect(mailer.sent[0]?.to).toBe('pat@acme.test');
    expect(inviteRegistry.recorded).toEqual([
      { tokenHash: expect.any(String), email: 'pat@acme.test', expiresAt: expect.any(Date) },
    ]);
    const dup = await invite.execute({
      orgId: acme.value.organization.id,
      actorId: sarah.id,
      emails: ['pat@acme.test'],
    });
    expect(dup.ok).toBe(false);
    const accept = new AcceptInviteUseCase(directory, people, clock);
    const joined = await accept.execute({ userId: pat.id, token: sent.ok ? sent.value.invitations[0]?.token ?? '' : '' });
    expect(joined.ok).toBe(true);
    const general = await directory.findChannelBySlug(acme.value.organization.id, 'general');
    expect(general?.memberIds).toContain(pat.id);
    const members = new ListMembersUseCase(directory);
    const isolated = await members.execute(acme.value.organization.id, rahim.id);
    expect(isolated.ok).toBe(false);
    const acmeMembers = await members.execute(acme.value.organization.id, sarah.id);
    expect(acmeMembers.ok && acmeMembers.value.map((m) => m.email)).toEqual(
      expect.arrayContaining(['sarah@acme.test', 'pat@acme.test']),
    );
  });

  it('enforces department depth, reassignment, and teams', async () => {
    const { create, directory } = setup();
    const acme = await create.execute({
      userId: sarah.id,
      name: 'Acme',
      industry: 'Software',
      size: '11-50',
      country: 'BD',
      timezone: 'Asia/Dhaka',
    });
    if (!acme.ok) return;
    const orgId = acme.value.organization.id;
    const generalId = acme.value.departments[0]?.id ?? '';
    const createDept = new CreateDepartmentUseCase(directory);
    let parent = generalId;
    for (const name of ['L2', 'L3', 'L4', 'L5']) {
      const dept = await createDept.execute({ orgId, actorId: sarah.id, name, parentId: parent });
      expect(dept.ok).toBe(true);
      if (dept.ok) parent = dept.value.id;
    }
    const sixth = await createDept.execute({ orgId, actorId: sarah.id, name: 'L6', parentId: parent });
    expect(sixth.ok).toBe(false);
    const eng = await createDept.execute({ orgId, actorId: sarah.id, name: 'Engineering', parentId: generalId });
    expect(eng.ok).toBe(true);
    if (!eng.ok) return;
    const del = new DeleteDepartmentUseCase(directory);
    const blocked = await del.execute({ orgId, actorId: sarah.id, deptId: eng.value.id });
    expect(blocked.ok).toBe(true);
    const team = await new CreateTeamUseCase(directory).execute({
      orgId,
      actorId: sarah.id,
      departmentId: generalId,
      name: 'Platform',
    });
    expect(team.ok && team.value.name).toBe('Platform');
    if (!team.ok) return;
    await new UpdateTeamUseCase(directory).execute({
      orgId,
      actorId: sarah.id,
      teamId: team.value.id,
      description: 'Core',
    });
    await new DeleteTeamUseCase(directory).execute({ orgId, actorId: sarah.id, teamId: team.value.id });
    expect(await new ListTeamsUseCase(directory).execute(orgId, sarah.id)).toMatchObject({ ok: true, value: [] });
    await new UpdateDepartmentUseCase(directory).execute({
      orgId,
      actorId: sarah.id,
      deptId: generalId,
      description: 'Everyone',
    });
    expect((await new ListDepartmentsUseCase(directory).execute(orgId, sarah.id)).ok).toBe(true);
  });

  it('updates profile, validates avatar/logo, and records settings audit', async () => {
    const { create, directory, storage, audit } = setup();
    const acme = await create.execute({
      userId: sarah.id,
      name: 'Acme',
      industry: 'Software',
      size: '11-50',
      country: 'BD',
      timezone: 'Asia/Dhaka',
    });
    if (!acme.ok) return;
    const orgId = acme.value.organization.id;
    const profile = await new UpdateProfileUseCase(directory).execute({
      orgId,
      userId: sarah.id,
      title: 'Founder',
      presence: 'away',
      language: 'bn',
    });
    expect(profile.ok && profile.value.title).toBe('Founder');
    const avatar = new RequestAvatarUploadUseCase(directory, storage);
    expect((await avatar.execute({ orgId, userId: sarah.id, contentType: 'image/png', size: 1024 })).ok).toBe(true);
    expect((await avatar.execute({ orgId, userId: sarah.id, contentType: 'image/png', size: 6_000_000 })).ok).toBe(
      false,
    );
    const logo = new RequestLogoUploadUseCase(directory, storage);
    expect((await logo.execute({ orgId, actorId: sarah.id, contentType: 'image/png', size: 100 })).ok).toBe(true);
    expect((await logo.execute({ orgId, actorId: sarah.id, contentType: 'text/plain', size: 10 })).ok).toBe(false);
    const settings = await new UpdateOrgSettingsUseCase(directory, audit, clock).execute({
      orgId,
      actorId: sarah.id,
      invitationPolicy: 'owner_only',
    });
    expect(settings.ok && settings.value.settings.invitationPolicy).toBe('owner_only');
    expect(audit.events.some((e) => e.type === 'org_settings_updated')).toBe(true);
    expect((await new GetProfileUseCase(directory).execute(orgId, sarah.id)).ok).toBe(true);
    expect((await new GetOrganizationUseCase(directory).execute(orgId, sarah.id)).ok).toBe(true);
  });

  it('parses CSV emails and policy helpers', () => {
    expect(parseInviteEmails({ csv: 'email\nlee@acme.test,admin@acme.test' })).toEqual([
      'lee@acme.test',
      'admin@acme.test',
    ]);
    expect(() => parseInviteEmails({ emails: [] })).toThrow();
    expect(slugify('Acme Corp!')).toBe('acme-corp');
    expect(uniqueSlug('acme', new Set(['acme']))).toBe('acme-2');
    expect(canInvite('member', 'anyone')).toBe(true);
    expect(canInvite('member', 'admins_only')).toBe(false);
    expect(() => validateIndustry('Nope')).toThrow();
    expect(validateOrgName('Acme')).toBe('Acme');
  });

  it('wraps org errors and rethrows others', async () => {
    const ok = await wrapOrg(async () => 1);
    expect(ok).toEqual({ ok: true, value: 1 });
    await expect(
      wrapOrg(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });

  it('promotes and removes members', async () => {
    const { create, directory, people, mailer, inviteRegistry } = setup();
    const acme = await create.execute({
      userId: sarah.id,
      name: 'Acme',
      industry: 'Software',
      size: '11-50',
      country: 'BD',
      timezone: 'Asia/Dhaka',
    });
    if (!acme.ok) return;
    const orgId = acme.value.organization.id;
    const invite = new InviteMembersUseCase(directory, people, mailer, clock, 'http://web', inviteRegistry);
    const sent = await invite.execute({ orgId, actorId: sarah.id, csv: 'pat@acme.test', role: 'member' });
    if (!sent.ok) return;
    await new AcceptInviteUseCase(directory, people, clock).execute({
      userId: pat.id,
      token: sent.value.invitations[0]?.token ?? '',
    });
    const updated = await new UpdateMemberRoleUseCase(directory).execute({
      orgId,
      actorId: sarah.id,
      userId: pat.id,
      role: 'manager',
    });
    expect(updated.ok && updated.value.role).toBe('manager');
    const removed = await new RemoveMemberUseCase(directory).execute({ orgId, actorId: sarah.id, userId: pat.id });
    expect(removed.ok).toBe(true);
  });
});
