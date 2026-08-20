export type DomainEvent = {
  type: string;
  tenantId: string | null;
  payload: Record<string, unknown>;
};

export interface EventBusPort {
  publish(event: DomainEvent): Promise<void>;
}
