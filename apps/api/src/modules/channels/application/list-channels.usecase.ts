import type { Channel } from '../domain/channel';
import type { ChannelStorePort } from './ports/channel-store.port';

export class ListChannelsUseCase {
  constructor(private readonly store: ChannelStorePort) {}

  async execute(orgId: string, userId?: string): Promise<Channel[]> {
    return this.store.listChannels(orgId, userId);
  }
}
