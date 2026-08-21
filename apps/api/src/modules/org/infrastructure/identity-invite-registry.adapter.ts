import type { InvitationRegistryPort } from '../../identity/application/ports/invitation-lookup.port';
import type { InviteRegistryPort } from '../application/ports/invite-registry.port';

export class IdentityInviteRegistryAdapter implements InviteRegistryPort {
  constructor(private readonly registry: InvitationRegistryPort) {}

  async record(input: { tokenHash: string; email: string; expiresAt: Date }): Promise<void> {
    await this.registry.record(input.tokenHash, { email: input.email, expiresAt: input.expiresAt });
  }
}
