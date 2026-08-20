import { FixedClock, InMemoryMailer } from '@zoqo/shared';
import type { IdentityProviderPort } from '@zoqo/shared';
import { Session } from '../domain/session';
import { User } from '../domain/user';
import { sha256 } from '../domain/crypto';
import { RegisterUserUseCase } from './register-user.usecase';
import { VerifyEmailUseCase } from './verify-email.usecase';
import { LoginUserUseCase } from './login-user.usecase';
import { RefreshSessionUseCase } from './refresh-session.usecase';
import { ForgotPasswordUseCase } from './forgot-password.usecase';
import { ResetPasswordUseCase } from './reset-password.usecase';
import { ListSessionsUseCase, LogoutAllUseCase, LogoutUseCase, RevokeSessionUseCase } from './session.usecases';
import type { PasswordHasherPort } from './ports/password-hasher.port';
import type { TokenPort } from './ports/token.port';
import type { UserStorePort } from './ports/user-store.port';
import type { SessionStorePort } from './ports/session-store.port';
import type { AuditPort, AuditEvent } from './ports/audit.port';

class FakeHasher implements PasswordHasherPort {
  async hash(plain: string): Promise<string> {
    return `h:${plain}`;
  }
  async verify(plain: string, passwordHash: string): Promise<boolean> {
    return passwordHash === `h:${plain}`;
  }
}

class FakeTokens implements TokenPort {
  private n = 0;
  signAccess(userId: string, sessionId: string): string {
    return `a.${userId}.${sessionId}`;
  }
  signRefresh(userId: string, sessionId: string): string {
    this.n += 1;
    return `r.${userId}.${sessionId}.${this.n}`;
  }
  verifyAccess(token: string): { userId: string; sessionId: string } {
    const [, userId, sessionId] = token.split('.');
    return { userId: userId ?? '', sessionId: sessionId ?? '' };
  }
  verifyRefresh(token: string): { userId: string; sessionId: string } {
    const [, userId, sessionId] = token.split('.');
    return { userId: userId ?? '', sessionId: sessionId ?? '' };
  }
}

class MemoryUsers implements UserStorePort {
  private rows: User[] = [];
  async list(): Promise<User[]> {
    return [...this.rows];
  }
  async findById(id: string): Promise<User | null> {
    return this.rows.find((u) => u.id === id) ?? null;
  }
  async findByEmail(email: string): Promise<User | null> {
    return this.rows.find((u) => u.email === email) ?? null;
  }
  async save(user: User): Promise<void> {
    const i = this.rows.findIndex((u) => u.id === user.id);
    if (i >= 0) this.rows[i] = user;
    else this.rows.push(user);
  }
  async clear(): Promise<void> {
    this.rows = [];
  }
}

class MemorySessions implements SessionStorePort {
  private rows: Session[] = [];
  async save(session: Session): Promise<void> {
    const i = this.rows.findIndex((s) => s.id === session.id);
    if (i >= 0) this.rows[i] = session;
    else this.rows.push(session);
  }
  async findById(id: string): Promise<Session | null> {
    return this.rows.find((s) => s.id === id) ?? null;
  }
  async listByUser(userId: string): Promise<Session[]> {
    return this.rows.filter((s) => s.userId === userId);
  }
  async delete(id: string): Promise<void> {
    this.rows = this.rows.filter((s) => s.id !== id);
  }
  async deleteByUser(userId: string): Promise<void> {
    this.rows = this.rows.filter((s) => s.userId !== userId);
  }
  async clear(): Promise<void> {
    this.rows = [];
  }
}

class MemoryAudit implements AuditPort {
  readonly events: AuditEvent[] = [];
  async record(event: AuditEvent): Promise<void> {
    this.events.push(event);
  }
}

describe('auth use cases', () => {
  const clock = new FixedClock(new Date('2026-08-20T12:00:00Z'));
  const hasher = new FakeHasher();
  const otp = { generate: () => '123456' };

  const setup = () => {
    const users = new MemoryUsers();
    const sessions = new MemorySessions();
    const mailer = new InMemoryMailer();
    const tokens = new FakeTokens();
    const audit = new MemoryAudit();
    const idp: IdentityProviderPort = {
      authenticate: async (creds) => {
        const user = await users.findByEmail(creds.email);
        if (!user) return null;
        const ok = await hasher.verify(creds.password, user.passwordHash);
        return ok ? { id: user.id, email: user.email } : null;
      },
    };
    return {
      users,
      sessions,
      mailer,
      tokens,
      audit,
      register: new RegisterUserUseCase(users, hasher, mailer, clock, otp),
      verify: new VerifyEmailUseCase(users, sessions, tokens, mailer, clock),
      login: new LoginUserUseCase(users, sessions, tokens, idp, clock, audit),
      refresh: new RefreshSessionUseCase(users, sessions, tokens, clock),
      forgot: new ForgotPasswordUseCase(users, mailer, clock, 'http://localhost:3000'),
      reset: new ResetPasswordUseCase(users, sessions, hasher, clock),
      listSessions: new ListSessionsUseCase(sessions),
      revoke: new RevokeSessionUseCase(sessions),
      logoutAll: new LogoutAllUseCase(sessions),
      logout: new LogoutUseCase(sessions),
    };
  };

  it('registers, emails OTP, and verifies', async () => {
    const s = setup();
    const registered = await s.register.execute({
      name: 'Sarah Chen',
      email: 'sarah@acme.test',
      password: 'CorrectH0rse!',
    });
    expect(registered.ok).toBe(true);
    if (!registered.ok) return;
    expect(registered.value.user.status).toBe('pending_verification');
    expect(s.mailer.sent[0]?.text).toMatch(/123456/);
    const verified = await s.verify.execute({
      email: 'sarah@acme.test',
      otp: '123456',
      ip: '1.1.1.1',
      userAgent: 'test',
    });
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;
    expect(verified.value.user.status).toBe('active');
    expect(verified.value.organizations).toEqual([]);
  });

  it('rejects duplicates and common passwords', async () => {
    const s = setup();
    await s.register.execute({
      name: 'Sarah Chen',
      email: 'sarah@acme.test',
      password: 'CorrectH0rse!',
    });
    const dup = await s.register.execute({
      name: 'Sarah Chen',
      email: 'sarah@acme.test',
      password: 'CorrectH0rse!',
    });
    expect(dup.ok).toBe(false);
    if (dup.ok) return;
    expect(dup.error.code).toBe('DUPLICATE');
    const weak = await s.register.execute({
      name: 'Sarah Chen',
      email: 'other@acme.test',
      password: 'password',
    });
    expect(weak.ok).toBe(false);
  });

  it('locks after five failed logins', async () => {
    const s = setup();
    await s.register.execute({
      name: 'Sarah Chen',
      email: 'sarah@acme.test',
      password: 'CorrectH0rse!',
    });
    await s.verify.execute({
      email: 'sarah@acme.test',
      otp: '123456',
      ip: '1.1.1.1',
      userAgent: 'test',
    });
    for (let i = 0; i < 5; i += 1) {
      await s.login.execute({
        email: 'sarah@acme.test',
        password: 'WrongPass1!',
        ip: '1.1.1.1',
        userAgent: 'test',
      });
    }
    const locked = await s.login.execute({
      email: 'sarah@acme.test',
      password: 'CorrectH0rse!',
      ip: '1.1.1.1',
      userAgent: 'test',
    });
    expect(locked.ok).toBe(false);
    if (!locked.ok) expect(locked.error.code).toBe('LOCKED');
  });

  it('logs in, rotates refresh, resets password and drops sessions', async () => {
    const s = setup();
    await s.register.execute({
      name: 'Sarah Chen',
      email: 'sarah@acme.test',
      password: 'CorrectH0rse!',
      inviteToken: 'inv',
    });
    const pendingLogin = await s.login.execute({
      email: 'sarah@acme.test',
      password: 'CorrectH0rse!',
      ip: '1.1.1.1',
      userAgent: 'test',
    });
    expect(pendingLogin.ok).toBe(false);
    if (!pendingLogin.ok) expect(pendingLogin.error.code).toBe('UNVERIFIED');

    await s.verify.execute({
      email: 'sarah@acme.test',
      otp: '123456',
      ip: '1.1.1.1',
      userAgent: 'test',
    });
    const login = await s.login.execute({
      email: 'sarah@acme.test',
      password: 'CorrectH0rse!',
      ip: '1.1.1.1',
      userAgent: 'test',
    });
    expect(login.ok).toBe(true);
    if (!login.ok) return;
    expect(s.audit.events.some((e) => e.type === 'login_success')).toBe(true);
    const oldRefresh = login.value.refreshToken;
    const rotated = await s.refresh.execute(oldRefresh);
    expect(rotated.ok).toBe(true);
    const reuse = await s.refresh.execute(oldRefresh);
    expect(reuse.ok).toBe(false);

    const sessions = await s.listSessions.execute(login.value.user.id, login.value.sessionId);
    expect(sessions.length).toBeGreaterThan(0);
    await s.forgot.execute('sarah@acme.test');
    const token = s.mailer.sent.find((m) => m.text.includes('token='))?.text.match(/token=([a-f0-9]+)/)?.[1];
    expect(token).toBeTruthy();
    const same = await s.reset.execute({
      email: 'sarah@acme.test',
      token: token!,
      password: 'CorrectH0rse!',
    });
    expect(same.ok).toBe(false);

    await s.forgot.execute('sarah@acme.test');
    const token2 = [...s.mailer.sent]
      .reverse()
      .find((m) => m.text.includes('token='))
      ?.text.match(/token=([a-f0-9]+)/)?.[1];
    const reset = await s.reset.execute({
      email: 'sarah@acme.test',
      token: token2!,
      password: 'NewHorse9!',
    });
    expect(reset.ok).toBe(true);
    const listed = await s.listSessions.execute(login.value.user.id, login.value.sessionId);
    expect(listed).toHaveLength(0);
    const generic = await s.forgot.execute('nobody@acme.test');
    expect(generic.ok && generic.value.message).toMatch(/If an account exists/);
  });

  it('hashes OTP with sha256', () => {
    expect(sha256('123456')).toHaveLength(64);
  });

  it('revokes and logout-all', async () => {
    const s = setup();
    await s.register.execute({
      name: 'Sarah Chen',
      email: 'sarah@acme.test',
      password: 'CorrectH0rse!',
    });
    const verified = await s.verify.execute({
      email: 'sarah@acme.test',
      otp: '123456',
      ip: '1.1.1.1',
      userAgent: 'test',
    });
    if (!verified.ok) return;
    await s.revoke.execute(verified.value.user.id, 'missing');
    await s.revoke.execute(verified.value.user.id, verified.value.sessionId);
    await s.logout.execute(verified.value.sessionId);
    await s.logoutAll.execute(verified.value.user.id);
  });
});
