import { Injectable } from '@nestjs/common';
import { query } from '../../../../db/pool';
import type { AuditEvent, AuditPort } from '../../application/ports/audit.port';

@Injectable()
export class PgAudit implements AuditPort {
  async record(event: AuditEvent): Promise<void> {
    await query(
      'insert into audit_log (type, user_id, email, ip, at, meta) values ($1,$2,$3,$4,$5,$6)',
      [event.type, event.userId, event.email, event.ip, event.at, JSON.stringify(event.meta ?? {})],
    );
  }
}
