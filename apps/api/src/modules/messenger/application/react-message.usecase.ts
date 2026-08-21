import { randomUUID } from 'node:crypto';
import type { ClockPort } from '@zoqo/shared';
import type { MessageReaction } from '../domain/message';
import { MessengerError } from '../domain/messenger-error';
import type { MessengerStorePort } from './ports/messenger-store.port';
import type { RealtimeNotifierPort } from './ports/realtime-notifier.port';

export interface AddReactionCommand {
  orgId: string;
  userId: string;
  messageId: string;
  emoji: string;
}

export interface RemoveReactionCommand {
  orgId: string;
  userId: string;
  messageId: string;
  emoji: string;
}

export class ReactMessageUseCase {
  constructor(
    private readonly store: MessengerStorePort,
    private readonly realtime: RealtimeNotifierPort,
    private readonly clock: ClockPort,
  ) {}

  async addReaction(cmd: AddReactionCommand): Promise<MessageReaction> {
    if (!cmd.emoji || cmd.emoji.trim() === '') {
      throw new MessengerError('VALIDATION_ERROR', 'Emoji is required');
    }

    const message = await this.store.findMessageById(cmd.orgId, cmd.messageId);
    if (!message) {
      throw new MessengerError('MESSAGE_NOT_FOUND', `Message ${cmd.messageId} not found`);
    }

    const conv = await this.store.findConversationById(cmd.orgId, message.conversationId);
    if (!conv || !conv.participants.some((p) => p.userId === cmd.userId)) {
      throw new MessengerError('NOT_PARTICIPANT', 'User is not a participant in this conversation');
    }

    const now = this.clock.now();
    const reaction: MessageReaction = {
      id: randomUUID(),
      messageId: cmd.messageId,
      orgId: cmd.orgId,
      userId: cmd.userId,
      emoji: cmd.emoji,
      createdAt: now,
    };

    await this.store.addReaction(reaction);

    const recipientIds = conv.participants.map((p) => p.userId);
    await this.realtime.notifyReactionUpdated(conv.id, message.id, reaction, 'added', recipientIds);

    return reaction;
  }

  async removeReaction(cmd: RemoveReactionCommand): Promise<void> {
    const message = await this.store.findMessageById(cmd.orgId, cmd.messageId);
    if (!message) {
      throw new MessengerError('MESSAGE_NOT_FOUND', `Message ${cmd.messageId} not found`);
    }

    const conv = await this.store.findConversationById(cmd.orgId, message.conversationId);
    if (!conv || !conv.participants.some((p) => p.userId === cmd.userId)) {
      throw new MessengerError('NOT_PARTICIPANT', 'User is not a participant in this conversation');
    }

    await this.store.removeReaction(cmd.orgId, cmd.messageId, cmd.userId, cmd.emoji);

    const dummyReaction: MessageReaction = {
      id: '',
      messageId: cmd.messageId,
      orgId: cmd.orgId,
      userId: cmd.userId,
      emoji: cmd.emoji,
      createdAt: this.clock.now(),
    };
    const recipientIds = conv.participants.map((p) => p.userId);
    await this.realtime.notifyReactionUpdated(conv.id, message.id, dummyReaction, 'removed', recipientIds);
  }
}
