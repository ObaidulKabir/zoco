import { Catch, type ExceptionFilter, type ArgumentsHost } from '@nestjs/common';
import type { Response } from 'express';
import { requestIdOf } from '../../../../request-id';
import { isAuthError } from '../../domain/auth-error';
import { isOrgError } from '../../../org/domain/org-error';
import { httpStatusFor } from './http-status';

type ErrorBody = { success?: boolean; error?: Record<string, unknown> };

const withRequestId = (body: unknown, requestId: string | undefined): unknown => {
  if (!requestId || typeof body !== 'object' || body === null) return body;
  const shaped = body as ErrorBody;
  if (!shaped.error) return body;
  return { ...shaped, error: { ...shaped.error, requestId } };
};

@Catch()
export class AuthExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const res = http.getResponse<Response>();
    const requestId = requestIdOf(http.getRequest());

    if (isAuthError(exception) || isOrgError(exception)) {
      const domain = exception;
      res.status(httpStatusFor(domain.code)).json({
        success: false,
        error: {
          code: domain.code,
          message: domain.message,
          details: domain.details,
          requestId,
        },
      });
      return;
    }

    const err = exception as { getStatus?: () => number; getResponse?: () => unknown; message?: string };
    if (typeof err.getStatus === 'function' && typeof err.getResponse === 'function') {
      const status = err.getStatus();
      const body = err.getResponse();
      res
        .status(status)
        .json(
          typeof body === 'object'
            ? withRequestId(body, requestId)
            : { success: false, error: { message: body, requestId } },
        );
      return;
    }

    const message = exception instanceof Error ? exception.message : 'Internal server error';
    res.status(500).json({ success: false, error: { code: 'INTERNAL', message, requestId } });
  }
}
