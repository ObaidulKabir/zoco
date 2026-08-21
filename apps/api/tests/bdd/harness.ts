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
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MAILER)
    .useValue(mailer)
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
    notifier: moduleRef.get<InMemoryRealtimeNotifier>(REALTIME_NOTIFIER),
    channels: moduleRef.get<InMemoryChannelStore>(CHANNEL_STORE),
    media: moduleRef.get<InMemoryMediaStore>(MEDIA_STORE),
    storage: moduleRef.get<InMemoryStorageAdapter>(STORAGE_ADAPTER),
    scanner: moduleRef.get<InMemoryScannerAdapter>(VIRUS_SCANNER),
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
  h.rateLimiter.clear();
  return h;
};

export const closeHarness = async (): Promise<void> => {
  if (harness) {
    try {
      const server = harness.app.getHttpServer();
      if (server && typeof server.close === 'function') {
        server.close();
      }
      await harness.app.close();
    } catch {}
    harness = null;
  }
};
