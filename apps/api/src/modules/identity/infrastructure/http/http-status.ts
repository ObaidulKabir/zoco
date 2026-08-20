export const httpStatusFor = (code: string): number => {
  switch (code) {
    case 'VALIDATION_ERROR':
      return 400;
    case 'INVALID_CREDENTIALS':
    case 'UNAUTHORIZED':
      return 401;
    case 'UNVERIFIED':
    case 'LOCKED':
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
