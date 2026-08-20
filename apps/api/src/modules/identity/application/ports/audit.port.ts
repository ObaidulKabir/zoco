export type AuditEvent = {
  type: string;
  userId: string | null;
  email: string | null;
  ip: string;
  at: Date;
  meta?: Record<string, unknown>;
};

export interface AuditPort {
  record(event: AuditEvent): Promise<void>;
}
