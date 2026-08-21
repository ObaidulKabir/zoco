import { ChannelError } from '../domain/channel-error';
import type { ChannelMessage } from '../domain/channel-message';
import type { ChannelStorePort } from './ports/channel-store.port';

export interface GetChannelMessagesQuery {
  orgId: string;
  channelIdOrSlug: string;
  userId: string;
  limit?: number;
  before?: Date;
}

export class GetChannelMessagesUseCase {
  constructor(private readonly store: ChannelStorePort) {}

  async execute(query: GetChannelMessagesQuery): Promise<ChannelMessage[]> {
    let channel = await this.store.findChannelById(query.orgId, query.channelIdOrSlug);
    if (!channel) {
      channel = await this.store.findChannelBySlug(query.orgId, query.channelIdOrSlug);
    }
    if (!channel) {
      throw new ChannelError('CHANNEL_NOT_FOUND', 'Channel not found');
    }

    if (channel.type === 'private') {
      const member = await this.store.findMember(channel.id, query.userId);
      if (!member) {
        throw new ChannelError('CHANNEL_ACCESS_DENIED', 'Cannot access private channel messages without an invitation');
      }
    }

    return this.store.listMessages(channel.id, query.limit || 50, query.before);
  }
}

export class GetThreadMessagesUseCase {
  constructor(private readonly store: ChannelStorePort) {}

  async execute(orgId: string, threadRootMessageId: string): Promise<ChannelMessage[]> {
    const root = await this.store.findMessageById(orgId, threadRootMessageId);
    if (!root) {
      throw new ChannelError('MESSAGE_NOT_FOUND', `Thread root message ${threadRootMessageId} not found`);
    }

    return this.store.listThreadMessages(threadRootMessageId);
  }
}
