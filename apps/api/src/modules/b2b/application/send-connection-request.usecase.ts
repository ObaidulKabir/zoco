import { randomUUID } from 'node:crypto';
import type { Clock } from '@zoqo/shared';
import { B2bConnection } from '../domain/b2b-connection';
import { B2bError } from '../domain/b2b-error';
import type { B2bStorePort } from './ports/b2b-store.port';
import type { AuditPort } from '../../identity/application/ports/audit.port';
import type { RealtimeNotifierPort } from '../../messenger/application/ports/realtime-notifier.port';

export const FREE_TIER_DAILY_LIMIT = 10;

export interface SendConnectionRequestCommand {
  senderOrgId: string;
  senderUserId: string;
  receiverOrgId: string;
  introMessage: string;
}

export class SendConnectionRequestUseCase {
  constructor(
    private readonly store: B2bStorePort,
    private readonly clock: Clock,
    private readonly audit?: AuditPort,
    private readonly notifier?: RealtimeNotifierPort,
  ) {}

  async execute(cmd: SendConnectionRequestCommand): Promise<B2bConnection> {
    if (cmd.senderOrgId === cmd.receiverOrgId) {
      throw new B2bError('B2B_SELF_CONNECTION_FORBIDDEN', 'Cannot send connection request to own organization');
    }

    if (!cmd.introMessage || cmd.introMessage.trim().length === 0 || cmd.introMessage.length > 500) {
      throw new B2bError('B2B_INVALID_INTRO', 'Introduction message is required and must not exceed 500 characters');
    }

    const existing = await this.store.findConnectionBetweenOrgs(cmd.senderOrgId, cmd.receiverOrgId);
    if (existing) {
      if (existing.isBlocked()) {
        throw new B2bError('B2B_CONNECTION_BLOCKED', 'Connection requests to this organization are blocked');
      }
      if (existing.isConnected()) {
        throw new B2bError('B2B_ALREADY_CONNECTED', 'Organizations are already connected');
      }
      if (existing.isPending()) {
        throw new B2bError('B2B_ALREADY_CONNECTED', 'A connection request is already pending between these organizations');
      }
    }

    const todayStr = this.clock.now().toISOString().slice(0, 10);
    const dailyCount = await this.store.countDailyRequests(cmd.senderOrgId, todayStr);
    if (dailyCount >= FREE_TIER_DAILY_LIMIT) {
      throw new B2bError('B2B_DAILY_LIMIT_EXCEEDED', `Daily connection request limit (${FREE_TIER_DAILY_LIMIT}) exceeded for free tier`);
    }

    const now = this.clock.now();
    const conn = new B2bConnection({
      id: randomUUID(),
      senderOrgId: cmd.senderOrgId,
      senderUserId: cmd.senderUserId,
      receiverOrgId: cmd.receiverOrgId,
      introMessage: cmd.introMessage.trim(),
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      dailyRequestCount: dailyCount + 1,
      lastRequestDate: todayStr,
    });

    await this.store.saveConnection(conn);

    if (this.audit) {
      await this.audit.record({
        orgId: cmd.senderOrgId,
        userId: cmd.senderUserId,
        action: 'b2b.connection.requested',
        targetId: conn.id,
        metadata: { receiverOrgId: cmd.receiverOrgId },
      });
    }

    return conn;
  }
}
