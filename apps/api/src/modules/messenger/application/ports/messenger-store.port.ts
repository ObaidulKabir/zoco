import type { Conversation, ConversationSummary } from '../../domain/conversation';
import type { DirectMessage, MessageReaction, MessageReceipt } from '../../domain/message';
import type { PrekeyBundle } from '../../domain/prekey-bundle';

export interface MessengerStorePort {
  createConversation(conv: Conversation): Promise<void>;
  findConversationById(orgId: string, id: string): Promise<Conversation | null>;
  findDirectConversation(orgId: string, userA: string, userB: string): Promise<Conversation | null>;
  listConversationsForUser(orgId: string, userId: string): Promise<ConversationSummary[]>;
  saveMessage(msg: DirectMessage): Promise<void>;
  findMessageById(orgId: string, id: string): Promise<DirectMessage | null>;
  updateMessage(msg: DirectMessage): Promise<void>;
  listMessages(
    orgId: string,
    conversationId: string,
    options?: { limit?: number; before?: Date },
  ): Promise<DirectMessage[]>;
  addReaction(reaction: MessageReaction): Promise<void>;
  removeReaction(orgId: string, messageId: string, userId: string, emoji: string): Promise<void>;
  listReactionsForMessages(orgId: string, messageIds: string[]): Promise<MessageReaction[]>;
  saveReceipt(receipt: MessageReceipt): Promise<void>;
  listReceiptsForMessages(orgId: string, messageIds: string[]): Promise<MessageReceipt[]>;
  updateParticipantLastRead(conversationId: string, userId: string, readAt: Date): Promise<void>;
  savePrekeyBundle(bundle: PrekeyBundle): Promise<void>;
  findPrekeyBundle(userId: string): Promise<PrekeyBundle | null>;
  consumeOneTimePrekey(userId: string): Promise<{
    identityKey: string;
    signedPrekey: string;
    signedPrekeySignature: string;
    oneTimePrekey?: { keyId: number; publicKey: string };
  } | null>;
}
