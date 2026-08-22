import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { InMemoryMailer } from '@zoqo/shared';
import { AppModule } from '../../src/app.module';
import { InMemoryAudit } from '../../src/modules/identity/infrastructure/audit/in-memory-audit';
import { AuthRateLimiter } from '../../src/modules/identity/infrastructure/http/auth-rate-limiter';
import { InMemoryInvitationRegistry } from '../../src/modules/identity/infrastructure/persistence/in-memory-invitation-registry';
import { InMemorySessionStore } from '../../src/modules/identity/infrastructure/persistence/in-memory-session-store';
import { InMemoryUserStore } from '../../src/modules/identity/infrastructure/persistence/in-memory-user-store';
import {
  AUDIT,
  INVITATION_REGISTRY,
  MAILER,
  SESSION_STORE,
  USER_STORE,
} from '../../src/modules/identity/identity.tokens';
import { InMemoryOrgDirectory } from '../../src/modules/org/infrastructure/persistence/in-memory-org-directory';
import { ORG_DIRECTORY } from '../../src/modules/org/org.tokens';
import { InMemoryMessengerStore } from '../../src/modules/messenger/infrastructure/persistence/in-memory-messenger-store';
import { InMemoryRealtimeNotifier } from '../../src/modules/messenger/infrastructure/realtime/in-memory-realtime-notifier';
import { MESSENGER_STORE, REALTIME_NOTIFIER } from '../../src/modules/messenger/messenger.tokens';
import { InMemoryChannelStore } from '../../src/modules/channels/infrastructure/persistence/in-memory-channel-store';
import { CHANNEL_STORE } from '../../src/modules/channels/channels.tokens';
import { InMemoryMediaStore } from '../../src/modules/media/infrastructure/persistence/in-memory-media-store';
import { InMemoryStorageAdapter } from '../../src/modules/media/infrastructure/storage/in-memory-storage.adapter';
import { InMemoryScannerAdapter } from '../../src/modules/media/infrastructure/scanner/in-memory-scanner.adapter';
import { MEDIA_STORE, STORAGE_ADAPTER, VIRUS_SCANNER } from '../../src/modules/media/media.tokens';
import { InMemoryB2bStore } from '../../src/modules/b2b/infrastructure/persistence/in-memory-b2b-store';
import { B2B_STORE } from '../../src/modules/b2b/b2b.tokens';

export type Harness = {
  app: INestApplication;
  mailer: InMemoryMailer;
  users: InMemoryUserStore;
  sessions: InMemorySessionStore;
  audit: InMemoryAudit;
  orgs: InMemoryOrgDirectory;
  invitations: InMemoryInvitationRegistry;
  messenger: InMemoryMessengerStore;
  notifier: InMemoryRealtimeNotifier;
  channels: InMemoryChannelStore;
  media: InMemoryMediaStore;
  storage: InMemoryStorageAdapter;
  scanner: InMemoryScannerAdapter;
  b2b: InMemoryB2bStore;
  rateLimiter: AuthRateLimiter;
};

/** Scenarios drive many auth calls per run, so the spec limit is opted into per scenario. */
const RELAXED_AUTH_RATE_LIMIT = '10000';

let harness: Harness | null = null;

export const getHarness = async (): Promise<Harness> => {
  if (harness) return harness;
  process.env.BCRYPT_ROUNDS = process.env.BCRYPT_ROUNDS ?? '4';
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'bdd-secret';
  process.env.MAILER_DRIVER = 'memory';
  process.env.PERSISTENCE = 'memory';
  process.env.AUTH_RATE_LIMIT = RELAXED_AUTH_RATE_LIMIT;
  const mailer = new InMemoryMailer();
  const notifier = new InMemoryRealtimeNotifier();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MAILER)
    .useValue(mailer)
    .overrideProvider(REALTIME_NOTIFIER)
    .useValue(notifier)
    .compile();
  const app = moduleRef.createNestApplication();
  app.useLogger(false);
  await app.init();
  harness = {
    app,
    mailer,
    users: moduleRef.get<InMemoryUserStore>(USER_STORE),
    sessions: moduleRef.get<InMemorySessionStore>(SESSION_STORE),
    audit: moduleRef.get<InMemoryAudit>(AUDIT),
    orgs: moduleRef.get<InMemoryOrgDirectory>(ORG_DIRECTORY),
    invitations: moduleRef.get<InMemoryInvitationRegistry>(INVITATION_REGISTRY),
    messenger: moduleRef.get<InMemoryMessengerStore>(MESSENGER_STORE),
    notifier,
    channels: moduleRef.get<InMemoryChannelStore>(CHANNEL_STORE),
    media: moduleRef.get<InMemoryMediaStore>(MEDIA_STORE),
    storage: moduleRef.get<InMemoryStorageAdapter>(STORAGE_ADAPTER),
    scanner: moduleRef.get<InMemoryScannerAdapter>(VIRUS_SCANNER),
    b2b: moduleRef.get<InMemoryB2bStore>(B2B_STORE),
    rateLimiter: moduleRef.get(AuthRateLimiter),
  };
  return harness;
};

export const resetHarness = async (): Promise<Harness> => {
  process.env.AUTH_RATE_LIMIT = RELAXED_AUTH_RATE_LIMIT;
  const h = await getHarness();
  await h.users.clear();
  await h.sessions.clear();
  await h.orgs.clear();
  await h.invitations.clear();
  await h.messenger.clear();
  await h.notifier.clear();
  await h.audit.clear();
  await h.channels.clear();
  await h.media.clear();
  await h.b2b.clear();
  h.mailer.sent.length = 0;
  h.rateLimiter.clear();
  return h;
};

export const closeHarness = async (): Promise<void> => {
  if (harness) {
    const h = harness;
    harness = null;
    try {
      const server = h.app.getHttpServer();
      if (server && typeof server.close === 'function') {
        server.close();
      }
      await Promise.race([
        h.app.close(),
        new Promise((resolve) => setTimeout(resolve, 500)),
      ]);
    } catch {}
  }
};
