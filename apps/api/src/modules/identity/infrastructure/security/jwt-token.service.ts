import { Injectable } from '@nestjs/common';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { newId } from '../../domain/crypto';
import type { TokenPort } from '../../application/ports/token.port';

type Claims = { sub: string; sid: string; typ: 'access' | 'refresh'; jti?: string };

@Injectable()
export class JwtTokenService implements TokenPort {
  private readonly secret = process.env.JWT_SECRET ?? 'dev-only-change-me';

  signAccess(userId: string, sessionId: string): string {
    const options: SignOptions = { expiresIn: '15m' };
    return jwt.sign({ sub: userId, sid: sessionId, typ: 'access' } satisfies Claims, this.secret, options);
  }

  signRefresh(userId: string, sessionId: string): string {
    const options: SignOptions = { expiresIn: '30d' };
    return jwt.sign(
      { sub: userId, sid: sessionId, typ: 'refresh', jti: newId() } satisfies Claims,
      this.secret,
      options,
    );
  }

  verifyAccess(token: string): { userId: string; sessionId: string } {
    const payload = jwt.verify(token, this.secret) as Claims;
    if (payload.typ !== 'access') throw new Error('wrong_token_type');
    return { userId: payload.sub, sessionId: payload.sid };
  }

  verifyRefresh(token: string): { userId: string; sessionId: string } {
    const payload = jwt.verify(token, this.secret) as Claims;
    if (payload.typ !== 'refresh') throw new Error('wrong_token_type');
    return { userId: payload.sub, sessionId: payload.sid };
  }
}
