import { Injectable } from '@nestjs/common';
import type { Channel } from '../../domain/channel';
import type { Department } from '../../domain/department';
import type { DiscoverProfile } from '../../domain/discover-profile';
import type { Invitation } from '../../domain/invitation';
import type { MemberProfile } from '../../domain/member-profile';
import type { Membership } from '../../domain/membership';
import type { Organization } from '../../domain/organization';
import type { Team } from '../../domain/team';
import type { OrgDirectoryPort } from '../../application/ports/org-directory.port';

@Injectable()
export class InMemoryOrgDirectory implements OrgDirectoryPort {
  orgs: Organization[] = [];
  memberships: Membership[] = [];
  departments: Department[] = [];
  teams: Team[] = [];
  invitations: Invitation[] = [];
  channels: Channel[] = [];
  profiles: MemberProfile[] = [];
  discover: DiscoverProfile[] = [];

  async saveOrg(org: Organization): Promise<void> {
    const i = this.orgs.findIndex((o) => o.id === org.id);
    if (i >= 0) this.orgs[i] = org;
    else this.orgs.push(org);
  }

  async findOrgById(id: string): Promise<Organization | null> {
    return this.orgs.find((o) => o.id === id) ?? null;
  }

  async findOrgBySlug(slug: string): Promise<Organization | null> {
    return this.orgs.find((o) => o.slug === slug) ?? null;
  }

  async listOrgSlugs(): Promise<string[]> {
    return this.orgs.map((o) => o.slug);
  }

  async listOrgsForUser(userId: string): Promise<Organization[]> {
    const ids = new Set(this.memberships.filter((m) => m.userId === userId).map((m) => m.orgId));
    return this.orgs.filter((o) => ids.has(o.id));
  }

  async saveMembership(membership: Membership): Promise<void> {
    const i = this.memberships.findIndex((m) => m.id === membership.id);
    if (i >= 0) this.memberships[i] = membership;
    else this.memberships.push(membership);
  }

  async findMembership(orgId: string, userId: string): Promise<Membership | null> {
    return this.memberships.find((m) => m.orgId === orgId && m.userId === userId) ?? null;
  }

  async listMemberships(orgId: string): Promise<Membership[]> {
    return this.memberships.filter((m) => m.orgId === orgId);
  }

  async deleteMembership(orgId: string, userId: string): Promise<void> {
    this.memberships = this.memberships.filter((m) => !(m.orgId === orgId && m.userId === userId));
  }

  async countMemberships(orgId: string): Promise<number> {
    return this.memberships.filter((m) => m.orgId === orgId).length;
  }

  async countOrgsForUser(userId: string): Promise<number> {
    return new Set(this.memberships.filter((m) => m.userId === userId).map((m) => m.orgId)).size;
  }

  async saveDepartment(dept: Department): Promise<void> {
    const i = this.departments.findIndex((d) => d.id === dept.id);
    if (i >= 0) this.departments[i] = dept;
    else this.departments.push(dept);
  }

  async findDepartment(orgId: string, deptId: string): Promise<Department | null> {
    return this.departments.find((d) => d.orgId === orgId && d.id === deptId) ?? null;
  }

  async findDepartmentByName(orgId: string, name: string): Promise<Department | null> {
    return this.departments.find((d) => d.orgId === orgId && d.name.toLowerCase() === name.toLowerCase()) ?? null;
  }

  async listDepartments(orgId: string): Promise<Department[]> {
    return this.departments.filter((d) => d.orgId === orgId);
  }

  async deleteDepartment(orgId: string, deptId: string): Promise<void> {
    this.departments = this.departments.filter((d) => !(d.orgId === orgId && d.id === deptId));
  }

  async saveTeam(team: Team): Promise<void> {
    const i = this.teams.findIndex((t) => t.id === team.id);
    if (i >= 0) this.teams[i] = team;
    else this.teams.push(team);
  }

  async findTeam(orgId: string, teamId: string): Promise<Team | null> {
    return this.teams.find((t) => t.orgId === orgId && t.id === teamId) ?? null;
  }

  async listTeams(orgId: string): Promise<Team[]> {
    return this.teams.filter((t) => t.orgId === orgId);
  }

  async deleteTeam(orgId: string, teamId: string): Promise<void> {
    this.teams = this.teams.filter((t) => !(t.orgId === orgId && t.id === teamId));
  }

  async saveInvitation(invite: Invitation): Promise<void> {
    const i = this.invitations.findIndex((x) => x.id === invite.id);
    if (i >= 0) this.invitations[i] = invite;
    else this.invitations.push(invite);
  }

  async findInvitationByEmail(orgId: string, email: string): Promise<Invitation | null> {
    return this.invitations.find((i) => i.orgId === orgId && i.email === email) ?? null;
  }

  async findInvitationByTokenHash(tokenHash: string): Promise<Invitation | null> {
    return this.invitations.find((i) => i.tokenHash === tokenHash) ?? null;
  }

  async listInvitations(orgId: string): Promise<Invitation[]> {
    return this.invitations.filter((i) => i.orgId === orgId);
  }

  async countPendingInvites(orgId: string, now: Date): Promise<number> {
    return this.invitations.filter((i) => i.orgId === orgId && i.isPending(now)).length;
  }

  async saveChannel(channel: Channel): Promise<void> {
    const i = this.channels.findIndex((c) => c.id === channel.id);
    if (i >= 0) this.channels[i] = channel;
    else this.channels.push(channel);
  }

  async findChannelBySlug(orgId: string, slug: string): Promise<Channel | null> {
    return this.channels.find((c) => c.orgId === orgId && c.slug === slug) ?? null;
  }

  async listChannels(orgId: string): Promise<Channel[]> {
    return this.channels.filter((c) => c.orgId === orgId);
  }

  async saveProfile(profile: MemberProfile): Promise<void> {
    const i = this.profiles.findIndex((p) => p.orgId === profile.orgId && p.userId === profile.userId);
    if (i >= 0) this.profiles[i] = profile;
    else this.profiles.push(profile);
  }

  async findProfile(orgId: string, userId: string): Promise<MemberProfile | null> {
    return this.profiles.find((p) => p.orgId === orgId && p.userId === userId) ?? null;
  }

  async saveDiscover(profile: DiscoverProfile): Promise<void> {
    const i = this.discover.findIndex((d) => d.orgId === profile.orgId);
    if (i >= 0) this.discover[i] = profile;
    else this.discover.push(profile);
  }

  async findDiscover(orgId: string): Promise<DiscoverProfile | null> {
    return this.discover.find((d) => d.orgId === orgId) ?? null;
  }

  async clear(): Promise<void> {
    this.orgs = [];
    this.memberships = [];
    this.departments = [];
    this.teams = [];
    this.invitations = [];
    this.channels = [];
    this.profiles = [];
    this.discover = [];
  }
}
