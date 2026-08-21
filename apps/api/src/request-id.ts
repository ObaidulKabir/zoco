import { randomBytes } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export type RequestWithId = Request & { requestId?: string };

export const newRequestId = (): string => `req_${randomBytes(6).toString('hex')}`;

export const requestIdOf = (req: unknown): string | undefined => (req as RequestWithId | undefined)?.requestId;

export function requestIdMiddleware(req: RequestWithId, res: Response, next: NextFunction): void {
  const incoming = req.headers['x-request-id'];
  req.requestId = typeof incoming === 'string' && incoming ? incoming : newRequestId();
  res.setHeader('X-Request-Id', req.requestId);
  next();
}
