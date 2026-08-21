export type MediaErrorCode =
  | 'FILE_NOT_FOUND'
  | 'FILE_QUARANTINED'
  | 'FILE_TOO_LARGE'
  | 'INVALID_FILE_TYPE'
  | 'UPLOAD_FAILED'
  | 'UNAUTHORIZED'
  | 'PERMISSION_DENIED';

export class MediaError extends Error {
  constructor(
    public readonly code: MediaErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'MediaError';
  }
}
