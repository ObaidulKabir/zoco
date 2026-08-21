import type { ChannelStorePort } from '../../application/ports/channel-store.port';
import type { Channel } from '../../domain/channel';
import type { ChannelMember } from '../../domain/channel-member';
import type { ChannelMessage } from '../../domain/channel-message';

export class InMemoryChannelStore implements ChannelStorePort {
  private channels = new Map<string, Channel>(); // channelId -> Channel
  private members = new Map<string, ChannelMember[]>(); // channelId -> ChannelMember[]
  private messages = new Map<string, ChannelMessage[]>(); // channelId -> ChannelMessage[]
  private sharedOrgs = new Map<string, string[]>(); // channelId -> orgId[]
  private mentions: Array<{ messageId: string; channelId: string; orgId: string; userIds: string[]; type: string }> = [];

  async saveChannel(channel: Channel): Promise<void> {
    this.channels.set(channel.id, { ...channel });
  }

  async findChannelById(orgId: string, channelId: string): Promise<Channel | null> {
    const ch = this.channels.get(channelId);
    if (!ch) return null;
    if (ch.orgId === orgId || ch.sharedOrgIds?.includes(orgId)) {
      return { ...ch };
    }
    return null;
  }

  async findChannelBySlug(orgId: string, slug: string): Promise<Channel | null> {
    for (const ch of this.channels.values()) {
      if (ch.slug === slug && (ch.orgId === orgId || ch.sharedOrgIds?.includes(orgId))) {
        return { ...ch };
      }
    }
    return null;
  }

  async listChannels(orgId: string, userId?: string): Promise<Channel[]> {
    const list: Channel[] = [];
    for (const ch of this.channels.values()) {
      if (ch.orgId === orgId || ch.sharedOrgIds?.includes(orgId)) {
        if (ch.type === 'private' && userId) {
          const isMember = (this.members.get(ch.id) || []).some((m) => m.userId === userId);
          if (!isMember) continue;
        }
        list.push({ ...ch });
      }
    }
    return list;
  }

  async updateChannel(channel: Channel): Promise<void> {
    this.channels.set(channel.id, { ...channel });
  }

  async addMember(member: ChannelMember): Promise<void> {
    const list = this.members.get(member.channelId) || [];
    const idx = list.findIndex((m) => m.userId === member.userId);
    if (idx >= 0) {
      list[idx] = { ...member };
    } else {
      list.push({ ...member });
    }
    this.members.set(member.channelId, list);
  }

  async findMember(channelId: string, userId: string): Promise<ChannelMember | null> {
    const list = this.members.get(channelId) || [];
    const m = list.find((x) => x.userId === userId);
    return m ? { ...m } : null;
  }

  async listMembers(channelId: string): Promise<ChannelMember[]> {
    return [...(this.members.get(channelId) || [])];
  }

  async removeMember(channelId: string, userId: string): Promise<void> {
    const list = (this.members.get(channelId) || []).filter((m) => m.userId !== userId);
    this.members.set(channelId, list);
  }

  async saveMessage(message: ChannelMessage): Promise<void> {
    const list = this.messages.get(message.channelId) || [];
    list.push({ ...message });
    this.messages.set(message.channelId, list);
  }

  async findMessageById(orgId: string, messageId: string): Promise<ChannelMessage | null> {
    for (const list of this.messages.values()) {
      const msg = list.find((m) => m.id === messageId);
      if (msg) return { ...msg };
    }
    return null;
  }

  async listMessages(channelId: string, limit = 50, before?: Date): Promise<ChannelMessage[]> {
    let list = [...(this.messages.get(channelId) || [])];
    if (before) {
      list = list.filter((m) => m.createdAt < before);
    }
    // Sort chronological
    list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    // Only return top-level channel messages or broadcasts in main feed
    list = list.filter((m) => !m.threadId || m.isBroadcast);
    return list.slice(-limit);
  }

  async listThreadMessages(threadId: string): Promise<ChannelMessage[]> {
    const results: ChannelMessage[] = [];
    for (const list of this.messages.values()) {
      for (const m of list) {
        if (m.id === threadId || m.threadId === threadId) {
          results.push({ ...m });
        }
      }
    }
    results.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return results;
  }

  async updateMessage(message: ChannelMessage): Promise<void> {
    const list = this.messages.get(message.channelId) || [];
    const idx = list.findIndex((m) => m.id === message.id);
    if (idx >= 0) {
      list[idx] = { ...message };
    }
  }

  async recordMentions(messageId: string, channelId: string, orgId: string, userIds: string[], type: string): Promise<void> {
    this.mentions.push({ messageId, channelId, orgId, userIds, type });
  }

  async addSharedOrg(channelId: string, orgId: string, status?: string): Promise<void> {
    const orgs = this.sharedOrgs.get(channelId) || [];
    if (!orgs.includes(orgId)) {
      orgs.push(orgId);
    }
    this.sharedOrgs.set(channelId, orgs);
  }

  async listSharedOrgs(channelId: string): Promise<string[]> {
    return [...(this.sharedOrgs.get(channelId) || [])];
  }

  async clear(): Promise<void> {
    this.channels.clear();
    this.members.clear();
    this.messages.clear();
    this.sharedOrgs.clear();
    this.mentions = [];
  }
}
