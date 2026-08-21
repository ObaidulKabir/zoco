import type { ClockPort } from '@zoqo/shared';
import type { DirectMessage } from '../domain/message';
import { MessengerError } from '../domain/messenger-error';
import type { MessengerStorePort } from './ports/messenger-store.port';
import type { RealtimeNotifierPort } from './ports/realtime-notifier.port';

export interface PinMessageCommand {
  orgId: string;
  userId: string;
  userRole: string; // 'owner' | 'admin' | 'manager' | 'member'
  messageId: string;
  pin: boolean;
}

export class PinMessageUseCase {
  constructor(
    private readonly store: MessengerStorePort,
    private readonly realtime: RealtimeNotifierPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(cmd: PinMessageCommand): Promise<DirectMessage> {
    const isAllowed = cmd.userRole === 'owner' || cmd.userRole === 'admin' || cmd.userRole === 'manager';
    if (!isAllowed) {
      throw new MessengerError('PERMISSION_DENIED', 'Only managers, admins, and owners can pin messages');
    }

    const message = await this.store.findMessageById(cmd.orgId, cmd.messageId);
    if (!message) {
      throw new MessengerError('MESSAGE_NOT_FOUND', `Message ${cmd.messageId} not found`);
    }

    const now = this.clock.now();
    message.isPinned = cmd.pin;
    message.updatedAt = now;

    await this.store.updateMessage(message);

    const conv = await this.store.findConversationById(cmd.orgId, message.conversationId);
    const recipientIds = conv ? conv.participants.map((p) => p.userId) : [];

    await this.realtime.notifyMessageEdited(message.conversationId, message, recipientIds);

    return message;
  }
}
