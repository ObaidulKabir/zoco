import { randomUUID } from 'node:crypto';
import type { ClockPort } from '@zoqo/shared';
import type { Conversation } from '../domain/conversation';
import { MessengerError } from '../domain/messenger-error';
import type { MessengerStorePort } from './ports/messenger-store.port';

export interface MembershipCheckerPort {
  isMember(orgId: string, userId: string): Promise<boolean>;
  findOrgsForUser?(userId: string): Promise<string[]>;
  areOrgsConnected?(orgAId: string, orgBId: string): Promise<boolean>;
}

export interface GetOrCreateDmCommand {
  orgId: string;
  requesterId: string;
  recipientId: string;
}

export class GetOrCreateDmUseCase {
  constructor(
    private readonly store: MessengerStorePort,
    private readonly clock: ClockPort,
    private readonly membershipChecker?: MembershipCheckerPort,
  ) {}

  async execute(cmd: GetOrCreateDmCommand): Promise<Conversation> {
    if (cmd.requesterId === cmd.recipientId) {
      throw new MessengerError('VALIDATION_ERROR', 'Cannot start a direct message with yourself');
    }

    if (this.membershipChecker) {
      const isMember = await this.membershipChecker.isMember(cmd.orgId, cmd.recipientId);
      if (!isMember) {
        let isB2b = false;
        if (this.membershipChecker.findOrgsForUser && this.membershipChecker.areOrgsConnected) {
          const recipientOrgIds = await this.membershipChecker.findOrgsForUser(cmd.recipientId);
          for (const targetOrgId of recipientOrgIds) {
            if (await this.membershipChecker.areOrgsConnected(cmd.orgId, targetOrgId)) {
              isB2b = true;
              break;
            }
          }
        }
        if (!isB2b) {
          throw new MessengerError('CROSS_TENANT_FORBIDDEN', 'Recipient is not a member of this organization');
        }
      }
    }

    const existing = await this.store.findDirectConversation(cmd.orgId, cmd.requesterId, cmd.recipientId);
    if (existing) {
      return existing;
    }

    let recipientOrgId: string = cmd.orgId;
    if (this.membershipChecker?.findOrgsForUser) {
      const recipientOrgIds = await this.membershipChecker.findOrgsForUser(cmd.recipientId);
      if (recipientOrgIds.length > 0 && !recipientOrgIds.includes(cmd.orgId)) {
        recipientOrgId = recipientOrgIds[0] || cmd.orgId;
      }
    }

    const now = this.clock.now();
    const conv: Conversation = {
      id: randomUUID(),
      orgId: cmd.orgId,
      type: recipientOrgId !== cmd.orgId ? 'b2b_dm' : 'dm',
      createdBy: cmd.requesterId,
      participants: [
        {
          userId: cmd.requesterId,
          orgId: cmd.orgId,
          joinedAt: now,
          isMuted: false,
        },
        {
          userId: cmd.recipientId,
          orgId: recipientOrgId,
          joinedAt: now,
          isMuted: false,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    await this.store.createConversation(conv);
    return conv;
  }
}
