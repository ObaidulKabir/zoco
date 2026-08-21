import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import type { SessionStorePort } from '../../application/ports/session-store.port';
import type { UserStorePort } from '../../application/ports/user-store.port';
import { SESSION_STORE, USER_STORE } from '../../identity.tokens';
import { JwtTokenService } from '../security/jwt-token.service';

export type AuthedRequest = Request & {
  userId: string;
  sessionId: string;
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(JwtTokenService) private readonly tokens: JwtTokenService,
    @Inject(USER_STORE) private readonly users: UserStorePort,
    @Inject(SESSION_STORE) private readonly sessions: SessionStorePort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) {
      throw new HttpException(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Missing token' } },
        401,
      );
    }
    try {
      const { userId, sessionId } = this.tokens.verifyAccess(token);
      const session = await this.sessions.findById(sessionId);
      if (!session) {
        throw new HttpException(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid session' } },
          401,
        );
      }
      const user = await this.users.findById(userId);
      if (!user || user.status !== 'active') {
        throw new HttpException(
          { success: false, error: { code: 'UNVERIFIED', message: 'Verify your email before signing in.' } },
          403,
        );
      }
      req.userId = userId;
      req.sessionId = sessionId;
      return true;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } },
        401,
      );
    }
  }
}
