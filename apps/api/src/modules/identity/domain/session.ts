export class Session {
  constructor(
    readonly id: string,
    readonly userId: string,
    public refreshTokenHash: string,
    readonly userAgent: string,
    readonly ip: string,
    readonly createdAt: Date,
    public lastActiveAt: Date,
    readonly expiresAt: Date,
  ) {}

  touch(now: Date): void {
    this.lastActiveAt = now;
  }

  toPublic(currentId?: string) {
    return {
      id: this.id,
      device: this.userAgent || 'unknown',
      ip: this.ip,
      location: 'unknown',
      lastActiveAt: this.lastActiveAt.toISOString(),
      current: currentId === this.id,
    };
  }
}
