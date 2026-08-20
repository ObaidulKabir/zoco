import { err, ok, type Result } from '@zoqo/shared';
import { AuthError, authError } from '../domain/auth-error';
import type { SessionStorePort } from './ports/session-store.port';

export class LogoutUseCase {
  constructor(private readonly sessions: SessionStorePort) {}

  async execute(sessionId: string): Promise<Result<void, AuthError>> {
    const session = await this.sessions.findById(sessionId);
    if (!session) return err(authError('UNAUTHORIZED', 'Invalid session'));
    await this.sessions.delete(sessionId);
    return ok(undefined);
  }
}

export class LogoutAllUseCase {
  constructor(private readonly sessions: SessionStorePort) {}

  async execute(userId: string): Promise<Result<void, AuthError>> {
    await this.sessions.deleteByUser(userId);
    return ok(undefined);
  }
}

export class ListSessionsUseCase {
  constructor(private readonly sessions: SessionStorePort) {}

  async execute(userId: string, currentSessionId: string) {
    const list = await this.sessions.listByUser(userId);
    return list.map((s) => s.toPublic(currentSessionId));
  }
}

export class RevokeSessionUseCase {
  constructor(private readonly sessions: SessionStorePort) {}

  async execute(userId: string, sessionId: string): Promise<Result<void, AuthError>> {
    const session = await this.sessions.findById(sessionId);
    if (!session || session.userId !== userId) {
      return err(authError('NOT_FOUND', 'Session not found'));
    }
    await this.sessions.delete(sessionId);
    return ok(undefined);
  }
}
