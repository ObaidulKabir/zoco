import { err, ok, type Result } from '@zoqo/shared';
import type { ClockPort } from '@zoqo/shared';
import { AuthError, authError, isAuthError } from '../domain/auth-error';
import { sha256 } from '../domain/crypto';
import { normalizeEmail, validateEmailFormat, validatePassword } from '../domain/password-policy';
import type { PasswordHasherPort } from './ports/password-hasher.port';
import type { SessionStorePort } from './ports/session-store.port';
import type { UserStorePort } from './ports/user-store.port';

export class ResetPasswordUseCase {
  constructor(
    private readonly users: UserStorePort,
    private readonly sessions: SessionStorePort,
    private readonly hasher: PasswordHasherPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: {
    email: string;
    token: string;
    password: string;
  }): Promise<Result<{ message: string }, AuthError>> {
    try {
      validateEmailFormat(input.email);
      validatePassword(input.password);
      const user = await this.users.findByEmail(normalizeEmail(input.email));
      const now = this.clock.now();
      if (!user || !user.consumePasswordReset(now, sha256(input.token))) {
        throw authError('VALIDATION_ERROR', 'Invalid or expired reset token', [
          { field: 'token', message: 'Invalid or expired reset token', code: 'INVALID' },
        ]);
      }
      for (const old of user.passwordHistory) {
        if (await this.hasher.verify(input.password, old)) {
          throw authError('VALIDATION_ERROR', 'New password must differ from the last 3 passwords', [
            { field: 'password', message: 'New password must differ from the last 3 passwords', code: 'REUSED' },
          ]);
        }
      }
      user.replacePassword(await this.hasher.hash(input.password));
      await this.users.save(user);
      await this.sessions.deleteByUser(user.id);
      return ok({ message: 'Password updated' });
    } catch (error) {
      if (isAuthError(error)) return err(error);
      throw error;
    }
  }
}
