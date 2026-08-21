export const ORG_SIZES = ['1-10', '11-50', '51-200', '201-1000', '1000+'] as const;
export type OrgSize = (typeof ORG_SIZES)[number];

export const ORG_ROLES = ['owner', 'admin', 'manager', 'member'] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const INVITE_ROLES = ['admin', 'manager', 'member'] as const;
export type InviteRole = (typeof INVITE_ROLES)[number];

export const INVITE_POLICIES = ['anyone', 'admins_only', 'owner_only'] as const;
export type InvitePolicy = (typeof INVITE_POLICIES)[number];

export const CHANNEL_POLICIES = ['anyone', 'managers', 'admins_only'] as const;
export type ChannelPolicy = (typeof CHANNEL_POLICIES)[number];

export const PRESENCE = ['online', 'away', 'dnd', 'offline'] as const;
export type Presence = (typeof PRESENCE)[number];

export const FREE_MEMBER_CAP = 25;
export const FREE_ORG_CAP = 10;
export const MAX_DEPT_LEVEL = 5;
export const MAX_INVITE_BATCH = 100;
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export const roleAtLeast = (role: OrgRole, minimum: OrgRole): boolean => {
  const rank: Record<OrgRole, number> = { member: 1, manager: 2, admin: 3, owner: 4 };
  return rank[role] >= rank[minimum];
};

export const canInvite = (role: OrgRole, policy: InvitePolicy): boolean => {
  if (policy === 'anyone') return true;
  if (policy === 'admins_only') return roleAtLeast(role, 'admin');
  return role === 'owner';
};

export const canManageOrg = (role: OrgRole): boolean => roleAtLeast(role, 'admin');
