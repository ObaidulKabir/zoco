import type { ConversationSummary } from '../domain/conversation';
import type { MessengerStorePort } from './ports/messenger-store.port';

export class ListConversationsUseCase {
  constructor(private readonly store: MessengerStorePort) {}

  async execute(orgId: string, userId: string): Promise<ConversationSummary[]> {
    return this.store.listConversationsForUser(orgId, userId);
  }
}
