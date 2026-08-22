import type { Clock } from '@zoqo/shared';
import type { B2bConnection } from '../domain/b2b-connection';
import { B2bError } from '../domain/b2b-error';
import type { B2bStorePort } from './ports/b2b-store.port';
import type { AuditPort } from '../../identity/application/ports/audit.port';

export interface AcceptConnectionCommand {
  connectionId: string;
  receiverOrgId: string;
  receiverUserId: string;
}

export class AcceptConnectionRequestUseCase {
  constructor(
    private readonly store: B2bStorePort,
    private readonly clock: Clock,
    private readonly audit?: AuditPort,
  ) {}

  async execute(cmd: AcceptConnectionCommand): Promise<B2bConnection> {
    const conn = await this.store.findConnectionById(cmd.connectionId);
    if (!conn) {
      throw new B2bError('B2B_NOT_FOUND', 'Connection request not found');
    }

    if (conn.receiverOrgId !== cmd.receiverOrgId) {
      throw new B2bError('B2B_UNAUTHORIZED_ACTION', 'Only the target organization can accept this connection request');
    }

    if (conn.status !== 'pending') {
      throw new B2bError('B2B_UNAUTHORIZED_ACTION', `Cannot accept connection request with status "${conn.status}"`);
    }

    conn.accept(this.clock.now());
    await this.store.saveConnection(conn);

    if (this.audit) {
      await this.audit.record({
        orgId: cmd.receiverOrgId,
        userId: cmd.receiverUserId,
        action: 'b2b.connection.accepted',
        targetId: conn.id,
        metadata: { senderOrgId: conn.senderOrgId },
      });
    }

    return conn;
  }
}
