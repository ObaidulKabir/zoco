import { err, ok, type Result } from '@zoqo/shared';
import type { ClockPort, IdentityProviderPort } from '@zoqo/shared';
import { AuthError, authError, isAuthError } from '../domain/auth-error';
import { normalizeEmail, validateEmailFormat } from '../domain/password-policy';
import type { AuditPort } from './ports/audit.port';
import type { SessionStorePort } from './ports/session-store.port';
import type { TokenPort } from './ports/token.port';
import type { UserStorePort } from './ports/user-store.port';
import { issueSession, type AuthSessionBundle } from './issue-session';

const GENERIC = 'Invalid email or password';

export class LoginUserUseCase {
  constructor(
    private readonly users: UserStorePort,
    private readonly sessions: SessionStorePort,
    private readonly tokens: TokenPort,
    private readonly idp: IdentityProviderPort,
    private readonly clock: ClockPort,
    private readonly audit: AuditPort,
  ) {}

  async execute(input: {
    email: string;
    password: string;
    ip: string;
    userAgent: string;
  }): Promise<Result<AuthSessionBundle, AuthError>> {
    try {
      validateEmailFormat(input.email);
      const email = normalizeEmail(input.email);
      const user = await this.users.findByEmail(email);
      const now = this.clock.now();
      if (!user) {
        await this.audit.record({ type: 'login_fail', userId: null, email, ip: input.ip, at: now });
        throw authError('INVALID_CREDENTIALS', GENERIC);
      }
      if (user.isLocked(now)) {
        await this.audit.record({
          type: 'login_fail',
          userId: user.id,
          email,
          ip: input.ip,
          at: now,
          meta: { reason: 'locked' },
        });
        throw authError('LOCKED', 'Account temporarily locked. Try again in 30 minutes.');
      }
      const principal = await this.idp.authenticate({ email, password: input.password });
      if (!principal) {
        user.recordFailedLogin(now);
        await this.users.save(user);
        await this.audit.record({ type: 'login_fail', userId: user.id, email, ip: input.ip, at: now });
        if (user.isLocked(now)) {
          throw authError('LOCKED', 'Account temporarily locked. Try again in 30 minutes.');
        }
        throw authError('INVALID_CREDENTIALS', GENERIC);
      }
      if (user.status === 'pending_verification') {
        throw authError('UNVERIFIED', 'Verify your email before signing in.');
      }
      if (user.status === 'suspended') {
        throw authError('LOCKED', 'Account is suspended.');
      }
      user.recordSuccessfulLogin();
      await this.users.save(user);
      await this.audit.record({ type: 'login_success', userId: user.id, email, ip: input.ip, at: now });
      return ok(await issueSession(this.sessions, this.tokens, this.clock, user, input.ip, input.userAgent));
    } catch (error) {
      if (isAuthError(error)) return err(error);
      throw error;
    }
  }
}
