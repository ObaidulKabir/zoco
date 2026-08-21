import { Module } from '@nestjs/common';
import { InMemoryMailer, type MailerPort } from '@zoqo/shared';
import { isPostgresEnabled } from '../../db/pool';
import { ListUsersUseCase } from './application/list-users.usecase';
import { ForgotPasswordUseCase } from './application/forgot-password.usecase';
import { LoginUserUseCase } from './application/login-user.usecase';
import { RefreshSessionUseCase } from './application/refresh-session.usecase';
import { RegisterUserUseCase } from './application/register-user.usecase';
import { ResetPasswordUseCase } from './application/reset-password.usecase';
import {
  ListSessionsUseCase,
  LogoutAllUseCase,
  LogoutUseCase,
  RevokeSessionUseCase,
} from './application/session.usecases';
import { VerifyEmailUseCase } from './application/verify-email.usecase';
import type { AuditPort } from './application/ports/audit.port';
import type { InvitationRegistryPort } from './application/ports/invitation-lookup.port';
import type { SessionStorePort } from './application/ports/session-store.port';
import type { UserStorePort } from './application/ports/user-store.port';
import { InMemoryAudit } from './infrastructure/audit/in-memory-audit';
import { PgAudit } from './infrastructure/audit/pg-audit';
import { NestSystemClock } from './infrastructure/clock/nest-system-clock';
import { AuthController } from './infrastructure/http/auth.controller';
import { AuthGuard } from './infrastructure/http/auth.guard';
import { AuthRateLimitGuard } from './infrastructure/http/auth-rate-limit.guard';
import { AuthRateLimiter } from './infrastructure/http/auth-rate-limiter';
import { IdentityController } from './infrastructure/http/identity.controller';
import { SmtpMailer } from './infrastructure/mail/smtp-mailer';
import { AUDIT, INVITATION_REGISTRY, MAILER, SESSION_STORE, USER_STORE } from './identity.tokens';
import { InMemoryInvitationRegistry } from './infrastructure/persistence/in-memory-invitation-registry';
import { InMemorySessionStore } from './infrastructure/persistence/in-memory-session-store';
import { InMemoryUserStore } from './infrastructure/persistence/in-memory-user-store';
import { PgInvitationRegistry } from './infrastructure/persistence/pg-invitation-registry';
import { PgSessionStore } from './infrastructure/persistence/pg-session-store';
import { PgUserStore } from './infrastructure/persistence/pg-user-store';
import { BcryptHasher } from './infrastructure/security/bcrypt-hasher';
import { CryptoOtp } from './infrastructure/security/crypto-otp';
import { JwtTokenService } from './infrastructure/security/jwt-token.service';
import { LocalIdentityProvider } from './infrastructure/security/local-identity-provider';

const mailerFactory = (): MailerPort =>
  process.env.MAILER_DRIVER === 'smtp' ? new SmtpMailer() : new InMemoryMailer();

@Module({
  controllers: [IdentityController, AuthController],
  providers: [
    AuthRateLimiter,
    AuthRateLimitGuard,
    BcryptHasher,
    JwtTokenService,
    CryptoOtp,
    NestSystemClock,
    LocalIdentityProvider,
    AuthGuard,
    { provide: MAILER, useFactory: mailerFactory },
    {
      provide: USER_STORE,
      useFactory: (): UserStorePort => (isPostgresEnabled() ? new PgUserStore() : new InMemoryUserStore()),
    },
    {
      provide: SESSION_STORE,
      useFactory: (): SessionStorePort =>
        isPostgresEnabled() ? new PgSessionStore() : new InMemorySessionStore(),
    },
    {
      provide: INVITATION_REGISTRY,
      useFactory: (): InvitationRegistryPort =>
        isPostgresEnabled() ? new PgInvitationRegistry() : new InMemoryInvitationRegistry(),
    },
    {
      provide: AUDIT,
      useFactory: (): AuditPort => (isPostgresEnabled() ? new PgAudit() : new InMemoryAudit()),
    },
    {
      provide: ListUsersUseCase,
      useFactory: (store: UserStorePort) => new ListUsersUseCase(store),
      inject: [USER_STORE],
    },
    {
      provide: RegisterUserUseCase,
      useFactory: (
        users: UserStorePort,
        hasher: BcryptHasher,
        mailer: MailerPort,
        clock: NestSystemClock,
        otp: CryptoOtp,
        invites: InvitationRegistryPort,
      ) => new RegisterUserUseCase(users, hasher, mailer, clock, otp, invites),
      inject: [USER_STORE, BcryptHasher, MAILER, NestSystemClock, CryptoOtp, INVITATION_REGISTRY],
    },
    {
      provide: VerifyEmailUseCase,
      useFactory: (
        users: UserStorePort,
        sessions: SessionStorePort,
        tokens: JwtTokenService,
        mailer: MailerPort,
        clock: NestSystemClock,
      ) => new VerifyEmailUseCase(users, sessions, tokens, mailer, clock),
      inject: [USER_STORE, SESSION_STORE, JwtTokenService, MAILER, NestSystemClock],
    },
    {
      provide: LoginUserUseCase,
      useFactory: (
        users: UserStorePort,
        sessions: SessionStorePort,
        tokens: JwtTokenService,
        idp: LocalIdentityProvider,
        clock: NestSystemClock,
        audit: AuditPort,
      ) => new LoginUserUseCase(users, sessions, tokens, idp, clock, audit),
      inject: [USER_STORE, SESSION_STORE, JwtTokenService, LocalIdentityProvider, NestSystemClock, AUDIT],
    },
    {
      provide: RefreshSessionUseCase,
      useFactory: (
        users: UserStorePort,
        sessions: SessionStorePort,
        tokens: JwtTokenService,
        clock: NestSystemClock,
      ) => new RefreshSessionUseCase(users, sessions, tokens, clock),
      inject: [USER_STORE, SESSION_STORE, JwtTokenService, NestSystemClock],
    },
    {
      provide: ForgotPasswordUseCase,
      useFactory: (users: UserStorePort, mailer: MailerPort, clock: NestSystemClock) =>
        new ForgotPasswordUseCase(users, mailer, clock, process.env.WEB_URL ?? 'http://localhost:3000'),
      inject: [USER_STORE, MAILER, NestSystemClock],
    },
    {
      provide: ResetPasswordUseCase,
      useFactory: (
        users: UserStorePort,
        sessions: SessionStorePort,
        hasher: BcryptHasher,
        clock: NestSystemClock,
      ) => new ResetPasswordUseCase(users, sessions, hasher, clock),
      inject: [USER_STORE, SESSION_STORE, BcryptHasher, NestSystemClock],
    },
    {
      provide: ListSessionsUseCase,
      useFactory: (sessions: SessionStorePort) => new ListSessionsUseCase(sessions),
      inject: [SESSION_STORE],
    },
    {
      provide: RevokeSessionUseCase,
      useFactory: (sessions: SessionStorePort) => new RevokeSessionUseCase(sessions),
      inject: [SESSION_STORE],
    },
    {
      provide: LogoutUseCase,
      useFactory: (sessions: SessionStorePort) => new LogoutUseCase(sessions),
      inject: [SESSION_STORE],
    },
    {
      provide: LogoutAllUseCase,
      useFactory: (sessions: SessionStorePort) => new LogoutAllUseCase(sessions),
      inject: [SESSION_STORE],
    },
  ],
  exports: [
    USER_STORE,
    SESSION_STORE,
    INVITATION_REGISTRY,
    AUDIT,
    JwtTokenService,
    MAILER,
    AuthGuard,
    AuthRateLimiter,
    NestSystemClock,
  ],
})
export class IdentityModule {}
