import type { DirectMessage, MessageReaction, MessageReceipt } from '../../domain/message';
import type { RealtimeNotifierPort } from '../../application/ports/realtime-notifier.port';

export interface EmittedRealtimeEvent {
  event: string;
  conversationId?: string;
  orgId?: string;
  userId?: string;
  recipientUserIds?: string[];
  payload: any;
  timestamp: Date;
}

export class InMemoryRealtimeNotifier implements RealtimeNotifierPort {
  public emittedEvents: EmittedRealtimeEvent[] = [];

  async notifyNewMessage(conversationId: string, message: DirectMessage, recipientUserIds: string[]): Promise<void> {
    this.emittedEvents.push({
      event: 'message:new',
      conversationId,
      recipientUserIds,
      payload: message,
      timestamp: new Date(),
    });
  }

  async notifyMessageEdited(conversationId: string, message: DirectMessage, recipientUserIds: string[]): Promise<void> {
    this.emittedEvents.push({
      event: 'message:edit',
      conversationId,
      recipientUserIds,
      payload: message,
      timestamp: new Date(),
    });
  }

  async notifyMessageDeleted(conversationId: string, messageId: string, recipientUserIds: string[]): Promise<void> {
    this.emittedEvents.push({
      event: 'message:delete',
      conversationId,
      recipientUserIds,
      payload: { messageId },
      timestamp: new Date(),
    });
  }

  async notifyReactionUpdated(
    conversationId: string,
    messageId: string,
    reaction: MessageReaction,
    action: 'added' | 'removed',
    recipientUserIds: string[]
  ): Promise<void> {
    this.emittedEvents.push({
      event: 'message:reaction',
      conversationId,
      recipientUserIds,
      payload: { messageId, reaction, action },
      timestamp: new Date(),
    });
  }

  async notifyReceiptUpdated(conversationId: string, receipt: MessageReceipt, recipientUserIds: string[]): Promise<void> {
    this.emittedEvents.push({
      event: 'message:receipt',
      conversationId,
      recipientUserIds,
      payload: receipt,
      timestamp: new Date(),
    });
  }

  async notifyTyping(conversationId: string, userId: string, isTyping: boolean, recipientUserIds: string[]): Promise<void> {
    this.emittedEvents.push({
      event: isTyping ? 'typing:start' : 'typing:stop',
      conversationId,
      userId,
      recipientUserIds,
      payload: { conversationId, userId, isTyping },
      timestamp: new Date(),
    });
  }

  async notifyPresence(orgId: string, userId: string, status: 'online' | 'away' | 'dnd' | 'offline'): Promise<void> {
    this.emittedEvents.push({
      event: 'presence:update',
      orgId,
      userId,
      payload: { userId, status },
      timestamp: new Date(),
    });
  }

  async notifyChannelMessage(channelId: string, message: any, recipientUserIds: string[]): Promise<void> {
    this.emittedEvents.push({
      event: 'channel:message',
      conversationId: channelId,
      recipientUserIds,
      payload: message,
      timestamp: new Date(),
    });
  }

  async notifyChannelMention(orgId: string, channelId: string, messageId: string, mentionType: string, recipientUserIds: string[]): Promise<void> {
    this.emittedEvents.push({
      event: 'channel:mention',
      orgId,
      conversationId: channelId,
      recipientUserIds,
      payload: { messageId, mentionType },
      timestamp: new Date(),
    });
  }

  clear(): void {
    this.emittedEvents = [];
  }
}
