import type { ClockPort } from '@zoqo/shared';
import { ChannelError } from '../domain/channel-error';
import type { ChannelMember } from '../domain/channel-member';
import type { ChannelStorePort } from './ports/channel-store.port';

export class InviteChannelMemberUseCase {
  constructor(
    private readonly store: ChannelStorePort,
    private readonly clock: ClockPort,
  ) {}

  async execute(orgId: string, channelIdOrSlug: string, inviterId: string, inviteeId: string): Promise<ChannelMember> {
    let channel = await this.store.findChannelById(orgId, channelIdOrSlug);
    if (!channel) {
      channel = await this.store.findChannelBySlug(orgId, channelIdOrSlug);
    }
    if (!channel) {
      throw new ChannelError('CHANNEL_NOT_FOUND', `Channel not found`);
    }

    if (channel.isArchived) {
      throw new ChannelError('CHANNEL_ARCHIVED', 'Cannot invite members to an archived channel');
    }

    const inviterMember = await this.store.findMember(channel.id, inviterId);
    if (!inviterMember && channel.type === 'private') {
      throw new ChannelError('PERMISSION_DENIED', 'Only channel members can invite others to a private channel');
    }

    const existing = await this.store.findMember(channel.id, inviteeId);
    if (existing) {
      return existing;
    }

    const member: ChannelMember = {
      channelId: channel.id,
      orgId,
      userId: inviteeId,
      role: 'member',
      isMuted: false,
      joinedAt: this.clock.now(),
    };

    await this.store.addMember(member);
    return member;
  }
}
