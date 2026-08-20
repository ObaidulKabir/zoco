export type UserStatus = 'pending_verification' | 'active' | 'locked' | 'suspended';

const FAIL_WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 30 * 60 * 1000;
const MAX_FAILURES = 5;

export class User {
  constructor(
    readonly id: string,
    readonly email: string,
    readonly name: string,
    public passwordHash: string,
    public status: UserStatus,
    public failedAt: Date[],
    public lockedUntil: Date | null,
    public passwordHistory: string[],
    public emailOtpHash: string | null,
    public emailOtpExpiresAt: Date | null,
    public passwordResetHash: string | null,
    public passwordResetExpiresAt: Date | null,
    readonly createdAt: Date,
  ) {}

  static create(input: {
    id: string;
    email: string;
    name: string;
    passwordHash: string;
    now: Date;
  }): User {
    return new User(
      input.id,
      input.email,
      input.name,
      input.passwordHash,
      'pending_verification',
      [],
      null,
      [input.passwordHash],
      null,
      null,
      null,
      null,
      input.now,
    );
  }

  isLocked(now: Date): boolean {
    return this.lockedUntil !== null && this.lockedUntil.getTime() > now.getTime();
  }

  recordFailedLogin(now: Date): void {
    const windowStart = now.getTime() - FAIL_WINDOW_MS;
    this.failedAt = [...this.failedAt.filter((d) => d.getTime() >= windowStart), now];
    if (this.failedAt.length >= MAX_FAILURES) {
      this.lockedUntil = new Date(now.getTime() + LOCK_MS);
      this.status = this.status === 'pending_verification' ? this.status : 'active';
    }
  }

  recordSuccessfulLogin(): void {
    this.failedAt = [];
    this.lockedUntil = null;
  }

  setEmailOtp(hash: string, expiresAt: Date): void {
    this.emailOtpHash = hash;
    this.emailOtpExpiresAt = expiresAt;
  }

  verifyEmail(now: Date, otpHash: string): boolean {
    if (!this.emailOtpHash || !this.emailOtpExpiresAt) return false;
    if (this.emailOtpExpiresAt.getTime() < now.getTime()) return false;
    if (this.emailOtpHash !== otpHash) return false;
    this.status = 'active';
    this.emailOtpHash = null;
    this.emailOtpExpiresAt = null;
    return true;
  }

  setPasswordReset(hash: string, expiresAt: Date): void {
    this.passwordResetHash = hash;
    this.passwordResetExpiresAt = expiresAt;
  }

  consumePasswordReset(now: Date, hash: string): boolean {
    if (!this.passwordResetHash || !this.passwordResetExpiresAt) return false;
    if (this.passwordResetExpiresAt.getTime() < now.getTime()) return false;
    if (this.passwordResetHash !== hash) return false;
    this.passwordResetHash = null;
    this.passwordResetExpiresAt = null;
    return true;
  }

  replacePassword(newHash: string): void {
    this.passwordHistory = [...this.passwordHistory, newHash].slice(-3);
    this.passwordHash = newHash;
  }

  toPublic() {
    return { id: this.id, email: this.email, name: this.name, status: this.status };
  }
}
