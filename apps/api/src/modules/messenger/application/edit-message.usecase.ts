import type { ClockPort } from '@zoqo/shared';
import { EDIT_WINDOW_MS, type DirectMessage } from '../domain/message';
import { MessengerError } from '../domain/messenger-error';
import type { MessengerStorePort } from './ports/messenger-store.port';
import type { RealtimeNotifierPort } from './ports/realtime-notifier.port';

export interface EditMessageCommand {
  orgId: string;
  userId: string;
  messageId: string;
  contentCiphertext: string;
  envelopeIv?: string;
  envelopeTag?: string;
}

export class EditMessageUseCase {
  constructor(
    private readonly store: MessengerStorePort,
    private readonly realtime: RealtimeNotifierPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(cmd: EditMessageCommand): Promise<DirectMessage> {
    if (!cmd.contentCiphertext || cmd.contentCiphertext.trim() === '') {
      throw new MessengerError('VALIDATION_ERROR', 'Updated message content ciphertext is required');
    }

    const message = await this.store.findMessageById(cmd.orgId, cmd.messageId);
    if (!message) {
      throw new MessengerError('MESSAGE_NOT_FOUND', `Message ${cmd.messageId} not found`);
    }

    if (message.senderId !== cmd.userId) {
      throw new MessengerError('PERMISSION_DENIED', 'Cannot edit another user message');
    }

    if (message.isDeleted) {
      throw new MessengerError('VALIDATION_ERROR', 'Cannot edit a deleted message');
    }

    const now = this.clock.now();
    const ageMs = now.getTime() - new Date(message.createdAt).getTime();
    if (ageMs > EDIT_WINDOW_MS) {
      throw new MessengerError('EDIT_WINDOW_EXPIRED', 'Message edit window of 15 minutes has expired');
    }

    message.contentCiphertext = cmd.contentCiphertext;
    if (cmd.envelopeIv !== undefined) message.envelopeIv = cmd.envelopeIv;
    if (cmd.envelopeTag !== undefined) message.envelopeTag = cmd.envelopeTag;
    message.isEdited = true;
    message.editedAt = now;
    message.updatedAt = now;

    await this.store.updateMessage(message);

    const conv = await this.store.findConversationById(cmd.orgId, message.conversationId);
    const recipientIds = conv ? conv.participants.map((p) => p.userId).filter((id) => id !== cmd.userId) : [];

    await this.realtime.notifyMessageEdited(message.conversationId, message, recipientIds);

    return message;
  }
}
