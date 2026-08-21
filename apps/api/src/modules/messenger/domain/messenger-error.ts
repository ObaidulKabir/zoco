export class MessengerError extends Error {
  constructor(
    public readonly code:
      | 'CONVERSATION_NOT_FOUND'
      | 'MESSAGE_NOT_FOUND'
      | 'EDIT_WINDOW_EXPIRED'
      | 'NOT_PARTICIPANT'
      | 'PERMISSION_DENIED'
      | 'CROSS_TENANT_FORBIDDEN'
      | 'PREKEY_NOT_FOUND'
      | 'VALIDATION_ERROR',
    message: string,
  ) {
    super(message);
    this.name = 'MessengerError';
  }
}
