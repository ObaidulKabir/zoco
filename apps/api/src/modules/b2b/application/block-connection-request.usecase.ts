import { randomUUID } from 'node:crypto';
import type { ClockPort } from '@zoqo/shared';
import { B2bConnection } from '../domain/b2b-connection';
import { B2bError } from '../domain/b2b-error';
import type { B2bStorePort } from './ports/b2b-store.port';
import type { AuditPort } from '../../identity/application/ports/audit.port';

export interface BlockConnectionCommand {
  connectionId?: string;
  targetOrgId?: string;
  blockerOrgId: string;
  blockerUserId: string;
}

export class BlockConnectionRequestUseCase {
  constructor(
    private readonly store: B2bStorePort,
    private readonly clock: ClockPort,
    private readonly audit?: AuditPort,
  ) {}

  async execute(cmd: BlockConnectionCommand): Promise<B2bConnection> {
    let conn: B2bConnection | null = null;

    if (cmd.connectionId) {
      conn = await this.store.findConnectionById(cmd.connectionId);
    } else if (cmd.targetOrgId) {
      conn = await this.store.findConnectionBetweenOrgs(cmd.blockerOrgId, cmd.targetOrgId);
    }

    const now = this.clock.now();

    if (conn) {
      if (conn.receiverOrgId !== cmd.blockerOrgId && conn.senderOrgId !== cmd.blockerOrgId) {
        throw new B2bError('B2B_UNAUTHORIZED_ACTION', 'Cannot block a connection not involving your organization');
      }
      conn.block(now);
      await this.store.saveConnection(conn);
    } else if (cmd.targetOrgId) {
      if (cmd.targetOrgId === cmd.blockerOrgId) {
        throw new B2bError('B2B_SELF_CONNECTION_FORBIDDEN', 'Cannot block own organization');
      }
      conn = new B2bConnection({
        id: randomUUID(),
        senderOrgId: cmd.targetOrgId,
        senderUserId: 'system',
        receiverOrgId: cmd.blockerOrgId,
        introMessage: 'BLOCKED',
        status: 'blocked',
        createdAt: now,
        updatedAt: now,
      });
      await this.store.saveConnection(conn);
    } else {
      throw new B2bError('B2B_NOT_FOUND', 'Connection or target organization not found to block');
    }

    if (this.audit) {
      await this.audit.record({
        type: 'b2b.connection.blocked',
        userId: cmd.blockerUserId,
        email: null,
        ip: 'internal',
        at: now,
        meta: {
          orgId: cmd.blockerOrgId,
          blockedOrgId: conn.senderOrgId === cmd.blockerOrgId ? conn.receiverOrgId : conn.senderOrgId,
          connectionId: conn.id,
        },
      });
    }

    return conn;
  }
}
