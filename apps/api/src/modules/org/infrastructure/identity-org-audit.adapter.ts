import type { AuditPort } from '../../identity/application/ports/audit.port';
import type { OrgAuditPort, OrgAuditEvent } from '../application/ports/org-audit.port';

export class IdentityOrgAuditAdapter implements OrgAuditPort {
  constructor(private readonly audit: AuditPort) {}

  async record(event: OrgAuditEvent): Promise<void> {
    await this.audit.record({
      type: event.type,
      userId: event.userId,
      email: event.email,
      ip: 'org',
      at: event.at,
      meta: { orgId: event.orgId, ...event.meta },
    });
  }
}
