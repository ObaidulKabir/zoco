import { Injectable } from '@nestjs/common';
import type { AuditEvent, AuditPort } from '../../application/ports/audit.port';

@Injectable()
export class InMemoryAudit implements AuditPort {
  readonly events: AuditEvent[] = [];

  async record(event: AuditEvent): Promise<void> {
    this.events.push(event);
  }

  clear(): void {
    this.events.length = 0;
  }
}
