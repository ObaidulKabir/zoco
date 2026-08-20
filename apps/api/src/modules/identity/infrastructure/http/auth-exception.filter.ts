import { Catch, type ExceptionFilter, type ArgumentsHost } from '@nestjs/common';
import type { Response } from 'express';
import { isAuthError } from '../../domain/auth-error';
import { httpStatusFor } from './http-status';

@Catch()
export class AuthExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    if (isAuthError(exception)) {
      res.status(httpStatusFor(exception.code)).json({
        success: false,
        error: {
          code: exception.code,
          message: exception.message,
          details: exception.details,
        },
      });
      return;
    }
    const err = exception as { getStatus?: () => number; getResponse?: () => unknown; message?: string };
    if (typeof err.getStatus === 'function' && typeof err.getResponse === 'function') {
      const status = err.getStatus();
      const body = err.getResponse();
      res.status(status).json(typeof body === 'object' ? body : { success: false, error: { message: body } });
      return;
    }
    const message = exception instanceof Error ? exception.message : 'Internal server error';
    res.status(500).json({ success: false, error: { code: 'INTERNAL', message } });
  }
}
