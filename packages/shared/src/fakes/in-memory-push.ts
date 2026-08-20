import type { PushMessage, PushPort } from '../ports/push.port.js';

export class InMemoryPush implements PushPort {
  readonly sent: PushMessage[] = [];

  async send(msg: PushMessage): Promise<void> {
    this.sent.push(msg);
  }
}
