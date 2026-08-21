import { err, ok, type Result } from '@zoqo/shared';
import type { ClockPort, MailerPort } from '@zoqo/shared';
import { authError, isAuthError, type AuthError } from '../domain/auth-error';
import { newId, sha256 } from '../domain/crypto';
import { normalizeEmail, validateEmailFormat, validateName, validatePassword } from '../domain/password-policy';
import { User } from '../domain/user';
import type { InvitationLookupPort } from './ports/invitation-lookup.port';
import type { OtpPort } from './ports/otp.port';
import type { PasswordHasherPort } from './ports/password-hasher.port';
import type { UserStorePort } from './ports/user-store.port';

export type RegisterInput = {
  name: string;
  email: string;
  password: string;
  inviteToken?: string;
};

export type RegisterOutput = {
  user: ReturnType<User['toPublic']>;
  verificationCode?: string;
};

export class RegisterUserUseCase {
  constructor(
    private readonly users: UserStorePort,
    private readonly hasher: PasswordHasherPort,
    private readonly mailer: MailerPort,
    private readonly clock: ClockPort,
    private readonly otp: OtpPort,
    private readonly invites: InvitationLookupPort,
  ) {}

  /**
   * ORG-AUTH-001 lets an invited person read the OTP in-app instead of waiting
   * for mail, but only when the token really was issued to the email being
   * registered — otherwise anyone could verify an address they do not own.
   */
  private async inviteMatches(email: string, token: string | undefined, now: Date): Promise<boolean> {
    if (!token) return false;
    const invite = await this.invites.findByTokenHash(sha256(token));
    if (!invite) return false;
    return invite.email === email && invite.expiresAt.getTime() > now.getTime();
  }

  async execute(input: RegisterInput): Promise<Result<RegisterOutput, AuthError>> {
    try {
      validateName(input.name);
      validateEmailFormat(input.email);
      validatePassword(input.password);
      const email = normalizeEmail(input.email);
      if (await this.users.findByEmail(email)) {
        throw authError('DUPLICATE', 'Email address is already registered', [
          { field: 'email', message: 'This email is already in use', code: 'DUPLICATE' },
        ]);
      }
      const now = this.clock.now();
      const code = this.otp.generate();
      const user = User.create({
        id: newId(),
        email,
        name: input.name.trim(),
        passwordHash: await this.hasher.hash(input.password),
        now,
      });
      user.setEmailOtp(sha256(code), new Date(now.getTime() + 15 * 60 * 1000));
      await this.users.save(user);
      await this.mailer.send({
        to: email,
        subject: 'Your Zoqo verification code',
        text: `Your verification code is ${code}. It expires in 15 minutes.`,
      });
      const inAppOtp =
        (await this.inviteMatches(email, input.inviteToken, now)) ||
        (process.env.NODE_ENV !== 'production' && process.env.E2E_EXPOSE_OTP === '1');
      return ok({
        user: user.toPublic(),
        verificationCode: inAppOtp ? code : undefined,
      });
    } catch (error) {
      if (isAuthError(error)) return err(error);
      throw error;
    }
  }
}
