export type OutboundMail = {
  to: string;
  subject: string;
  text: string;
};

export type MailReceipt = {
  messageId: string;
};

export interface MailerPort {
  send(msg: OutboundMail): Promise<MailReceipt>;
}
