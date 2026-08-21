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

export type Harness = {
  app: INestApplication;
  mailer: InMemoryMailer;
  users: InMemoryUserStore;
  sessions: InMemorySessionStore;
  audit: InMemoryAudit;
  orgs: InMemoryOrgDirectory;
  invitations: InMemoryInvitationRegistry;
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
    rateLimiter: moduleRef.get(AuthRateLimiter),
  };
  return harness;
};

export const resetHarness = async (): Promise<Harness> => {
  const h = await getHarness();
  await h.users.clear();
  await h.sessions.clear();
  await h.orgs.clear();
  await h.invitations.clear();
  h.audit.clear();
  h.mailer.sent.length = 0;
  h.rateLimiter.clear();
  process.env.AUTH_RATE_LIMIT = RELAXED_AUTH_RATE_LIMIT;
  return h;
};

export const closeHarness = async (): Promise<void> => {
  if (!harness) return;
  await harness.app.close();
  harness = null;
};
