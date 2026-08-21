import { Injectable } from '@nestjs/common';
import { query } from '../../../../db/pool';
import { Session } from '../../domain/session';
import type { SessionStorePort } from '../../application/ports/session-store.port';

type Row = {
  id: string;
  user_id: string;
  refresh_token_hash: string;
  user_agent: string;
  ip: string;
  created_at: Date;
  last_active_at: Date;
  expires_at: Date;
};

const COLUMNS = 'id, user_id, refresh_token_hash, user_agent, ip, created_at, last_active_at, expires_at';

const toSession = (row: Row): Session =>
  new Session(
    row.id,
    row.user_id,
    row.refresh_token_hash,
    row.user_agent,
    row.ip,
    row.created_at,
    row.last_active_at,
    row.expires_at,
  );

@Injectable()
export class PgSessionStore implements SessionStorePort {
  async save(session: Session): Promise<void> {
    await query(
      `insert into sessions (${COLUMNS}) values ($1,$2,$3,$4,$5,$6,$7,$8)
       on conflict (id) do update set
         refresh_token_hash = excluded.refresh_token_hash,
         last_active_at = excluded.last_active_at`,
      [
        session.id,
        session.userId,
        session.refreshTokenHash,
        session.userAgent,
        session.ip,
        session.createdAt,
        session.lastActiveAt,
        session.expiresAt,
      ],
    );
  }

  async findById(id: string): Promise<Session | null> {
    const rows = await query<Row>(`select ${COLUMNS} from sessions where id = $1`, [id]);
    return rows[0] ? toSession(rows[0]) : null;
  }

  async listByUser(userId: string): Promise<Session[]> {
    const rows = await query<Row>(
      `select ${COLUMNS} from sessions where user_id = $1 order by created_at`,
      [userId],
    );
    return rows.map(toSession);
  }

  async delete(id: string): Promise<void> {
    await query('delete from sessions where id = $1', [id]);
  }

  async deleteByUser(userId: string): Promise<void> {
    await query('delete from sessions where user_id = $1', [userId]);
  }

  async clear(): Promise<void> {
    await query('truncate sessions cascade');
  }
}
