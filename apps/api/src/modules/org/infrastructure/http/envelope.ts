import { HttpException } from '@nestjs/common';
import type { Result } from '@zoqo/shared';
import type { OrgError } from '../../domain/org-error';

export const httpStatusForOrg = (code: string): number => {
  switch (code) {
    case 'VALIDATION_ERROR':
      return 400;
    case 'UNAUTHORIZED':
      return 401;
    case 'FORBIDDEN':
      return 403;
    case 'NOT_FOUND':
      return 404;
    case 'DUPLICATE':
      return 409;
    case 'NOT_IMPLEMENTED':
      return 501;
    default:
      return 400;
  }
};

export const unwrapOrg = <T>(result: Result<T, OrgError>): T => {
  if (result.ok) return result.value;
  throw new HttpException(
    {
      success: false,
      error: { code: result.error.code, message: result.error.message, details: result.error.details },
    },
    httpStatusForOrg(result.error.code),
  );
};
