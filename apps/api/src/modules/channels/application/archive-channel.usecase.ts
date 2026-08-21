import type { ClockPort } from '@zoqo/shared';
import { ChannelError } from '../domain/channel-error';
import type { Channel } from '../domain/channel';
import type { ChannelStorePort } from './ports/channel-store.port';

export class ArchiveChannelUseCase {
  constructor(
    private readonly store: ChannelStorePort,
    private readonly clock: ClockPort,
  ) {}

  async execute(orgId: string, channelSlug: string, userRole?: string): Promise<Channel> {
    if (channelSlug === 'general') {
      throw new ChannelError('PERMISSION_DENIED', 'Cannot archive the #general channel');
    }

    const channel = await this.store.findChannelBySlug(orgId, channelSlug);
    if (!channel) {
      throw new ChannelError('CHANNEL_NOT_FOUND', `Channel #${channelSlug} not found`);
    }

    channel.isArchived = true;
    channel.updatedAt = this.clock.now();
    await this.store.updateChannel(channel);
    return channel;
  }
}

export class CreateSharedChannelUseCase {
  constructor(
    private readonly store: ChannelStorePort,
    private readonly clock: ClockPort,
  ) {}

  async execute(cmd: {
    orgId: string;
    userId: string;
    name: string;
    targetOrgId: string;
    topic?: string;
  }): Promise<Channel> {
    const channel: Channel = {
      id: (await import('node:crypto')).randomUUID(),
      orgId: cmd.orgId,
      name: cmd.name,
      slug: cmd.name.toLowerCase().replace(/[^a-z0-9-_]/g, '-'),
      topic: cmd.topic,
      type: 'shared',
      isArchived: false,
      createdBy: cmd.userId,
      sharedOrgIds: [cmd.orgId, cmd.targetOrgId],
      createdAt: this.clock.now(),
      updatedAt: this.clock.now(),
    };

    await this.store.saveChannel(channel);
    await this.store.addSharedOrg(channel.id, cmd.targetOrgId, 'pending');
    await this.store.addMember({
      channelId: channel.id,
      orgId: cmd.orgId,
      userId: cmd.userId,
      role: 'manager',
      isMuted: false,
      joinedAt: this.clock.now(),
    });

    return channel;
  }
}

export class AcceptSharedChannelUseCase {
  constructor(
    private readonly store: ChannelStorePort,
    private readonly clock: ClockPort,
  ) {}

  async execute(channelId: string, acceptingOrgId: string, acceptingUserId: string): Promise<void> {
    await this.store.addSharedOrg(channelId, acceptingOrgId, 'accepted');
    await this.store.addMember({
      channelId,
      orgId: acceptingOrgId,
      userId: acceptingUserId,
      role: 'member',
      isMuted: false,
      joinedAt: this.clock.now(),
    });
  }
}
