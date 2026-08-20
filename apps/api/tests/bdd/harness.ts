import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { InMemoryMailer } from '@zoqo/shared';
import { AppModule } from '../../src/app.module';
import { InMemoryAudit } from '../../src/modules/identity/infrastructure/audit/in-memory-audit';
import { InMemorySessionStore } from '../../src/modules/identity/infrastructure/persistence/in-memory-session-store';
import { InMemoryUserStore } from '../../src/modules/identity/infrastructure/persistence/in-memory-user-store';
import { MAILER } from '../../src/modules/identity/identity.tokens';

export type Harness = {
  app: INestApplication;
  mailer: InMemoryMailer;
  users: InMemoryUserStore;
  sessions: InMemorySessionStore;
  audit: InMemoryAudit;
};

let harness: Harness | null = null;

export const getHarness = async (): Promise<Harness> => {
  if (harness) return harness;
  process.env.BCRYPT_ROUNDS = process.env.BCRYPT_ROUNDS ?? '4';
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'bdd-secret';
  process.env.MAILER_DRIVER = 'memory';
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
    users: moduleRef.get(InMemoryUserStore),
    sessions: moduleRef.get(InMemorySessionStore),
    audit: moduleRef.get(InMemoryAudit),
  };
  return harness;
};

export const resetHarness = async (): Promise<Harness> => {
  const h = await getHarness();
  await h.users.clear();
  await h.sessions.clear();
  h.audit.clear();
  h.mailer.sent.length = 0;
  return h;
};

export const closeHarness = async (): Promise<void> => {
  if (!harness) return;
  await harness.app.close();
  harness = null;
};
