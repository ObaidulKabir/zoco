import { randomUUID } from 'node:crypto';
import type { ClockPort } from '@zoqo/shared';
import type { ContentType, DirectMessage } from '../domain/message';
import { MessengerError } from '../domain/messenger-error';
import type { MessengerStorePort } from './ports/messenger-store.port';
import type { RealtimeNotifierPort } from './ports/realtime-notifier.port';

export interface SendDmCommand {
  orgId: string;
  senderId: string;
  conversationId: string;
  contentCiphertext: string;
  envelopeIv?: string;
  envelopeTag?: string;
  contentType?: ContentType;
  replyToId?: string;
}

export class SendDmUseCase {
  constructor(
    private readonly store: MessengerStorePort,
    private readonly realtime: RealtimeNotifierPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(cmd: SendDmCommand): Promise<DirectMessage> {
    if (!cmd.contentCiphertext || cmd.contentCiphertext.trim() === '') {
      throw new MessengerError('VALIDATION_ERROR', 'Message content ciphertext is required');
    }

    const conversation = await this.store.findConversationById(cmd.orgId, cmd.conversationId);
    if (!conversation) {
      throw new MessengerError('CONVERSATION_NOT_FOUND', `Conversation ${cmd.conversationId} not found`);
    }

    const isParticipant = conversation.participants.some((p) => p.userId === cmd.senderId);
    if (!isParticipant) {
      throw new MessengerError('NOT_PARTICIPANT', 'User is not a participant in this conversation');
    }

    if (cmd.replyToId) {
      const parent = await this.store.findMessageById(cmd.orgId, cmd.replyToId);
      if (!parent || parent.conversationId !== cmd.conversationId) {
        throw new MessengerError('MESSAGE_NOT_FOUND', `Replied message ${cmd.replyToId} not found in conversation`);
      }
    }

    const now = this.clock.now();
    const message: DirectMessage = {
      id: randomUUID(),
      conversationId: cmd.conversationId,
      orgId: cmd.orgId,
      senderId: cmd.senderId,
      contentCiphertext: cmd.contentCiphertext,
      envelopeIv: cmd.envelopeIv || '',
      envelopeTag: cmd.envelopeTag || '',
      contentType: cmd.contentType || 'text',
      replyToId: cmd.replyToId,
      isEdited: false,
      isDeleted: false,
      isPinned: false,
      createdAt: now,
      updatedAt: now,
    };

    await this.store.saveMessage(message);

    const recipientIds = conversation.participants
      .map((p) => p.userId)
      .filter((id) => id !== cmd.senderId);

    await this.realtime.notifyNewMessage(cmd.conversationId, message, recipientIds);

    return message;
  }
}
