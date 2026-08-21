export class OrgError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details: Array<{ field: string; message: string; code: string }> = [],
  ) {
    super(message);
    this.name = 'OrgError';
  }
}

export const orgError = (
  code: string,
  message: string,
  details: Array<{ field: string; message: string; code: string }> = [],
): OrgError => new OrgError(code, message, details);

export const isOrgError = (error: unknown): error is OrgError =>
  error instanceof OrgError ||
  (error instanceof Error && error.name === 'OrgError' && 'code' in error);
