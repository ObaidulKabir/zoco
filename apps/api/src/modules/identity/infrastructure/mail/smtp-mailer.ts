import { Injectable } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import type { MailerPort, MailReceipt, OutboundMail } from '@zoqo/shared';

@Injectable()
export class SmtpMailer implements MailerPort {
  private readonly transport: Transporter;

  constructor() {
    this.transport = createTransport({
      host: process.env.SMTP_HOST ?? 'localhost',
      port: Number(process.env.SMTP_PORT ?? 1025),
      secure: false,
    });
  }

  async send(msg: OutboundMail): Promise<MailReceipt> {
    const info = await this.transport.sendMail({
      from: process.env.MAIL_FROM ?? 'noreply@zoqo.local',
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
    });
    return { messageId: String(info.messageId) };
  }
}
