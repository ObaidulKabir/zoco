import { Module } from '@nestjs/common';
import { InMemoryMailer, type MailerPort } from '@zoqo/shared';
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
import { InMemoryAudit } from './infrastructure/audit/in-memory-audit';
import { NestSystemClock } from './infrastructure/clock/nest-system-clock';
import { AuthController } from './infrastructure/http/auth.controller';
import { AuthGuard } from './infrastructure/http/auth.guard';
import { IdentityController } from './infrastructure/http/identity.controller';
import { SmtpMailer } from './infrastructure/mail/smtp-mailer';
import { MAILER } from './identity.tokens';
import { InMemorySessionStore } from './infrastructure/persistence/in-memory-session-store';
import { InMemoryUserStore } from './infrastructure/persistence/in-memory-user-store';
import { BcryptHasher } from './infrastructure/security/bcrypt-hasher';
import { CryptoOtp } from './infrastructure/security/crypto-otp';
import { JwtTokenService } from './infrastructure/security/jwt-token.service';
import { LocalIdentityProvider } from './infrastructure/security/local-identity-provider';

const mailerFactory = (): MailerPort =>
  process.env.MAILER_DRIVER === 'smtp' ? new SmtpMailer() : new InMemoryMailer();

@Module({
  controllers: [IdentityController, AuthController],
  providers: [
    InMemoryUserStore,
    InMemorySessionStore,
    BcryptHasher,
    JwtTokenService,
    CryptoOtp,
    NestSystemClock,
    InMemoryAudit,
    LocalIdentityProvider,
    AuthGuard,
    { provide: MAILER, useFactory: mailerFactory },
    {
      provide: ListUsersUseCase,
      useFactory: (store: InMemoryUserStore) => new ListUsersUseCase(store),
      inject: [InMemoryUserStore],
    },
    {
      provide: RegisterUserUseCase,
      useFactory: (
        users: InMemoryUserStore,
        hasher: BcryptHasher,
        mailer: MailerPort,
        clock: NestSystemClock,
        otp: CryptoOtp,
      ) => new RegisterUserUseCase(users, hasher, mailer, clock, otp),
      inject: [InMemoryUserStore, BcryptHasher, MAILER, NestSystemClock, CryptoOtp],
    },
    {
      provide: VerifyEmailUseCase,
      useFactory: (
        users: InMemoryUserStore,
        sessions: InMemorySessionStore,
        tokens: JwtTokenService,
        mailer: MailerPort,
        clock: NestSystemClock,
      ) => new VerifyEmailUseCase(users, sessions, tokens, mailer, clock),
      inject: [InMemoryUserStore, InMemorySessionStore, JwtTokenService, MAILER, NestSystemClock],
    },
    {
      provide: LoginUserUseCase,
      useFactory: (
        users: InMemoryUserStore,
        sessions: InMemorySessionStore,
        tokens: JwtTokenService,
        idp: LocalIdentityProvider,
        clock: NestSystemClock,
        audit: InMemoryAudit,
      ) => new LoginUserUseCase(users, sessions, tokens, idp, clock, audit),
      inject: [InMemoryUserStore, InMemorySessionStore, JwtTokenService, LocalIdentityProvider, NestSystemClock, InMemoryAudit],
    },
    {
      provide: RefreshSessionUseCase,
      useFactory: (
        users: InMemoryUserStore,
        sessions: InMemorySessionStore,
        tokens: JwtTokenService,
        clock: NestSystemClock,
      ) => new RefreshSessionUseCase(users, sessions, tokens, clock),
      inject: [InMemoryUserStore, InMemorySessionStore, JwtTokenService, NestSystemClock],
    },
    {
      provide: ForgotPasswordUseCase,
      useFactory: (users: InMemoryUserStore, mailer: MailerPort, clock: NestSystemClock) =>
        new ForgotPasswordUseCase(users, mailer, clock, process.env.WEB_URL ?? 'http://localhost:3000'),
      inject: [InMemoryUserStore, MAILER, NestSystemClock],
    },
    {
      provide: ResetPasswordUseCase,
      useFactory: (
        users: InMemoryUserStore,
        sessions: InMemorySessionStore,
        hasher: BcryptHasher,
        clock: NestSystemClock,
      ) => new ResetPasswordUseCase(users, sessions, hasher, clock),
      inject: [InMemoryUserStore, InMemorySessionStore, BcryptHasher, NestSystemClock],
    },
    {
      provide: ListSessionsUseCase,
      useFactory: (sessions: InMemorySessionStore) => new ListSessionsUseCase(sessions),
      inject: [InMemorySessionStore],
    },
    {
      provide: RevokeSessionUseCase,
      useFactory: (sessions: InMemorySessionStore) => new RevokeSessionUseCase(sessions),
      inject: [InMemorySessionStore],
    },
    {
      provide: LogoutUseCase,
      useFactory: (sessions: InMemorySessionStore) => new LogoutUseCase(sessions),
      inject: [InMemorySessionStore],
    },
    {
      provide: LogoutAllUseCase,
      useFactory: (sessions: InMemorySessionStore) => new LogoutAllUseCase(sessions),
      inject: [InMemorySessionStore],
    },
  ],
  exports: [InMemoryUserStore, InMemorySessionStore, JwtTokenService, InMemoryAudit, MAILER],
})
export class IdentityModule {}
