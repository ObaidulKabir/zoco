export type OrgAuditEvent = {
  type: string;
  orgId: string | null;
  userId: string | null;
  email: string | null;
  at: Date;
  meta?: Record<string, unknown>;
};

export interface OrgAuditPort {
  record(event: OrgAuditEvent): Promise<void>;
}
