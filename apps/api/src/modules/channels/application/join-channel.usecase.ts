import type { ClockPort } from '@zoqo/shared';
import { ChannelError } from '../domain/channel-error';
import type { ChannelMember } from '../domain/channel-member';
import type { ChannelStorePort } from './ports/channel-store.port';

export class JoinChannelUseCase {
  constructor(
    private readonly store: ChannelStorePort,
    private readonly clock: ClockPort,
  ) {}

  async execute(orgId: string, channelSlug: string, userId: string): Promise<ChannelMember> {
    const channel = await this.store.findChannelBySlug(orgId, channelSlug);
    if (!channel) {
      throw new ChannelError('CHANNEL_NOT_FOUND', `Channel #${channelSlug} not found`);
    }

    if (channel.isArchived) {
      throw new ChannelError('CHANNEL_ARCHIVED', 'Cannot join an archived channel');
    }

    if (channel.type === 'private') {
      throw new ChannelError('CHANNEL_ACCESS_DENIED', 'Cannot join private channel without an invitation');
    }

    const existingMember = await this.store.findMember(channel.id, userId);
    if (existingMember) {
      return existingMember;
    }

    const member: ChannelMember = {
      channelId: channel.id,
      orgId,
      userId,
      role: 'member',
      isMuted: false,
      joinedAt: this.clock.now(),
    };

    await this.store.addMember(member);
    return member;
  }
}

export class LeaveChannelUseCase {
  constructor(private readonly store: ChannelStorePort) {}

  async execute(orgId: string, channelSlug: string, userId: string): Promise<void> {
    const channel = await this.store.findChannelBySlug(orgId, channelSlug);
    if (!channel) {
      throw new ChannelError('CHANNEL_NOT_FOUND', `Channel #${channelSlug} not found`);
    }

    if (channel.slug === 'general') {
      throw new ChannelError('PERMISSION_DENIED', 'Cannot leave the #general channel');
    }

    await this.store.removeMember(channel.id, userId);
  }
}
