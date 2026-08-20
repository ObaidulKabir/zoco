import type { ClockPort } from '@zoqo/shared';
import { Session } from '../domain/session';
import { newId, sha256 } from '../domain/crypto';
import type { User } from '../domain/user';
import type { SessionStorePort } from './ports/session-store.port';
import type { TokenPort } from './ports/token.port';

export type AuthSessionBundle = {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  user: ReturnType<User['toPublic']>;
  organizations: [];
};

export const issueSession = async (
  sessions: SessionStorePort,
  tokens: TokenPort,
  clock: ClockPort,
  user: User,
  ip: string,
  userAgent: string,
): Promise<AuthSessionBundle> => {
  const now = clock.now();
  const session = new Session(
    newId(),
    user.id,
    '',
    userAgent,
    ip,
    now,
    now,
    new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
  );
  const refreshToken = tokens.signRefresh(user.id, session.id);
  session.refreshTokenHash = sha256(refreshToken);
  await sessions.save(session);
  return {
    accessToken: tokens.signAccess(user.id, session.id),
    refreshToken,
    sessionId: session.id,
    user: user.toPublic(),
    organizations: [],
  };
};
