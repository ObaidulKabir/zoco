import type { ClockPort } from '@zoqo/shared';
import type { DirectMessage } from '../domain/message';
import { MessengerError } from '../domain/messenger-error';
import type { MessengerStorePort } from './ports/messenger-store.port';
import type { RealtimeNotifierPort } from './ports/realtime-notifier.port';

export interface DeleteMessageCommand {
  orgId: string;
  userId: string;
  userRole?: string;
  messageId: string;
}

export class DeleteMessageUseCase {
  constructor(
    private readonly store: MessengerStorePort,
    private readonly realtime: RealtimeNotifierPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(cmd: DeleteMessageCommand): Promise<DirectMessage> {
    const message = await this.store.findMessageById(cmd.orgId, cmd.messageId);
    if (!message) {
      throw new MessengerError('MESSAGE_NOT_FOUND', `Message ${cmd.messageId} not found`);
    }

    const isAuthor = message.senderId === cmd.userId;
    const isAdmin = cmd.userRole === 'owner' || cmd.userRole === 'admin';
    if (!isAuthor && !isAdmin) {
      throw new MessengerError('PERMISSION_DENIED', 'Cannot delete this message');
    }

    const now = this.clock.now();
    message.isDeleted = true;
    message.deletedAt = now;
    message.contentCiphertext = ''; // Clear ciphertext on soft delete
    message.updatedAt = now;

    await this.store.updateMessage(message);

    const conv = await this.store.findConversationById(cmd.orgId, message.conversationId);
    const recipientIds = conv ? conv.participants.map((p) => p.userId).filter((id) => id !== cmd.userId) : [];

    await this.realtime.notifyMessageDeleted(message.conversationId, message.id, recipientIds);

    return message;
  }
}
