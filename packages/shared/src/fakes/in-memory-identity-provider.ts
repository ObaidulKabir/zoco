import type { AuthUser, IdentityProviderPort, LocalCredentials } from '../ports/identity-provider.port.js';

export class InMemoryIdentityProvider implements IdentityProviderPort {
  constructor(private readonly users: Array<LocalCredentials & { id: string }> = []) {}

  async authenticate(creds: LocalCredentials): Promise<AuthUser | null> {
    const found = this.users.find(
      (u) => u.email === creds.email && u.password === creds.password,
    );
    return found ? { id: found.id, email: found.email } : null;
  }
}
