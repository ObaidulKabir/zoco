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
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { Result } from '@zoqo/shared';
import { ApiAuthedErrors, ApiCredentialErrors } from '../../../../openapi/envelope';
import {
  ForgotPasswordRequest,
  LoginRequest,
  PublicUser,
  RefreshRequest,
  RegisterRequest,
  ResetPasswordRequest,
  SessionSummary,
  SessionTokens,
  VerifyEmailRequest,
} from './dto/auth.dto';
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
import { AuthRateLimitGuard } from './auth-rate-limit.guard';
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

@ApiTags('auth')
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
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(201)
  @ApiOperation({
    summary: 'Register a person',
    description:
      'Creates a pending_verification user and emails a 6-digit OTP. The code is only returned in the ' +
      'response when inviteToken matches a live invitation for the same address (ORG-AUTH-001).',
  })
  @ApiResponse({ status: 201, description: 'Registered; verification pending.', type: PublicUser })
  @ApiCredentialErrors()
  async register(@Body() body: RegisterRequest) {
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
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Verify an email address with the OTP',
    description: 'Activates the account and issues a first session.',
  })
  @ApiResponse({ status: 200, description: 'Verified and signed in.', type: SessionTokens })
  @ApiCredentialErrors()
  async verify(@Body() body: VerifyEmailRequest, @Req() req: Request) {
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
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Sign in',
    description:
      'Wrong credentials answer with one generic error whether or not the address exists, so the ' +
      'endpoint cannot be used to enumerate users. Five failures in 15 minutes locks the account for 30.',
  })
  @ApiResponse({ status: 200, description: 'Signed in.', type: SessionTokens })
  @ApiCredentialErrors()
  async login(@Body() body: LoginRequest, @Req() req: Request) {
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
  @ApiOperation({
    summary: 'Exchange a refresh token for a new pair',
    description: 'Refresh tokens rotate: the presented token is invalid afterwards.',
  })
  @ApiResponse({ status: 200, description: 'New token pair.', type: SessionTokens })
  @ApiCredentialErrors()
  async refresh(@Body() body: RefreshRequest) {
    const data = unwrap(await this.refreshSession.execute(body.refreshToken ?? ''));
    return { success: true, data };
  }

  @Post('forgot-password')
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Start a password reset',
    description: 'Always reports success, whether or not the address is registered.',
  })
  @ApiResponse({ status: 200, description: 'Reset email sent if the address exists.' })
  @ApiCredentialErrors()
  async forgot(@Body() body: ForgotPasswordRequest) {
    const data = unwrap(await this.forgotPassword.execute(body.email ?? ''));
    return { success: true, data };
  }

  @Post('reset-password')
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Complete a password reset',
    description: 'Consumes the token and revokes every existing session for the user.',
  })
  @ApiResponse({ status: 200, description: 'Password replaced; all sessions revoked.' })
  @ApiCredentialErrors()
  async reset(@Body() body: ResetPasswordRequest) {
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
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Enable TOTP multi-factor authentication',
    description: 'Not implemented yet. ORG-AUTH-003 is a P1 carried forward from Sprint 1.',
  })
  @ApiResponse({ status: 501, description: 'Not implemented.' })
  @ApiAuthedErrors()
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
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List active sessions for the signed-in user' })
  @ApiResponse({ status: 200, description: 'Active sessions.', type: [SessionSummary] })
  @ApiAuthedErrors()
  async sessions(@Req() req: AuthedRequest) {
    const data = await this.listSessionsUc.execute(req.userId, req.sessionId);
    return { success: true, data };
  }

  @Delete('sessions/:sessionId')
  @UseGuards(AuthGuard)
  @HttpCode(204)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Revoke one session', description: 'Signs out a single device.' })
  @ApiResponse({ status: 204, description: 'Session revoked.' })
  @ApiAuthedErrors()
  async revoke(@Param('sessionId') sessionId: string, @Req() req: AuthedRequest) {
    const result = await this.revokeSession.execute(req.userId, sessionId);
    if (!result.ok) reject(result.error);
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  @HttpCode(204)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Sign out of the current session' })
  @ApiResponse({ status: 204, description: 'Signed out.' })
  @ApiAuthedErrors()
  async doLogout(@Req() req: AuthedRequest) {
    await this.logoutUc.execute(req.sessionId);
  }

  @Post('logout-all')
  @UseGuards(AuthGuard)
  @HttpCode(204)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Sign out of every device' })
  @ApiResponse({ status: 204, description: 'All sessions revoked.' })
  @ApiAuthedErrors()
  async doLogoutAll(@Req() req: AuthedRequest) {
    await this.logoutAllUc.execute(req.userId);
  }
}
