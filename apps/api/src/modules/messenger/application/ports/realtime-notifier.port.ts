import type { DirectMessage, MessageReaction, MessageReceipt } from '../../domain/message';

export interface RealtimeNotifierPort {
  notifyNewMessage(conversationId: string, message: DirectMessage, recipientUserIds: string[]): Promise<void>;
  notifyMessageEdited(conversationId: string, message: DirectMessage, recipientUserIds: string[]): Promise<void>;
  notifyMessageDeleted(conversationId: string, messageId: string, recipientUserIds: string[]): Promise<void>;
  notifyReactionUpdated(conversationId: string, messageId: string, reaction: MessageReaction, action: 'added' | 'removed', recipientUserIds: string[]): Promise<void>;
  notifyReceiptUpdated(conversationId: string, receipt: MessageReceipt, recipientUserIds: string[]): Promise<void>;
  notifyTyping(conversationId: string, userId: string, isTyping: boolean, recipientUserIds: string[]): Promise<void>;
  notifyPresence(orgId: string, userId: string, status: 'online' | 'away' | 'dnd' | 'offline'): Promise<void>;
}
