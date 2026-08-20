export { ok, err, type Result } from './result.js';
export {
  emptyTenantContext,
  getTenantContext,
  requireTenantId,
  runWithTenant,
  type TenantContext,
} from './tenant-context.js';
export { tenantRlsSessionSql } from './rls.js';
export type { MailerPort, OutboundMail, MailReceipt } from './ports/mailer.port.js';
export type { ObjectStoragePort, StoredObject } from './ports/object-storage.port.js';
export type { PushPort, PushMessage } from './ports/push.port.js';
export type { SearchPort, SearchHit } from './ports/search.port.js';
export type { IdentityProviderPort, LocalCredentials, AuthUser } from './ports/identity-provider.port.js';
export type { TranslationPort, DetectResult } from './ports/translation.port.js';
export type { EventBusPort, DomainEvent } from './ports/event-bus.port.js';
export type { ClockPort } from './ports/clock.port.js';
export { InMemoryMailer } from './fakes/in-memory-mailer.js';
export { InMemoryObjectStorage } from './fakes/in-memory-object-storage.js';
export { InMemoryPush } from './fakes/in-memory-push.js';
export { InMemorySearch } from './fakes/in-memory-search.js';
export { InMemoryIdentityProvider } from './fakes/in-memory-identity-provider.js';
export { InMemoryTranslation } from './fakes/in-memory-translation.js';
export { InMemoryEventBus } from './fakes/in-memory-event-bus.js';
export { FixedClock, SystemClock } from './fakes/clock.js';
