import { err, ok, type Result } from '@zoqo/shared';
import type { ClockPort, MailerPort } from '@zoqo/shared';
import { AuthError, authError, isAuthError } from '../domain/auth-error';
import { sha256 } from '../domain/crypto';
import { normalizeEmail, validateEmailFormat } from '../domain/password-policy';
import type { SessionStorePort } from './ports/session-store.port';
import type { TokenPort } from './ports/token.port';
import type { UserStorePort } from './ports/user-store.port';
import { issueSession, type AuthSessionBundle } from './issue-session';

export class VerifyEmailUseCase {
  constructor(
    private readonly users: UserStorePort,
    private readonly sessions: SessionStorePort,
    private readonly tokens: TokenPort,
    private readonly mailer: MailerPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: {
    email: string;
    otp: string;
    ip: string;
    userAgent: string;
  }): Promise<Result<AuthSessionBundle, AuthError>> {
    try {
      validateEmailFormat(input.email);
      const user = await this.users.findByEmail(normalizeEmail(input.email));
      if (!user) {
        throw authError('VALIDATION_ERROR', 'Invalid or expired verification code', [
          { field: 'otp', message: 'Invalid or expired verification code', code: 'INVALID' },
        ]);
      }
      const now = this.clock.now();
      if (!user.verifyEmail(now, sha256(input.otp))) {
        throw authError('VALIDATION_ERROR', 'Invalid or expired verification code', [
          { field: 'otp', message: 'Invalid or expired verification code', code: 'INVALID' },
        ]);
      }
      await this.users.save(user);
      await this.mailer.send({
        to: user.email,
        subject: 'Welcome to Zoqo',
        text: `Hi ${user.name}, your email is verified. You can use Zoqo now.`,
      });
      return ok(await issueSession(this.sessions, this.tokens, this.clock, user, input.ip, input.userAgent));
    } catch (error) {
      if (isAuthError(error)) return err(error);
      throw error;
    }
  }
}
