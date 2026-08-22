export type B2bConnectionStatus = 'pending' | 'accepted' | 'rejected' | 'blocked';

export interface B2bConnectionProps {
  id: string;
  senderOrgId: string;
  senderUserId: string;
  receiverOrgId: string;
  introMessage: string;
  status: B2bConnectionStatus;
  createdAt: Date;
  updatedAt: Date;
  acceptedAt?: Date | null;
  dailyRequestCount?: number;
  lastRequestDate?: string;
}

export class B2bConnection {
  readonly id: string;
  readonly senderOrgId: string;
  readonly senderUserId: string;
  readonly receiverOrgId: string;
  readonly introMessage: string;
  status: B2bConnectionStatus;
  readonly createdAt: Date;
  updatedAt: Date;
  acceptedAt: Date | null;
  dailyRequestCount: number;
  lastRequestDate: string;

  constructor(props: B2bConnectionProps) {
    this.id = props.id;
    this.senderOrgId = props.senderOrgId;
    this.senderUserId = props.senderUserId;
    this.receiverOrgId = props.receiverOrgId;
    this.introMessage = props.introMessage;
    this.status = props.status;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.acceptedAt = props.acceptedAt ?? null;
    this.dailyRequestCount = props.dailyRequestCount ?? 0;
    this.lastRequestDate = props.lastRequestDate ?? new Date().toISOString().slice(0, 10);
  }

  accept(now: Date = new Date()): void {
    if (this.status === 'blocked') {
      throw new Error('BLOCKED_CONNECTION_CANNOT_BE_ACCEPTED');
    }
    this.status = 'accepted';
    this.acceptedAt = now;
    this.updatedAt = now;
  }

  reject(now: Date = new Date()): void {
    this.status = 'rejected';
    this.updatedAt = now;
  }

  block(now: Date = new Date()): void {
    this.status = 'blocked';
    this.updatedAt = now;
  }

  isConnected(): boolean {
    return this.status === 'accepted';
  }

  isPending(): boolean {
    return this.status === 'pending';
  }

  isBlocked(): boolean {
    return this.status === 'blocked';
  }
}
