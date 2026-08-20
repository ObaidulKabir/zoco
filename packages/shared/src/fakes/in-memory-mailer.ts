import type { MailerPort, MailReceipt, OutboundMail } from '../ports/mailer.port.js';

export class InMemoryMailer implements MailerPort {
  readonly sent: OutboundMail[] = [];

  async send(msg: OutboundMail): Promise<MailReceipt> {
    this.sent.push(msg);
    return { messageId: `mem-${this.sent.length}` };
  }
}
