import { err, ok, type Result } from '@zoqo/shared';
import type { ClockPort } from '@zoqo/shared';
import { AuthError, authError, isAuthError } from '../domain/auth-error';
import { sha256 } from '../domain/crypto';
import type { SessionStorePort } from './ports/session-store.port';
import type { TokenPort } from './ports/token.port';
import type { UserStorePort } from './ports/user-store.port';
import type { AuthSessionBundle } from './issue-session';

export class RefreshSessionUseCase {
  constructor(
    private readonly users: UserStorePort,
    private readonly sessions: SessionStorePort,
    private readonly tokens: TokenPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(refreshToken: string): Promise<Result<AuthSessionBundle, AuthError>> {
    try {
      let payload: { userId: string; sessionId: string };
      try {
        payload = this.tokens.verifyRefresh(refreshToken);
      } catch {
        throw authError('UNAUTHORIZED', 'Invalid refresh token');
      }
      const session = await this.sessions.findById(payload.sessionId);
      if (!session || session.refreshTokenHash !== sha256(refreshToken)) {
        throw authError('UNAUTHORIZED', 'Invalid refresh token');
      }
      const now = this.clock.now();
      if (session.expiresAt.getTime() < now.getTime()) {
        await this.sessions.delete(session.id);
        throw authError('UNAUTHORIZED', 'Invalid refresh token');
      }
      const user = await this.users.findById(session.userId);
      if (!user || user.status !== 'active') {
        throw authError('UNAUTHORIZED', 'Invalid refresh token');
      }
      const nextRefresh = this.tokens.signRefresh(user.id, session.id);
      session.refreshTokenHash = sha256(nextRefresh);
      session.touch(now);
      await this.sessions.save(session);
      return ok({
        accessToken: this.tokens.signAccess(user.id, session.id),
        refreshToken: nextRefresh,
        sessionId: session.id,
        user: user.toPublic(),
        organizations: [],
      });
    } catch (error) {
      if (isAuthError(error)) return err(error);
      throw error;
    }
  }
}
