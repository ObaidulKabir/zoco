import type { Channel } from '../../domain/channel';
import type { ChannelMember } from '../../domain/channel-member';
import type { ChannelMessage } from '../../domain/channel-message';

export interface ChannelStorePort {
  saveChannel(channel: Channel): Promise<void>;
  findChannelById(orgId: string, channelId: string): Promise<Channel | null>;
  findChannelBySlug(orgId: string, slug: string): Promise<Channel | null>;
  listChannels(orgId: string, userId?: string): Promise<Channel[]>;
  updateChannel(channel: Channel): Promise<void>;

  addMember(member: ChannelMember): Promise<void>;
  findMember(channelId: string, userId: string): Promise<ChannelMember | null>;
  listMembers(channelId: string): Promise<ChannelMember[]>;
  removeMember(channelId: string, userId: string): Promise<void>;

  saveMessage(message: ChannelMessage): Promise<void>;
  findMessageById(orgId: string, messageId: string): Promise<ChannelMessage | null>;
  listMessages(channelId: string, limit?: number, before?: Date): Promise<ChannelMessage[]>;
  listThreadMessages(threadId: string): Promise<ChannelMessage[]>;
  updateMessage(message: ChannelMessage): Promise<void>;

  recordMentions(messageId: string, channelId: string, orgId: string, userIds: string[], type: string): Promise<void>;

  addSharedOrg(channelId: string, orgId: string, status?: string): Promise<void>;
  listSharedOrgs(channelId: string): Promise<string[]>;

  clear(): Promise<void>;
}
