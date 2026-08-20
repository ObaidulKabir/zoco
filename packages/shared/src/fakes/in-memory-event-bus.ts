import type { DomainEvent, EventBusPort } from '../ports/event-bus.port.js';

export class InMemoryEventBus implements EventBusPort {
  readonly events: DomainEvent[] = [];

  async publish(event: DomainEvent): Promise<void> {
    this.events.push(event);
  }
}
