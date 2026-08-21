import type { DirectMessage } from '../domain/message';
import { MessengerError } from '../domain/messenger-error';
import type { MessengerStorePort } from './ports/messenger-store.port';

export interface GetMessagesQuery {
  orgId: string;
  userId: string;
  conversationId: string;
  limit?: number;
  before?: Date;
}

export class GetMessagesUseCase {
  constructor(private readonly store: MessengerStorePort) {}

  async execute(query: GetMessagesQuery): Promise<DirectMessage[]> {
    const conv = await this.store.findConversationById(query.orgId, query.conversationId);
    if (!conv) {
      throw new MessengerError('CONVERSATION_NOT_FOUND', `Conversation ${query.conversationId} not found`);
    }

    const isParticipant = conv.participants.some((p) => p.userId === query.userId);
    if (!isParticipant) {
      throw new MessengerError('NOT_PARTICIPANT', 'User is not a participant in this conversation');
    }

    const messages = await this.store.listMessages(query.orgId, query.conversationId, {
      limit: query.limit || 50,
      before: query.before,
    });

    const msgIds = messages.map((m) => m.id);
    if (msgIds.length > 0) {
      const [reactions, receipts] = await Promise.all([
        this.store.listReactionsForMessages(query.orgId, msgIds),
        this.store.listReceiptsForMessages(query.orgId, msgIds),
      ]);

      for (const msg of messages) {
        msg.reactions = reactions.filter((r) => r.messageId === msg.id);
        msg.receipts = receipts.filter((r) => r.messageId === msg.id);
      }
    }

    return messages;
  }
}
