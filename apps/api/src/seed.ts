import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { runMigrations } from './db/migrator';
import { closePool, isPostgresEnabled } from './db/pool';
import { loadRootEnv } from './load-env';
import type { UserStorePort } from './modules/identity/application/ports/user-store.port';
import { USER_STORE } from './modules/identity/identity.tokens';
import { ORG_DIRECTORY } from './modules/org/org.tokens';
import type { OrgDirectoryPort } from './modules/org/application/ports/org-directory.port';
import { BcryptHasher } from './modules/identity/infrastructure/security/bcrypt-hasher';
import { NestSystemClock } from './modules/identity/infrastructure/clock/nest-system-clock';
import { CreateOrganizationUseCase } from './modules/org/application/create-organization.usecase';
import { InviteMembersUseCase } from './modules/org/application/invite.usecases';
import { AcceptInviteUseCase } from './modules/org/application/invite.usecases';
import { UpdateMemberRoleUseCase } from './modules/org/application/members.usecases';
import { User } from './modules/identity/domain/user';
import { newId } from './modules/identity/domain/crypto';

const PASSWORD = 'Zoqo-QA-1!';

const people = [
  { email: 'sarah@acme.test', name: 'Sarah Chen', org: 'Acme', role: 'owner' as const },
  { email: 'admin@acme.test', name: 'Acme Admin', org: 'Acme', role: 'admin' as const },
  { email: 'lee@acme.test', name: 'Lee Manager', org: 'Acme', role: 'manager' as const },
  { email: 'pat@acme.test', name: 'Pat Member', org: 'Acme', role: 'member' as const },
  { email: 'rahim@nodi.test', name: 'Rahim', org: 'Nodi Traders', role: 'owner' as const },
  { email: 'fatima@nodi.test', name: 'Fatima', org: 'Nodi Traders', role: 'member' as const },
];

export async function seed(): Promise<void> {
  loadRootEnv();
  const postgres = isPostgresEnabled();
  if (postgres) await runMigrations();
  const app = await NestFactory.createApplicationContext(AppModule);
  const users = app.get<UserStorePort>(USER_STORE);
  const directory = app.get<OrgDirectoryPort>(ORG_DIRECTORY);
  if (postgres) {
    // Re-runnable: personas are recreated with fresh ids on every seed.
    await directory.clear();
    await users.clear();
  }
  const hasher = app.get(BcryptHasher);
  const clock = app.get(NestSystemClock);
  const createOrg = app.get(CreateOrganizationUseCase);
  const invite = app.get(InviteMembersUseCase);
  const accept = app.get(AcceptInviteUseCase);
  const updateMember = app.get(UpdateMemberRoleUseCase);
  const now = clock.now();
  const hash = await hasher.hash(PASSWORD);
  const ids: Record<string, string> = {};
  for (const person of people) {
    const user = User.create({ id: newId(), email: person.email, name: person.name, passwordHash: hash, now });
    user.status = 'active';
    await users.save(user);
    ids[person.email] = user.id;
  }
  const idOf = (email: string): string => {
    const id = ids[email];
    if (!id) throw new Error(`missing user ${email}`);
    return id;
  };
  const acme = await createOrg.execute({
    userId: idOf('sarah@acme.test'),
    name: 'Acme',
    industry: 'Software',
    size: '11-50',
    country: 'BD',
    timezone: 'Asia/Dhaka',
  });
  const nodi = await createOrg.execute({
    userId: idOf('rahim@nodi.test'),
    name: 'Nodi Traders',
    industry: 'Trading',
    size: '1-10',
    country: 'BD',
    timezone: 'Asia/Dhaka',
  });
  if (!acme.ok || !nodi.ok) {
    throw new Error('seed org create failed');
  }
  const add = async (orgId: string, actorId: string, email: string, role: 'admin' | 'manager' | 'member') => {
    const sent = await invite.execute({ orgId, actorId, emails: [email], role });
    const token = sent.ok ? sent.value.invitations[0]?.token : undefined;
    if (!sent.ok || !token) throw new Error(`invite ${email}`);
    const joined = await accept.execute({ userId: idOf(email), token });
    if (!joined.ok) throw new Error(`accept ${email}`);
    if (role !== 'member') {
      await updateMember.execute({ orgId, actorId, userId: idOf(email), role });
    }
  };
  await add(acme.value.organization.id, idOf('sarah@acme.test'), 'admin@acme.test', 'admin');
  await add(acme.value.organization.id, idOf('sarah@acme.test'), 'lee@acme.test', 'manager');
  await add(acme.value.organization.id, idOf('sarah@acme.test'), 'pat@acme.test', 'member');
  await add(nodi.value.organization.id, idOf('rahim@nodi.test'), 'fatima@nodi.test', 'member');
  // eslint-disable-next-line no-console
  console.log(
    postgres
      ? 'seed: Acme + Nodi Traders with QA personas written to Postgres'
      : 'seed: DATABASE_URL not set, personas exist only in this process',
  );
  await app.close();
  await closePool();
}

if (require.main === module) {
  seed().catch(async (error: Error) => {
    // eslint-disable-next-line no-console
    console.error(error.message);
    await closePool();
    process.exit(1);
  });
}
