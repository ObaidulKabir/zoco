import { Injectable } from '@nestjs/common';
import { query } from '../../../../db/pool';
import type {
  InvitationRegistryPort,
  PendingInvitation,
} from '../../application/ports/invitation-lookup.port';

type Row = { email: string; expires_at: Date };

@Injectable()
export class PgInvitationRegistry implements InvitationRegistryPort {
  async record(tokenHash: string, invitation: PendingInvitation): Promise<void> {
    await query(
      `insert into invite_email_tokens (token_hash, email, expires_at) values ($1,$2,$3)
       on conflict (token_hash) do update set
         email = excluded.email,
         expires_at = excluded.expires_at`,
      [tokenHash, invitation.email, invitation.expiresAt],
    );
  }

  async findByTokenHash(tokenHash: string): Promise<PendingInvitation | null> {
    const rows = await query<Row>(
      'select email, expires_at from invite_email_tokens where token_hash = $1',
      [tokenHash],
    );
    return rows[0] ? { email: rows[0].email, expiresAt: rows[0].expires_at } : null;
  }

  async clear(): Promise<void> {
    await query('truncate invite_email_tokens');
  }
}
