import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Request shapes exist as classes so the OpenAPI document carries real schemas.
 * Validation still lives in the use cases, which is why nothing here is
 * decorated with class-validator: these types describe the contract, they do
 * not enforce it.
 *
 * Every property states its `type` explicitly. The dev server and the document
 * generator both run under tsx/esbuild, which does not emit the decorator
 * metadata Swagger would otherwise reflect on.
 */
export class RegisterRequest {
  @ApiProperty({ type: String, example: 'Sarah Chen' })
  name!: string;

  @ApiProperty({ type: String, format: 'email', example: 'sarah@acme.test' })
  email!: string;

  @ApiProperty({
    type: String,
    format: 'password',
    example: 'Zoqo-QA-1!',
    description: 'Minimum 8 characters, mixed case, digit, symbol, not on the common-password list.',
  })
  password!: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Present when arriving from an invitation email; unlocks the in-app OTP.',
  })
  inviteToken?: string;
}

export class VerifyEmailRequest {
  @ApiProperty({ type: String, format: 'email', example: 'sarah@acme.test' })
  email!: string;

  @ApiProperty({ type: String, example: '204815', description: 'Six digits, valid for 10 minutes.' })
  otp!: string;
}

export class LoginRequest {
  @ApiProperty({ type: String, format: 'email', example: 'sarah@acme.test' })
  email!: string;

  @ApiProperty({ type: String, format: 'password', example: 'Zoqo-QA-1!' })
  password!: string;
}

export class RefreshRequest {
  @ApiProperty({ type: String, description: 'The refresh token from login. Rotated on every use.' })
  refreshToken!: string;
}

export class ForgotPasswordRequest {
  @ApiProperty({ type: String, format: 'email', example: 'sarah@acme.test' })
  email!: string;
}

export class ResetPasswordRequest {
  @ApiProperty({ type: String, format: 'email', example: 'sarah@acme.test' })
  email!: string;

  @ApiProperty({ type: String, description: 'Single-use token from the reset email.' })
  token!: string;

  @ApiProperty({
    type: String,
    format: 'password',
    description: 'Cannot repeat any of the last three passwords.',
  })
  password!: string;
}

export class PublicUser {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, format: 'email' })
  email!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String, enum: ['pending_verification', 'active', 'locked', 'suspended'] })
  status!: string;
}

export class SessionTokens {
  @ApiProperty({ type: String, description: 'JWT, 15 minute lifetime.' })
  accessToken!: string;

  @ApiProperty({ type: String, description: 'Opaque, 30 day lifetime, rotated on refresh.' })
  refreshToken!: string;
}

export class SessionSummary {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, example: 'Firefox on Windows' })
  device!: string;

  @ApiProperty({ type: String, example: '203.0.113.4' })
  ip!: string;

  @ApiProperty({ type: String, example: 'unknown' })
  location!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  lastActiveAt!: string;

  @ApiProperty({ type: Boolean, description: 'True for the session making this request.' })
  current!: boolean;
}
