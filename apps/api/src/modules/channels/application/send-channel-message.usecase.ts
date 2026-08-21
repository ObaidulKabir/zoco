import { randomUUID } from 'node:crypto';
import type { ClockPort } from '@zoqo/shared';
import { ChannelError } from '../domain/channel-error';
import type { ChannelMessage } from '../domain/channel-message';
import { parseMentions } from '../domain/mention';
import type { ChannelStorePort } from './ports/channel-store.port';
import type { RealtimeNotifierPort } from '../../messenger/application/ports/realtime-notifier.port';

export interface SendChannelMessageCommand {
  orgId: string;
  channelIdOrSlug: string;
  senderId: string;
  senderOrgRole?: string; // 'owner', 'admin', 'manager', 'member'
  content: string;
  contentCiphertext?: string;
  envelopeIv?: string;
  envelopeTag?: string;
  contentType?: 'text' | 'system' | 'file' | 'call_event';
  threadId?: string;
  replyToId?: string;
  broadcastToChannel?: boolean;
}

export class SendChannelMessageUseCase {
  constructor(
    private readonly store: ChannelStorePort,
    private readonly realtime: RealtimeNotifierPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(cmd: SendChannelMessageCommand): Promise<ChannelMessage> {
    if (!cmd.content || cmd.content.trim() === '') {
      throw new ChannelError('VALIDATION_ERROR', 'Channel message content cannot be empty');
    }

    let channel = await this.store.findChannelById(cmd.orgId, cmd.channelIdOrSlug);
    if (!channel) {
      channel = await this.store.findChannelBySlug(cmd.orgId, cmd.channelIdOrSlug);
    }
    if (!channel) {
      throw new ChannelError('CHANNEL_NOT_FOUND', 'Channel not found');
    }

    if (channel.isArchived) {
      throw new ChannelError('CHANNEL_ARCHIVED', 'Cannot send message to an archived channel');
    }

    // Check membership
    const member = await this.store.findMember(channel.id, cmd.senderId);
    if (!member && channel.type === 'private') {
      throw new ChannelError('CHANNEL_ACCESS_DENIED', 'Cannot post to private channel without membership');
    }

    // Check announcement posting permission (only manager, admin, owner)
    if (channel.type === 'announcement') {
      const isPrivileged =
        member?.role === 'manager' ||
        cmd.senderOrgRole === 'owner' ||
        cmd.senderOrgRole === 'admin' ||
        cmd.senderOrgRole === 'manager';
      if (!isPrivileged) {
        throw new ChannelError(
          'ANNOUNCEMENT_POST_RESTRICTED',
          'Only managers and administrators can post in announcement channels',
        );
      }
    }

    const now = this.clock.now();

    // If this is a thread reply, update root message reply statistics
    if (cmd.threadId) {
      const rootMsg = await this.store.findMessageById(cmd.orgId, cmd.threadId);
      if (!rootMsg) {
        throw new ChannelError('MESSAGE_NOT_FOUND', `Thread root message ${cmd.threadId} not found`);
      }
      rootMsg.replyCount = (rootMsg.replyCount || 0) + 1;
      rootMsg.lastReplyAt = now;
      await this.store.updateMessage(rootMsg);
    }

    const mentions = parseMentions(cmd.content);
    const mentionedUsernames = mentions.filter((m) => m.type === 'user').map((m) => m.target!);

    const message: ChannelMessage = {
      id: randomUUID(),
      channelId: channel.id,
      orgId: cmd.orgId,
      senderId: cmd.senderId,
      content: cmd.content,
      contentCiphertext: cmd.contentCiphertext || '',
      envelopeIv: cmd.envelopeIv || '',
      envelopeTag: cmd.envelopeTag || '',
      contentType: cmd.contentType || 'text',
      threadId: cmd.threadId,
      replyToId: cmd.replyToId,
      isBroadcast: !!cmd.broadcastToChannel,
      replyCount: 0,
      isEdited: false,
      isDeleted: false,
      isPinned: false,
      mentions: mentionedUsernames,
      createdAt: now,
      updatedAt: now,
    };

    await this.store.saveMessage(message);

    // Record mentions
    if (mentionedUsernames.length > 0) {
      await this.store.recordMentions(message.id, channel.id, cmd.orgId, mentionedUsernames, 'user');
    }

    // Realtime notification fanout to channel members
    const allMembers = await this.store.listMembers(channel.id);
    const recipientIds = allMembers.map((m) => m.userId).filter((id) => id !== cmd.senderId);

    await this.realtime.notifyChannelMessage?.(channel.id, message, recipientIds);

    // Mention notifications
    for (const mention of mentions) {
      if (mention.type === 'channel' || mention.type === 'here') {
        await this.realtime.notifyChannelMention?.(cmd.orgId, channel.id, message.id, mention.type, recipientIds);
      }
    }

    return message;
  }
}
