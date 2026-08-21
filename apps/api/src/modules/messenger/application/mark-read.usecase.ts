import { randomUUID } from 'node:crypto';
import type { ClockPort } from '@zoqo/shared';
import type { MessageReceipt } from '../domain/message';
import { MessengerError } from '../domain/messenger-error';
import type { MessengerStorePort } from './ports/messenger-store.port';
import type { RealtimeNotifierPort } from './ports/realtime-notifier.port';

export interface MarkReadCommand {
  orgId: string;
  userId: string;
  conversationId: string;
  messageId: string;
}

export class MarkReadUseCase {
  constructor(
    private readonly store: MessengerStorePort,
    private readonly realtime: RealtimeNotifierPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(cmd: MarkReadCommand): Promise<MessageReceipt> {
    const conv = await this.store.findConversationById(cmd.orgId, cmd.conversationId);
    if (!conv || !conv.participants.some((p) => p.userId === cmd.userId)) {
      throw new MessengerError('NOT_PARTICIPANT', 'User is not a participant in this conversation');
    }

    const message = await this.store.findMessageById(cmd.orgId, cmd.messageId);
    if (!message) {
      throw new MessengerError('MESSAGE_NOT_FOUND', `Message ${cmd.messageId} not found`);
    }

    const now = this.clock.now();
    const receipt: MessageReceipt = {
      id: randomUUID(),
      messageId: cmd.messageId,
      orgId: cmd.orgId,
      userId: cmd.userId,
      status: 'read',
      readAt: now,
    };

    await this.store.saveReceipt(receipt);
    await this.store.updateParticipantLastRead(cmd.conversationId, cmd.userId, now);

    const recipientIds = conv.participants.map((p) => p.userId);
    await this.realtime.notifyReceiptUpdated(cmd.conversationId, receipt, recipientIds);

    return receipt;
  }
}
