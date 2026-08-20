import { ok, type Result } from '@zoqo/shared';
import type { ClockPort, MailerPort } from '@zoqo/shared';
import type { AuthError } from '../domain/auth-error';
import { randomToken, sha256 } from '../domain/crypto';
import { normalizeEmail } from '../domain/password-policy';
import type { UserStorePort } from './ports/user-store.port';

export const RESET_GENERIC = 'If an account exists for that email, a reset link has been sent.';

export class ForgotPasswordUseCase {
  constructor(
    private readonly users: UserStorePort,
    private readonly mailer: MailerPort,
    private readonly clock: ClockPort,
    private readonly webUrl: string,
  ) {}

  async execute(email: string): Promise<Result<{ message: string }, AuthError>> {
    const user = await this.users.findByEmail(normalizeEmail(email));
    if (user) {
      const token = randomToken();
      const now = this.clock.now();
      user.setPasswordReset(sha256(token), new Date(now.getTime() + 60 * 60 * 1000));
      await this.users.save(user);
      await this.mailer.send({
        to: user.email,
        subject: 'Reset your Zoqo password',
        text: `Reset your password: ${this.webUrl}/reset?token=${token}&email=${encodeURIComponent(user.email)}`,
      });
    }
    return ok({ message: RESET_GENERIC });
  }
}
