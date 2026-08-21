export const MAILER = 'ZOQO_MAILER';
export const CLOCK = 'ZOQO_CLOCK';

/**
 * Persistence is injected by token, not by concrete class, so the same use cases
 * run against Postgres in production and the in-memory fakes in tests.
 */
export const USER_STORE = 'ZOQO_USER_STORE';
export const SESSION_STORE = 'ZOQO_SESSION_STORE';
export const INVITATION_REGISTRY = 'ZOQO_INVITATION_REGISTRY';
export const AUDIT = 'ZOQO_AUDIT';
