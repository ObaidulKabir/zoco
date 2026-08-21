import { Inject, Injectable } from '@nestjs/common';
import type { IdentityProviderPort, LocalCredentials, AuthUser } from '@zoqo/shared';
import type { PasswordHasherPort } from '../../application/ports/password-hasher.port';
import type { UserStorePort } from '../../application/ports/user-store.port';
import { USER_STORE } from '../../identity.tokens';
import { BcryptHasher } from '../security/bcrypt-hasher';

@Injectable()
export class LocalIdentityProvider implements IdentityProviderPort {
  constructor(
    @Inject(USER_STORE) private readonly users: UserStorePort,
    @Inject(BcryptHasher) private readonly hasher: BcryptHasher,
  ) {}

  async authenticate(creds: LocalCredentials): Promise<AuthUser | null> {
    const hasher: PasswordHasherPort = this.hasher;
    const user = await this.users.findByEmail(creds.email);
    if (!user) return null;
    const matches = await hasher.verify(creds.password, user.passwordHash);
    return matches ? { id: user.id, email: user.email } : null;
  }
}
