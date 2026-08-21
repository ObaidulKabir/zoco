import { Injectable } from '@nestjs/common';
import type { InvitationRegistryPort, PendingInvitation } from '../../application/ports/invitation-lookup.port';

/**
 * Projection of org invitations that identity is allowed to read, so that
 * registration can prove an invite token belongs to the email being registered
 * without identity depending on the org module.
 */
@Injectable()
export class InMemoryInvitationRegistry implements InvitationRegistryPort {
  private readonly byTokenHash = new Map<string, PendingInvitation>();

  async record(tokenHash: string, invitation: PendingInvitation): Promise<void> {
    this.byTokenHash.set(tokenHash, invitation);
  }

  async findByTokenHash(tokenHash: string): Promise<PendingInvitation | null> {
    return this.byTokenHash.get(tokenHash) ?? null;
  }

  async clear(): Promise<void> {
    this.byTokenHash.clear();
  }
}
