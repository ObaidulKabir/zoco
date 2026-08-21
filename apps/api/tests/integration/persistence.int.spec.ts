import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { runMigrations } from '../../src/db/migrator';
import { closePool, query, withTenant } from '../../src/db/pool';
import { User } from '../../src/modules/identity/domain/user';
import { Session } from '../../src/modules/identity/domain/session';
import { PgInvitationRegistry } from '../../src/modules/identity/infrastructure/persistence/pg-invitation-registry';
import { PgSessionStore } from '../../src/modules/identity/infrastructure/persistence/pg-session-store';
import { PgUserStore } from '../../src/modules/identity/infrastructure/persistence/pg-user-store';
import { PgAudit } from '../../src/modules/identity/infrastructure/audit/pg-audit';
import { Membership } from '../../src/modules/org/domain/membership';
import { Organization } from '../../src/modules/org/domain/organization';
import { PgOrgDirectory } from '../../src/modules/org/infrastructure/persistence/pg-org-directory';

/**
 * Runs only when a throwaway Postgres is reachable. CI always provides one, so
 * this suite is never silently skipped where it matters.
 */
const adminUrl = process.env.TEST_DATABASE_URL;
if (!adminUrl && process.env.CI) {
  throw new Error('TEST_DATABASE_URL is required in CI: tenant isolation must never go unproven');
}
const describeIfPostgres = adminUrl ? describe : describe.skip;

const APP_ROLE = 'zoqo_app';

/**
 * TEST_DATABASE_URL points at the admin role that owns the container. The suite
 * connects as a non-superuser instead, because that is the only way the RLS
 * policies are actually in force -- exactly as production is configured.
 */
const appUrlFrom = (admin: string): string => {
  const url = new URL(admin);
  url.username = APP_ROLE;
  url.password = APP_ROLE;
  return url.toString();
};

async function createAppRole(admin: string): Promise<void> {
  const client = new Client({ connectionString: admin });
  await client.connect();
  try {
    await client.query(`
      do $$
      begin
        if not exists (select 1 from pg_roles where rolname = '${APP_ROLE}') then
          create role ${APP_ROLE} login password '${APP_ROLE}'
            nosuperuser nocreatedb nocreaterole nobypassrls;
        end if;
      end
      $$;
    `);
    await client.query(`grant create, usage on schema public to ${APP_ROLE}`);
  } finally {
    await client.end();
  }
}

const org = (name: string, slug: string, now: Date): Organization =>
  new Organization(
    randomUUID(),
    name,
    slug,
    'Software',
    '11-50',
    'BD',
    'Asia/Dhaka',
    null,
    Organization.defaults('Asia/Dhaka'),
    now,
  );

describeIfPostgres('postgres persistence (int)', () => {
  const now = new Date('2026-03-01T10:00:00.000Z');
  const users = new PgUserStore();
  const sessions = new PgSessionStore();
  const invitations = new PgInvitationRegistry();
  const directory = new PgOrgDirectory();
  const audit = new PgAudit();

  beforeAll(async () => {
    const admin = adminUrl as string;
    await createAppRole(admin);
    process.env.DATABASE_URL = appUrlFrom(admin);
    process.env.PERSISTENCE = 'postgres';
    await runMigrations();
  }, 60000);

  beforeEach(async () => {
    await query('truncate organizations, users, invite_email_tokens, audit_log cascade');
  });

  afterAll(async () => {
    await closePool();
  });

  it('ORG-AUTH-001: a registered user survives the process that created it', async () => {
    const user = User.create({
      id: randomUUID(),
      email: 'sarah@acme.test',
      name: 'Sarah Chen',
      passwordHash: 'hash-1',
      now,
    });
    user.setEmailOtp('otp-hash', new Date(now.getTime() + 600000));
    user.recordFailedLogin(now);
    await users.save(user);

    // A second store stands in for a restarted API process.
    const found = await new PgUserStore().findByEmail('sarah@acme.test');

    expect(found).not.toBeNull();
    expect(found?.name).toBe('Sarah Chen');
    expect(found?.status).toBe('pending_verification');
    expect(found?.emailOtpHash).toBe('otp-hash');
    expect(found?.passwordHistory).toEqual(['hash-1']);
    expect(found?.failedAt).toHaveLength(1);
  });

  it('ORG-AUTH-004: sessions round-trip and revoking all of a user clears them', async () => {
    const user = User.create({ id: randomUUID(), email: 'lee@acme.test', name: 'Lee', passwordHash: 'h', now });
    await users.save(user);
    const session = new Session(
      randomUUID(),
      user.id,
      'refresh-hash',
      'Firefox',
      '10.0.0.1',
      now,
      now,
      new Date(now.getTime() + 86400000),
    );
    await sessions.save(session);

    expect(await sessions.listByUser(user.id)).toHaveLength(1);
    session.touch(new Date(now.getTime() + 60000));
    await sessions.save(session);
    expect((await sessions.findById(session.id))?.lastActiveAt.toISOString()).toBe(
      new Date(now.getTime() + 60000).toISOString(),
    );

    await sessions.deleteByUser(user.id);
    expect(await sessions.listByUser(user.id)).toHaveLength(0);
  });

  it('ORG-AUTH-001: the invite projection survives a restart so invited users still see their code', async () => {
    const expiresAt = new Date(now.getTime() + 86400000);
    await invitations.record('token-hash-1', { email: 'pat@acme.test', expiresAt });

    const found = await new PgInvitationRegistry().findByTokenHash('token-hash-1');

    expect(found?.email).toBe('pat@acme.test');
    expect(found?.expiresAt.toISOString()).toBe(expiresAt.toISOString());
    expect(await invitations.findByTokenHash('forged')).toBeNull();
  });

  it('SHIELD-CORE-002: audit events are appended to audit_log', async () => {
    await audit.record({
      type: 'login.failed',
      userId: null,
      email: 'nobody@acme.test',
      ip: '10.0.0.9',
      at: now,
      meta: { reason: 'bad_password' },
    });

    const rows = await query<{ type: string; meta: { reason: string } }>('select type, meta from audit_log');

    expect(rows).toHaveLength(1);
    expect(rows[0]?.type).toBe('login.failed');
    expect(rows[0]?.meta.reason).toBe('bad_password');
  });

  it('ORG-PROF-001: organizations and memberships round-trip through the directory', async () => {
    const acme = org('Acme', 'acme', now);
    const owner = User.create({ id: randomUUID(), email: 'sarah@acme.test', name: 'Sarah', passwordHash: 'h', now });
    await users.save(owner);
    await directory.saveOrg(acme);
    await directory.saveMembership(
      new Membership(randomUUID(), acme.id, owner.id, owner.email, 'owner', null, null, now),
    );

    const reloaded = await new PgOrgDirectory().findOrgBySlug('acme');
    expect(reloaded?.name).toBe('Acme');
    expect(reloaded?.settings.invitationPolicy).toBe('admins_only');
    expect(await directory.countMemberships(acme.id)).toBe(1);
    expect(await directory.listOrgsForUser(owner.id)).toHaveLength(1);
  });

  describe('SYS-SEC-004 tenant isolation', () => {
    let acmeId: string;
    let nodiId: string;

    beforeEach(async () => {
      const acme = org('Acme', 'acme', now);
      const nodi = org('Nodi Traders', 'nodi-traders', now);
      acmeId = acme.id;
      nodiId = nodi.id;
      await directory.saveOrg(acme);
      await directory.saveOrg(nodi);

      for (const [orgId, email] of [
        [acme.id, 'sarah@acme.test'],
        [acme.id, 'lee@acme.test'],
        [nodi.id, 'rahim@nodi.test'],
      ] as const) {
        const user = User.create({ id: randomUUID(), email, name: email, passwordHash: 'h', now });
        await users.save(user);
        await directory.saveMembership(
          new Membership(randomUUID(), orgId, user.id, email, 'member', null, null, now),
        );
      }
    });

    it('with app.tenant_id set to Acme, a query for Nodi rows returns zero', async () => {
      const nodiRowsSeenByAcme = await withTenant(acmeId, async (client) => {
        const { rows } = await client.query<{ count: string }>(
          'select count(*)::text as count from org_members where org_id = $1',
          [nodiId],
        );
        return Number(rows[0]?.count);
      });

      expect(nodiRowsSeenByAcme).toBe(0);
    });

    it('an unfiltered select inside a tenant sees only that tenant', async () => {
      const seenByAcme = await withTenant(acmeId, async (client) => {
        const { rows } = await client.query<{ org_id: string }>('select org_id from org_members');
        return rows.map((r) => r.org_id);
      });

      expect(seenByAcme).toHaveLength(2);
      expect(new Set(seenByAcme)).toEqual(new Set([acmeId]));
    });

    it('the organizations table is scoped too', async () => {
      const seenByNodi = await withTenant(nodiId, async (client) => {
        const { rows } = await client.query<{ slug: string }>('select slug from organizations');
        return rows.map((r) => r.slug);
      });

      expect(seenByNodi).toEqual(['nodi-traders']);
    });
  });
});
