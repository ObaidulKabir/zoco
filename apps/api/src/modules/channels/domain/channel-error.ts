export type ChannelErrorCode =
  | 'CHANNEL_NOT_FOUND'
  | 'CHANNEL_ACCESS_DENIED'
  | 'CHANNEL_ALREADY_EXISTS'
  | 'ANNOUNCEMENT_POST_RESTRICTED'
  | 'CHANNEL_ARCHIVED'
  | 'INVALID_CHANNEL_NAME'
  | 'PERMISSION_DENIED'
  | 'MESSAGE_NOT_FOUND'
  | 'NOT_CHANNEL_MEMBER'
  | 'SHARED_ORG_NOT_CONNECTED'
  | 'VALIDATION_ERROR';

export class ChannelError extends Error {
  constructor(
    public readonly code: ChannelErrorCode,
    message: string,
    public readonly details?: Array<{ field?: string; message: string; code?: string }>,
  ) {
    super(message);
    this.name = 'ChannelError';
  }
}
