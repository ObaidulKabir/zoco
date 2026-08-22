import type { ClockPort } from '@zoqo/shared';
import { B2bError } from '../domain/b2b-error';
import type { B2bStorePort } from './ports/b2b-store.port';
import type { AuditPort } from '../../identity/application/ports/audit.port';

export interface DisconnectB2bCommand {
  connectionId?: string;
  otherOrgId?: string;
  orgId: string;
  userId: string;
}

export class DisconnectB2bUseCase {
  constructor(
    private readonly store: B2bStorePort,
    private readonly clock: ClockPort,
    private readonly audit?: AuditPort,
  ) {}

  async execute(cmd: DisconnectB2bCommand): Promise<{ disconnected: boolean; connectionId: string }> {
    let conn = cmd.connectionId ? await this.store.findConnectionById(cmd.connectionId) : null;

    if (!conn && cmd.otherOrgId) {
      conn = await this.store.findConnectionBetweenOrgs(cmd.orgId, cmd.otherOrgId);
    }

    if (!conn) {
      throw new B2bError('B2B_NOT_FOUND', 'Connection not found');
    }

    if (conn.senderOrgId !== cmd.orgId && conn.receiverOrgId !== cmd.orgId) {
      throw new B2bError('B2B_UNAUTHORIZED_ACTION', 'Cannot disconnect a connection that does not belong to your organization');
    }

    const now = this.clock.now();
    await this.store.deleteConnection(conn.id);

    if (this.audit) {
      await this.audit.record({
        type: 'b2b.connection.disconnected',
        userId: cmd.userId,
        email: null,
        ip: 'internal',
        at: now,
        meta: {
          orgId: cmd.orgId,
          partnerOrgId: conn.senderOrgId === cmd.orgId ? conn.receiverOrgId : conn.senderOrgId,
          connectionId: conn.id,
        },
      });
    }

    return { disconnected: true, connectionId: conn.id };
  }
}
