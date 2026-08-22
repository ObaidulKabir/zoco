export type B2bErrorCode =
  | 'B2B_SELF_CONNECTION_FORBIDDEN'
  | 'B2B_ALREADY_CONNECTED'
  | 'B2B_CONNECTION_BLOCKED'
  | 'B2B_DAILY_LIMIT_EXCEEDED'
  | 'B2B_NOT_FOUND'
  | 'B2B_UNAUTHORIZED_ACTION'
  | 'B2B_INVALID_INTRO'
  | 'B2B_NOT_CONNECTED';

export class B2bError extends Error {
  constructor(
    readonly code: B2bErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'B2bError';
  }
}
