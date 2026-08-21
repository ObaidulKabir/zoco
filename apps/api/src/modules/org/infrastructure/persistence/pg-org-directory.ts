import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { query, withTenant } from '../../../../db/pool';
import { Channel } from '../../domain/channel';
import { Department } from '../../domain/department';
import { DiscoverProfile } from '../../domain/discover-profile';
import { Invitation, type InvitationStatus } from '../../domain/invitation';
import { MemberProfile } from '../../domain/member-profile';
import { Membership } from '../../domain/membership';
import { Organization, type OrgSettings } from '../../domain/organization';
import { Team } from '../../domain/team';
import type { InviteRole, OrgRole, OrgSize, Presence } from '../../domain/policy';
import type { OrgDirectoryPort } from '../../application/ports/org-directory.port';

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  industry: string;
  size_range: OrgSize;
  country: string;
  timezone: string;
  logo_url: string | null;
  settings: OrgSettings;
  created_at: Date;
};

type MemberRow = {
  id: string;
  org_id: string;
  user_id: string;
  email: string;
  role: OrgRole;
  department_id: string | null;
  team_id: string | null;
  joined_at: Date;
};

type DeptRow = {
  id: string;
  org_id: string;
  name: string;
  description: string;
  parent_id: string | null;
  level: number;
};

type TeamRow = {
  id: string;
  org_id: string;
  department_id: string;
  name: string;
  description: string;
};

type InviteRow = {
  id: string;
  org_id: string;
  email: string;
  role: InviteRole;
  department_id: string | null;
  token_hash: string;
  expires_at: Date;
  status: InvitationStatus;
};

type ChannelRow = { id: string; org_id: string; name: string; slug: string; member_ids: string[] | null };

type ProfileRow = {
  org_id: string;
  user_id: string;
  display_name: string;
  title: string;
  phone: string;
  avatar_url: string | null;
  timezone: string;
  language: string;
  bio: string;
  presence: Presence;
};

type DiscoverRow = {
  org_id: string;
  display_name: string;
  industry: string;
  country: string;
  published: boolean;
};

const ORG_COLUMNS = 'id, name, slug, industry, size_range, country, timezone, logo_url, settings, created_at';
const MEMBER_COLUMNS = 'id, org_id, user_id, email, role, department_id, team_id, joined_at';
const DEPT_COLUMNS = 'id, org_id, name, description, parent_id, level';
const TEAM_COLUMNS = 'id, org_id, department_id, name, description';
const INVITE_COLUMNS = 'id, org_id, email, role, department_id, token_hash, expires_at, status';
const PROFILE_COLUMNS =
  'org_id, user_id, display_name, title, phone, avatar_url, timezone, language, bio, presence';
const DISCOVER_COLUMNS = 'org_id, display_name, industry, country, published';
const CHANNEL_SELECT = `select c.id, c.org_id, c.name, c.slug,
    coalesce(array_agg(cm.user_id) filter (where cm.user_id is not null), '{}') as member_ids
  from channels c left join channel_members cm on cm.channel_id = c.id`;

const toOrg = (r: OrgRow): Organization =>
  new Organization(
    r.id,
    r.name,
    r.slug,
    r.industry,
    r.size_range,
    r.country,
    r.timezone,
    r.logo_url,
    r.settings,
    r.created_at,
  );

const toMembership = (r: MemberRow): Membership =>
  new Membership(r.id, r.org_id, r.user_id, r.email, r.role, r.department_id, r.team_id, r.joined_at);

const toDepartment = (r: DeptRow): Department =>
  new Department(r.id, r.org_id, r.name, r.description, r.parent_id, r.level);

const toTeam = (r: TeamRow): Team => new Team(r.id, r.org_id, r.department_id, r.name, r.description);

const toInvitation = (r: InviteRow): Invitation =>
  new Invitation(r.id, r.org_id, r.email, r.role, r.department_id, r.token_hash, r.expires_at, r.status);

const toChannel = (r: ChannelRow): Channel =>
  new Channel(r.id, r.org_id, r.name, r.slug, r.member_ids ?? []);

const toProfile = (r: ProfileRow): MemberProfile =>
  new MemberProfile(
    r.user_id,
    r.org_id,
    r.display_name,
    r.title,
    r.phone,
    r.avatar_url,
    r.timezone,
    r.language,
    r.bio,
    r.presence,
  );

const toDiscover = (r: DiscoverRow): DiscoverProfile =>
  new DiscoverProfile(r.org_id, r.display_name, r.industry, r.country, r.published);

/**
 * Org-scoped statements run inside `withTenant`, so the RLS policies in
 * 002_org.sql are a second lock on every read and write: even a query that
 * forgot its org_id predicate cannot reach another tenant's rows. The handful of
 * methods that are cross-org by definition -- slug uniqueness, "orgs for this
 * user", invitation lookup by token -- use the pool directly and rely on their
 * own predicates.
 */
@Injectable()
export class PgOrgDirectory implements OrgDirectoryPort {
  private scoped<T>(orgId: string, fn: (client: PoolClient) => Promise<T>): Promise<T> {
    return withTenant(orgId, fn);
  }

  async saveOrg(org: Organization): Promise<void> {
    await query(
      `insert into organizations (${ORG_COLUMNS}, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now())
       on conflict (id) do update set
         name = excluded.name,
         industry = excluded.industry,
         country = excluded.country,
         timezone = excluded.timezone,
         logo_url = excluded.logo_url,
         settings = excluded.settings,
         updated_at = now()`,
      [
        org.id,
        org.name,
        org.slug,
        org.industry,
        org.size,
        org.country,
        org.timezone,
        org.logoUrl,
        JSON.stringify(org.settings),
        org.createdAt,
      ],
    );
  }

  async findOrgById(id: string): Promise<Organization | null> {
    const rows = await query<OrgRow>(`select ${ORG_COLUMNS} from organizations where id = $1`, [id]);
    return rows[0] ? toOrg(rows[0]) : null;
  }

  async findOrgBySlug(slug: string): Promise<Organization | null> {
    const rows = await query<OrgRow>(`select ${ORG_COLUMNS} from organizations where slug = $1`, [slug]);
    return rows[0] ? toOrg(rows[0]) : null;
  }

  async listOrgSlugs(): Promise<string[]> {
    const rows = await query<{ slug: string }>('select slug from organizations');
    return rows.map((r) => r.slug);
  }

  async listOrgsForUser(userId: string): Promise<Organization[]> {
    const rows = await query<OrgRow>(
      `select ${ORG_COLUMNS.split(', ')
        .map((c) => `o.${c}`)
        .join(', ')}
       from organizations o
       join org_members m on m.org_id = o.id
       where m.user_id = $1
       order by o.created_at`,
      [userId],
    );
    return rows.map(toOrg);
  }

  async saveMembership(membership: Membership): Promise<void> {
    await this.scoped(membership.orgId, (client) =>
      client.query(
        `insert into org_members (${MEMBER_COLUMNS}) values ($1,$2,$3,$4,$5,$6,$7,$8)
         on conflict (org_id, user_id) do update set
           role = excluded.role,
           department_id = excluded.department_id,
           team_id = excluded.team_id,
           updated_at = now()`,
        [
          membership.id,
          membership.orgId,
          membership.userId,
          membership.email,
          membership.role,
          membership.departmentId,
          membership.teamId,
          membership.createdAt,
        ],
      ),
    );
  }

  async findMembership(orgId: string, userId: string): Promise<Membership | null> {
    return this.scoped(orgId, async (client) => {
      const { rows } = await client.query<MemberRow>(
        `select ${MEMBER_COLUMNS} from org_members where org_id = $1 and user_id = $2`,
        [orgId, userId],
      );
      return rows[0] ? toMembership(rows[0]) : null;
    });
  }

  async listMemberships(orgId: string): Promise<Membership[]> {
    return this.scoped(orgId, async (client) => {
      const { rows } = await client.query<MemberRow>(
        `select ${MEMBER_COLUMNS} from org_members where org_id = $1 order by joined_at`,
        [orgId],
      );
      return rows.map(toMembership);
    });
  }

  async deleteMembership(orgId: string, userId: string): Promise<void> {
    await this.scoped(orgId, (client) =>
      client.query('delete from org_members where org_id = $1 and user_id = $2', [orgId, userId]),
    );
  }

  async countMemberships(orgId: string): Promise<number> {
    return this.scoped(orgId, async (client) => {
      const { rows } = await client.query<{ count: string }>(
        'select count(*)::text as count from org_members where org_id = $1',
        [orgId],
      );
      return Number(rows[0]?.count ?? 0);
    });
  }

  async countOrgsForUser(userId: string): Promise<number> {
    const rows = await query<{ count: string }>(
      'select count(*)::text as count from org_members where user_id = $1',
      [userId],
    );
    return Number(rows[0]?.count ?? 0);
  }

  async saveDepartment(dept: Department): Promise<void> {
    await this.scoped(dept.orgId, (client) =>
      client.query(
        `insert into departments (${DEPT_COLUMNS}) values ($1,$2,$3,$4,$5,$6)
         on conflict (id) do update set
           name = excluded.name,
           description = excluded.description,
           parent_id = excluded.parent_id,
           level = excluded.level`,
        [dept.id, dept.orgId, dept.name, dept.description, dept.parentId, dept.level],
      ),
    );
  }

  async findDepartment(orgId: string, deptId: string): Promise<Department | null> {
    return this.scoped(orgId, async (client) => {
      const { rows } = await client.query<DeptRow>(
        `select ${DEPT_COLUMNS} from departments where org_id = $1 and id = $2`,
        [orgId, deptId],
      );
      return rows[0] ? toDepartment(rows[0]) : null;
    });
  }

  async findDepartmentByName(orgId: string, name: string): Promise<Department | null> {
    return this.scoped(orgId, async (client) => {
      const { rows } = await client.query<DeptRow>(
        `select ${DEPT_COLUMNS} from departments where org_id = $1 and lower(name) = lower($2)`,
        [orgId, name],
      );
      return rows[0] ? toDepartment(rows[0]) : null;
    });
  }

  async listDepartments(orgId: string): Promise<Department[]> {
    return this.scoped(orgId, async (client) => {
      const { rows } = await client.query<DeptRow>(
        `select ${DEPT_COLUMNS} from departments where org_id = $1 order by sort_order, name`,
        [orgId],
      );
      return rows.map(toDepartment);
    });
  }

  async deleteDepartment(orgId: string, deptId: string): Promise<void> {
    await this.scoped(orgId, (client) =>
      client.query('delete from departments where org_id = $1 and id = $2', [orgId, deptId]),
    );
  }

  async saveTeam(team: Team): Promise<void> {
    await this.scoped(team.orgId, (client) =>
      client.query(
        `insert into teams (${TEAM_COLUMNS}) values ($1,$2,$3,$4,$5)
         on conflict (id) do update set
           department_id = excluded.department_id,
           name = excluded.name,
           description = excluded.description`,
        [team.id, team.orgId, team.departmentId, team.name, team.description],
      ),
    );
  }

  async findTeam(orgId: string, teamId: string): Promise<Team | null> {
    return this.scoped(orgId, async (client) => {
      const { rows } = await client.query<TeamRow>(
        `select ${TEAM_COLUMNS} from teams where org_id = $1 and id = $2`,
        [orgId, teamId],
      );
      return rows[0] ? toTeam(rows[0]) : null;
    });
  }

  async listTeams(orgId: string): Promise<Team[]> {
    return this.scoped(orgId, async (client) => {
      const { rows } = await client.query<TeamRow>(
        `select ${TEAM_COLUMNS} from teams where org_id = $1 order by name`,
        [orgId],
      );
      return rows.map(toTeam);
    });
  }

  async deleteTeam(orgId: string, teamId: string): Promise<void> {
    await this.scoped(orgId, (client) =>
      client.query('delete from teams where org_id = $1 and id = $2', [orgId, teamId]),
    );
  }

  async saveInvitation(invite: Invitation): Promise<void> {
    await this.scoped(invite.orgId, (client) =>
      client.query(
        `insert into invitations (${INVITE_COLUMNS}) values ($1,$2,$3,$4,$5,$6,$7,$8)
         on conflict (id) do update set
           role = excluded.role,
           department_id = excluded.department_id,
           token_hash = excluded.token_hash,
           expires_at = excluded.expires_at,
           status = excluded.status`,
        [
          invite.id,
          invite.orgId,
          invite.email,
          invite.role,
          invite.departmentId,
          invite.tokenHash,
          invite.expiresAt,
          invite.status,
        ],
      ),
    );
  }

  async findInvitationByEmail(orgId: string, email: string): Promise<Invitation | null> {
    return this.scoped(orgId, async (client) => {
      const { rows } = await client.query<InviteRow>(
        `select ${INVITE_COLUMNS} from invitations where org_id = $1 and email = $2
         order by expires_at desc limit 1`,
        [orgId, email],
      );
      return rows[0] ? toInvitation(rows[0]) : null;
    });
  }

  async findInvitationByTokenHash(tokenHash: string): Promise<Invitation | null> {
    const rows = await query<InviteRow>(
      `select ${INVITE_COLUMNS} from invitations where token_hash = $1`,
      [tokenHash],
    );
    return rows[0] ? toInvitation(rows[0]) : null;
  }

  async listInvitations(orgId: string): Promise<Invitation[]> {
    return this.scoped(orgId, async (client) => {
      const { rows } = await client.query<InviteRow>(
        `select ${INVITE_COLUMNS} from invitations where org_id = $1 order by expires_at desc`,
        [orgId],
      );
      return rows.map(toInvitation);
    });
  }

  async countPendingInvites(orgId: string, now: Date): Promise<number> {
    return this.scoped(orgId, async (client) => {
      const { rows } = await client.query<{ count: string }>(
        `select count(*)::text as count from invitations
         where org_id = $1 and status = 'pending' and expires_at > $2`,
        [orgId, now],
      );
      return Number(rows[0]?.count ?? 0);
    });
  }

  async saveChannel(channel: Channel): Promise<void> {
    await this.scoped(channel.orgId, async (client) => {
      await client.query(
        `insert into channels (id, org_id, name, slug) values ($1,$2,$3,$4)
         on conflict (id) do update set name = excluded.name`,
        [channel.id, channel.orgId, channel.name, channel.slug],
      );
      await client.query(
        'delete from channel_members where channel_id = $1 and not (user_id = any($2::uuid[]))',
        [channel.id, channel.memberIds],
      );
      if (channel.memberIds.length) {
        await client.query(
          `insert into channel_members (channel_id, user_id, org_id)
           select $1, unnest($2::uuid[]), $3
           on conflict (channel_id, user_id) do nothing`,
          [channel.id, channel.memberIds, channel.orgId],
        );
      }
    });
  }

  async findChannelBySlug(orgId: string, slug: string): Promise<Channel | null> {
    return this.scoped(orgId, async (client) => {
      const { rows } = await client.query<ChannelRow>(
        `${CHANNEL_SELECT} where c.org_id = $1 and c.slug = $2 group by c.id`,
        [orgId, slug],
      );
      return rows[0] ? toChannel(rows[0]) : null;
    });
  }

  async listChannels(orgId: string): Promise<Channel[]> {
    return this.scoped(orgId, async (client) => {
      const { rows } = await client.query<ChannelRow>(
        `${CHANNEL_SELECT} where c.org_id = $1 group by c.id order by c.slug`,
        [orgId],
      );
      return rows.map(toChannel);
    });
  }

  async saveProfile(profile: MemberProfile): Promise<void> {
    await this.scoped(profile.orgId, (client) =>
      client.query(
        `insert into member_profiles (${PROFILE_COLUMNS}) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         on conflict (org_id, user_id) do update set
           display_name = excluded.display_name,
           title = excluded.title,
           phone = excluded.phone,
           avatar_url = excluded.avatar_url,
           timezone = excluded.timezone,
           language = excluded.language,
           bio = excluded.bio,
           presence = excluded.presence,
           updated_at = now()`,
        [
          profile.orgId,
          profile.userId,
          profile.displayName,
          profile.title,
          profile.phone,
          profile.avatarUrl,
          profile.timezone,
          profile.language,
          profile.bio,
          profile.presence,
        ],
      ),
    );
  }

  async findProfile(orgId: string, userId: string): Promise<MemberProfile | null> {
    return this.scoped(orgId, async (client) => {
      const { rows } = await client.query<ProfileRow>(
        `select ${PROFILE_COLUMNS} from member_profiles where org_id = $1 and user_id = $2`,
        [orgId, userId],
      );
      return rows[0] ? toProfile(rows[0]) : null;
    });
  }

  async saveDiscover(profile: DiscoverProfile): Promise<void> {
    await this.scoped(profile.orgId, (client) =>
      client.query(
        `insert into discover_profiles (${DISCOVER_COLUMNS}) values ($1,$2,$3,$4,$5)
         on conflict (org_id) do update set
           display_name = excluded.display_name,
           industry = excluded.industry,
           country = excluded.country,
           published = excluded.published,
           updated_at = now()`,
        [profile.orgId, profile.displayName, profile.industry, profile.country, profile.published],
      ),
    );
  }

  async findDiscover(orgId: string): Promise<DiscoverProfile | null> {
    return this.scoped(orgId, async (client) => {
      const { rows } = await client.query<DiscoverRow>(
        `select ${DISCOVER_COLUMNS} from discover_profiles where org_id = $1`,
        [orgId],
      );
      return rows[0] ? toDiscover(rows[0]) : null;
    });
  }

  async clear(): Promise<void> {
    await query('truncate organizations cascade');
  }
}
