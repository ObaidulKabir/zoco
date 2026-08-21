import { randomUUID } from 'node:crypto';
import type { ClockPort } from '@zoqo/shared';
import { ChannelError } from '../domain/channel-error';
import { type Channel, type ChannelType, validateChannelCreation } from '../domain/channel';
import type { ChannelStorePort } from './ports/channel-store.port';

export interface CreateChannelCommand {
  orgId: string;
  userId: string;
  name: string;
  topic?: string;
  description?: string;
  type?: ChannelType;
}

export class CreateChannelUseCase {
  constructor(
    private readonly store: ChannelStorePort,
    private readonly clock: ClockPort,
  ) {}

  async execute(cmd: CreateChannelCommand): Promise<Channel> {
    const type: ChannelType = cmd.type || 'public';
    const slug = validateChannelCreation(cmd.name, type);

    const existing = await this.store.findChannelBySlug(cmd.orgId, slug);
    if (existing) {
      throw new ChannelError('CHANNEL_ALREADY_EXISTS', `A channel with slug '#${slug}' already exists`);
    }

    const now = this.clock.now();
    const channel: Channel = {
      id: randomUUID(),
      orgId: cmd.orgId,
      name: cmd.name.trim(),
      slug,
      topic: cmd.topic,
      description: cmd.description,
      type,
      isArchived: false,
      createdBy: cmd.userId,
      createdAt: now,
      updatedAt: now,
    };

    await this.store.saveChannel(channel);

    // Creator is automatically the channel manager/member
    await this.store.addMember({
      channelId: channel.id,
      orgId: cmd.orgId,
      userId: cmd.userId,
      role: 'manager',
      isMuted: false,
      joinedAt: now,
    });

    return channel;
  }
}
