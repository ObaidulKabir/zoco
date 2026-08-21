import { CanActivate, ExecutionContext, HttpException, Inject, Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthRateLimiter } from './auth-rate-limiter';

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  constructor(@Inject(AuthRateLimiter) private readonly limiter: AuthRateLimiter) {}

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const decision = this.limiter.hit(`${ip}:auth`);

    res.setHeader('X-RateLimit-Limit', decision.limit);
    res.setHeader('X-RateLimit-Remaining', decision.remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(decision.resetAt / 1000));

    if (!decision.allowed) {
      res.setHeader('Retry-After', Math.max(1, Math.ceil((decision.resetAt - Date.now()) / 1000)));
      throw new HttpException(
        {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many attempts. Please try again later.',
          },
        },
        429,
      );
    }
    return true;
  }
}
