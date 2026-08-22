import type { Conversation, ConversationSummary } from '../../domain/conversation';
import type { DirectMessage, MessageReaction, MessageReceipt } from '../../domain/message';
import type { PrekeyBundle } from '../../domain/prekey-bundle';
import type { MessengerStorePort } from '../../application/ports/messenger-store.port';

export class InMemoryMessengerStore implements MessengerStorePort {
  private conversations = new Map<string, Conversation>();
  private messages = new Map<string, DirectMessage>();
  private reactions: MessageReaction[] = [];
  private receipts: MessageReceipt[] = [];
  private prekeyBundles = new Map<string, PrekeyBundle>();

  async createConversation(conv: Conversation): Promise<void> {
    this.conversations.set(conv.id, JSON.parse(JSON.stringify(conv)));
  }

  async findConversationById(orgId: string, id: string): Promise<Conversation | null> {
    const conv = this.conversations.get(id);
    if (!conv) return null;
    const hasOrgAccess = conv.orgId === orgId || conv.participants.some((p) => p.orgId === orgId);
    if (!hasOrgAccess) return null;
    return JSON.parse(JSON.stringify(conv));
  }

  async findDirectConversation(orgId: string, userA: string, userB: string): Promise<Conversation | null> {
    for (const conv of this.conversations.values()) {
      const hasOrgAccess = conv.orgId === orgId || conv.participants.some((p) => p.orgId === orgId);
      if (hasOrgAccess && (conv.type === 'dm' || conv.type === 'b2b_direct')) {
        const participantIds = conv.participants.map((p) => p.userId);
        if (participantIds.includes(userA) && participantIds.includes(userB)) {
          return JSON.parse(JSON.stringify(conv));
        }
      }
    }
    return null;
  }

  async listConversationsForUser(orgId: string, userId: string): Promise<ConversationSummary[]> {
    const summaries: ConversationSummary[] = [];
    for (const conv of this.conversations.values()) {
      const hasOrgAccess = conv.orgId === orgId || conv.participants.some((p) => p.orgId === orgId);
      if (hasOrgAccess && conv.participants.some((p) => p.userId === userId)) {
        const otherParticipant = conv.participants.find((p) => p.userId !== userId);
        const convMessages = Array.from(this.messages.values())
          .filter((m) => m.conversationId === conv.id)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        const lastMsg = convMessages[0];
        const participant = conv.participants.find((p) => p.userId === userId);
        const lastReadAt = participant?.lastReadAt ? new Date(participant.lastReadAt).getTime() : 0;

        const unreadCount = convMessages.filter(
          (m) => m.senderId !== userId && new Date(m.createdAt).getTime() > lastReadAt,
        ).length;

        summaries.push({
          id: conv.id,
          orgId: conv.orgId,
          type: conv.type,
          channelId: conv.channelId,
          otherParticipant: otherParticipant ? { userId: otherParticipant.userId } : undefined,
          lastMessage: lastMsg
            ? {
                id: lastMsg.id,
                senderId: lastMsg.senderId,
                contentCiphertext: lastMsg.contentCiphertext,
                contentType: lastMsg.contentType,
                createdAt: lastMsg.createdAt,
              }
            : undefined,
          unreadCount,
          updatedAt: conv.updatedAt,
        });
      }
    }
    return summaries.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async saveMessage(msg: DirectMessage): Promise<void> {
    this.messages.set(msg.id, JSON.parse(JSON.stringify(msg)));
    const conv = this.conversations.get(msg.conversationId);
    if (conv) {
      conv.updatedAt = msg.createdAt;
    }
  }

  async findMessageById(orgId: string, id: string): Promise<DirectMessage | null> {
    const msg = this.messages.get(id);
    if (!msg || msg.orgId !== orgId) return null;
    return JSON.parse(JSON.stringify(msg));
  }

  async updateMessage(msg: DirectMessage): Promise<void> {
    this.messages.set(msg.id, JSON.parse(JSON.stringify(msg)));
  }

  async listMessages(
    orgId: string,
    conversationId: string,
    options?: { limit?: number; before?: Date },
  ): Promise<DirectMessage[]> {
    let list = Array.from(this.messages.values()).filter(
      (m) => m.orgId === orgId && m.conversationId === conversationId,
    );

    if (options?.before) {
      const beforeTime = new Date(options.before).getTime();
      list = list.filter((m) => new Date(m.createdAt).getTime() < beforeTime);
    }

    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (options?.limit) {
      list = list.slice(0, options.limit);
    }

    return list.reverse().map((m) => JSON.parse(JSON.stringify(m)));
  }

  async addReaction(reaction: MessageReaction): Promise<void> {
    this.reactions = this.reactions.filter(
      (r) => !(r.messageId === reaction.messageId && r.userId === reaction.userId && r.emoji === reaction.emoji),
    );
    this.reactions.push(JSON.parse(JSON.stringify(reaction)));
  }

  async removeReaction(orgId: string, messageId: string, userId: string, emoji: string): Promise<void> {
    this.reactions = this.reactions.filter(
      (r) => !(r.orgId === orgId && r.messageId === messageId && r.userId === userId && r.emoji === emoji),
    );
  }

  async listReactionsForMessages(orgId: string, messageIds: string[]): Promise<MessageReaction[]> {
    return this.reactions
      .filter((r) => r.orgId === orgId && messageIds.includes(r.messageId))
      .map((r) => JSON.parse(JSON.stringify(r)));
  }

  async saveReceipt(receipt: MessageReceipt): Promise<void> {
    this.receipts = this.receipts.filter(
      (r) => !(r.messageId === receipt.messageId && r.userId === receipt.userId && r.status === receipt.status),
    );
    this.receipts.push(JSON.parse(JSON.stringify(receipt)));
  }

  async listReceiptsForMessages(orgId: string, messageIds: string[]): Promise<MessageReceipt[]> {
    return this.receipts
      .filter((r) => r.orgId === orgId && messageIds.includes(r.messageId))
      .map((r) => JSON.parse(JSON.stringify(r)));
  }

  async updateParticipantLastRead(conversationId: string, userId: string, readAt: Date): Promise<void> {
    const conv = this.conversations.get(conversationId);
    if (conv) {
      const p = conv.participants.find((x) => x.userId === userId);
      if (p) {
        p.lastReadAt = readAt;
      }
    }
  }

  async savePrekeyBundle(bundle: PrekeyBundle): Promise<void> {
    this.prekeyBundles.set(bundle.userId, JSON.parse(JSON.stringify(bundle)));
  }

  async findPrekeyBundle(userId: string): Promise<PrekeyBundle | null> {
    const b = this.prekeyBundles.get(userId);
    if (!b) return null;
    return JSON.parse(JSON.stringify(b));
  }

  async consumeOneTimePrekey(userId: string): Promise<{
    identityKey: string;
    signedPrekey: string;
    signedPrekeySignature: string;
    oneTimePrekey?: { keyId: number; publicKey: string };
  } | null> {
    const bundle = this.prekeyBundles.get(userId);
    if (!bundle) return null;

    let otp: { keyId: number; publicKey: string } | undefined;
    if (bundle.oneTimePrekeys && bundle.oneTimePrekeys.length > 0) {
      otp = bundle.oneTimePrekeys.shift();
    }

    return {
      identityKey: bundle.identityKey,
      signedPrekey: bundle.signedPrekey,
      signedPrekeySignature: bundle.signedPrekeySignature,
      oneTimePrekey: otp,
    };
  }

  clear(): void {
    this.conversations.clear();
    this.messages.clear();
    this.reactions = [];
    this.receipts = [];
    this.prekeyBundles.clear();
  }
}
