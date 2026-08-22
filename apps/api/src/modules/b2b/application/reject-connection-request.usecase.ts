import type { ClockPort } from '@zoqo/shared';
import type { B2bConnection } from '../domain/b2b-connection';
import { B2bError } from '../domain/b2b-error';
import type { B2bStorePort } from './ports/b2b-store.port';
import type { AuditPort } from '../../identity/application/ports/audit.port';

export interface RejectConnectionCommand {
  connectionId: string;
  receiverOrgId: string;
  receiverUserId: string;
}

export class RejectConnectionRequestUseCase {
  constructor(
    private readonly store: B2bStorePort,
    private readonly clock: ClockPort,
    private readonly audit?: AuditPort,
  ) {}

  async execute(cmd: RejectConnectionCommand): Promise<B2bConnection> {
    const conn = await this.store.findConnectionById(cmd.connectionId);
    if (!conn) {
      throw new B2bError('B2B_NOT_FOUND', 'Connection request not found');
    }

    if (conn.receiverOrgId !== cmd.receiverOrgId) {
      throw new B2bError('B2B_UNAUTHORIZED_ACTION', 'Only the target organization can reject this connection request');
    }

    const now = this.clock.now();
    conn.reject(now);
    await this.store.saveConnection(conn);

    if (this.audit) {
      await this.audit.record({
        type: 'b2b.connection.rejected',
        userId: cmd.receiverUserId,
        email: null,
        ip: 'internal',
        at: now,
        meta: {
          orgId: cmd.receiverOrgId,
          senderOrgId: conn.senderOrgId,
          connectionId: conn.id,
        },
      });
    }

    return conn;
  }
}
