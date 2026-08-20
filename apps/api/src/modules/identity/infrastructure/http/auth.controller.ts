import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Result } from '@zoqo/shared';
import { ForgotPasswordUseCase } from '../../application/forgot-password.usecase';
import { LoginUserUseCase } from '../../application/login-user.usecase';
import { RefreshSessionUseCase } from '../../application/refresh-session.usecase';
import { RegisterUserUseCase } from '../../application/register-user.usecase';
import { ResetPasswordUseCase } from '../../application/reset-password.usecase';
import {
  ListSessionsUseCase,
  LogoutAllUseCase,
  LogoutUseCase,
  RevokeSessionUseCase,
} from '../../application/session.usecases';
import { VerifyEmailUseCase } from '../../application/verify-email.usecase';
import type { AuthError } from '../../domain/auth-error';
import { AuthGuard, type AuthedRequest } from './auth.guard';
import { httpStatusFor } from './http-status';

const reject = (error: AuthError): never => {
  throw new HttpException(
    { success: false, error: { code: error.code, message: error.message, details: error.details } },
    httpStatusFor(error.code),
  );
};

const unwrap = <T>(result: Result<T, AuthError>): T => {
  if (result.ok) return result.value;
  return reject(result.error);
};

const client = (req: Request) => ({
  ip: req.ip || req.socket.remoteAddress || '127.0.0.1',
  userAgent: String(req.headers['user-agent'] ?? 'unknown'),
});

@Controller('v1/auth')
export class AuthController {
  constructor(
    @Inject(RegisterUserUseCase) private readonly registerUser: RegisterUserUseCase,
    @Inject(VerifyEmailUseCase) private readonly verifyEmail: VerifyEmailUseCase,
    @Inject(LoginUserUseCase) private readonly loginUser: LoginUserUseCase,
    @Inject(RefreshSessionUseCase) private readonly refreshSession: RefreshSessionUseCase,
    @Inject(ForgotPasswordUseCase) private readonly forgotPassword: ForgotPasswordUseCase,
    @Inject(ResetPasswordUseCase) private readonly resetPassword: ResetPasswordUseCase,
    @Inject(ListSessionsUseCase) private readonly listSessionsUc: ListSessionsUseCase,
    @Inject(RevokeSessionUseCase) private readonly revokeSession: RevokeSessionUseCase,
    @Inject(LogoutUseCase) private readonly logoutUc: LogoutUseCase,
    @Inject(LogoutAllUseCase) private readonly logoutAllUc: LogoutAllUseCase,
  ) {}

  @Post('register')
  @HttpCode(201)
  async register(@Body() body: { name?: string; email?: string; password?: string; inviteToken?: string }) {
    const data = unwrap(
      await this.registerUser.execute({
        name: body.name ?? '',
        email: body.email ?? '',
        password: body.password ?? '',
        inviteToken: body.inviteToken,
      }),
    );
    return { success: true, data };
  }

  @Post('verify-email')
  @HttpCode(200)
  async verify(@Body() body: { email?: string; otp?: string }, @Req() req: Request) {
    const data = unwrap(
      await this.verifyEmail.execute({
        email: body.email ?? '',
        otp: body.otp ?? '',
        ...client(req),
      }),
    );
    return { success: true, data };
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: { email?: string; password?: string }, @Req() req: Request) {
    const data = unwrap(
      await this.loginUser.execute({
        email: body.email ?? '',
        password: body.password ?? '',
        ...client(req),
      }),
    );
    return { success: true, data };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() body: { refreshToken?: string }) {
    const data = unwrap(await this.refreshSession.execute(body.refreshToken ?? ''));
    return { success: true, data };
  }

  @Post('forgot-password')
  @HttpCode(200)
  async forgot(@Body() body: { email?: string }) {
    const data = unwrap(await this.forgotPassword.execute(body.email ?? ''));
    return { success: true, data };
  }

  @Post('reset-password')
  @HttpCode(200)
  async reset(@Body() body: { email?: string; token?: string; password?: string }) {
    const data = unwrap(
      await this.resetPassword.execute({
        email: body.email ?? '',
        token: body.token ?? '',
        password: body.password ?? '',
      }),
    );
    return { success: true, data };
  }

  @Post('mfa/enable')
  @UseGuards(AuthGuard)
  enableMfa() {
    throw new HttpException(
      {
        success: false,
        error: { code: 'NOT_IMPLEMENTED', message: 'MFA ships in Sprint 2 if not completed here.' },
      },
      501,
    );
  }

  @Get('sessions')
  @UseGuards(AuthGuard)
  async sessions(@Req() req: AuthedRequest) {
    const data = await this.listSessionsUc.execute(req.userId, req.sessionId);
    return { success: true, data };
  }

  @Delete('sessions/:sessionId')
  @UseGuards(AuthGuard)
  @HttpCode(204)
  async revoke(@Param('sessionId') sessionId: string, @Req() req: AuthedRequest) {
    const result = await this.revokeSession.execute(req.userId, sessionId);
    if (!result.ok) reject(result.error);
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  @HttpCode(204)
  async doLogout(@Req() req: AuthedRequest) {
    await this.logoutUc.execute(req.sessionId);
  }

  @Post('logout-all')
  @UseGuards(AuthGuard)
  @HttpCode(204)
  async doLogoutAll(@Req() req: AuthedRequest) {
    await this.logoutAllUc.execute(req.userId);
  }
}
