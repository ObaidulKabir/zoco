import type { Channel } from '../../domain/channel';
import type { Department } from '../../domain/department';
import type { DiscoverProfile } from '../../domain/discover-profile';
import type { Invitation } from '../../domain/invitation';
import type { MemberProfile } from '../../domain/member-profile';
import type { Membership } from '../../domain/membership';
import type { Organization } from '../../domain/organization';
import type { Team } from '../../domain/team';

export interface OrgDirectoryPort {
  saveOrg(org: Organization): Promise<void>;
  findOrgById(id: string): Promise<Organization | null>;
  findOrgBySlug(slug: string): Promise<Organization | null>;
  listOrgSlugs(): Promise<string[]>;
  listOrgsForUser(userId: string): Promise<Organization[]>;

  saveMembership(membership: Membership): Promise<void>;
  findMembership(orgId: string, userId: string): Promise<Membership | null>;
  listMemberships(orgId: string): Promise<Membership[]>;
  deleteMembership(orgId: string, userId: string): Promise<void>;
  countMemberships(orgId: string): Promise<number>;
  countOrgsForUser(userId: string): Promise<number>;

  saveDepartment(dept: Department): Promise<void>;
  findDepartment(orgId: string, deptId: string): Promise<Department | null>;
  findDepartmentByName(orgId: string, name: string): Promise<Department | null>;
  listDepartments(orgId: string): Promise<Department[]>;
  deleteDepartment(orgId: string, deptId: string): Promise<void>;

  saveTeam(team: Team): Promise<void>;
  findTeam(orgId: string, teamId: string): Promise<Team | null>;
  listTeams(orgId: string): Promise<Team[]>;
  deleteTeam(orgId: string, teamId: string): Promise<void>;

  saveInvitation(invite: Invitation): Promise<void>;
  findInvitationByEmail(orgId: string, email: string): Promise<Invitation | null>;
  findInvitationByTokenHash(tokenHash: string): Promise<Invitation | null>;
  listInvitations(orgId: string): Promise<Invitation[]>;
  countPendingInvites(orgId: string, now: Date): Promise<number>;

  saveChannel(channel: Channel): Promise<void>;
  findChannelBySlug(orgId: string, slug: string): Promise<Channel | null>;
  listChannels(orgId: string): Promise<Channel[]>;

  saveProfile(profile: MemberProfile): Promise<void>;
  findProfile(orgId: string, userId: string): Promise<MemberProfile | null>;

  saveDiscover(profile: DiscoverProfile): Promise<void>;
  findDiscover(orgId: string): Promise<DiscoverProfile | null>;

  clear(): Promise<void>;
}
