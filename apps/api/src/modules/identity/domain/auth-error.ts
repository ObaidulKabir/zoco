export class AuthError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details: Array<{ field: string; message: string; code: string }> = [],
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export const authError = (
  code: string,
  message: string,
  details: Array<{ field: string; message: string; code: string }> = [],
): AuthError => new AuthError(code, message, details);

export const isAuthError = (error: unknown): error is AuthError =>
  error instanceof AuthError ||
  (error instanceof Error && error.name === 'AuthError' && 'code' in error);
