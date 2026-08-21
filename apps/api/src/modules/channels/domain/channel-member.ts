export type ChannelMemberRole = 'manager' | 'member';

export interface ChannelMember {
  channelId: string;
  orgId: string;
  userId: string;
  role: ChannelMemberRole;
  isMuted: boolean;
  joinedAt: Date;
}
