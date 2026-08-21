import { Injectable } from '@nestjs/common';
import { query } from '../../../../db/pool';
import { User, type UserStatus } from '../../domain/user';
import type { UserStorePort } from '../../application/ports/user-store.port';

type Row = {
  id: string;
  email: string;
  full_name: string;
  password_hash: string;
  status: UserStatus;
  failed_at: Date[] | null;
  locked_until: Date | null;
  password_history: string[] | null;
  email_otp_hash: string | null;
  email_otp_expires_at: Date | null;
  password_reset_hash: string | null;
  password_reset_expires_at: Date | null;
  created_at: Date;
};

const COLUMNS = `id, email, full_name, password_hash, status, failed_at, locked_until,
  password_history, email_otp_hash, email_otp_expires_at, password_reset_hash,
  password_reset_expires_at, created_at`;

const toUser = (row: Row): User =>
  new User(
    row.id,
    row.email,
    row.full_name,
    row.password_hash,
    row.status,
    row.failed_at ?? [],
    row.locked_until,
    row.password_history ?? [],
    row.email_otp_hash,
    row.email_otp_expires_at,
    row.password_reset_hash,
    row.password_reset_expires_at,
    row.created_at,
  );

@Injectable()
export class PgUserStore implements UserStorePort {
  async list(): Promise<User[]> {
    return (await query<Row>(`select ${COLUMNS} from users order by created_at`)).map(toUser);
  }

  async findById(id: string): Promise<User | null> {
    const rows = await query<Row>(`select ${COLUMNS} from users where id = $1`, [id]);
    return rows[0] ? toUser(rows[0]) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const rows = await query<Row>(`select ${COLUMNS} from users where email = $1`, [email]);
    return rows[0] ? toUser(rows[0]) : null;
  }

  async save(user: User): Promise<void> {
    await query(
      `insert into users (
         id, email, full_name, password_hash, status, failed_at, locked_until,
         password_history, email_otp_hash, email_otp_expires_at,
         password_reset_hash, password_reset_expires_at, created_at, updated_at
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, now())
       on conflict (id) do update set
         email = excluded.email,
         full_name = excluded.full_name,
         password_hash = excluded.password_hash,
         status = excluded.status,
         failed_at = excluded.failed_at,
         locked_until = excluded.locked_until,
         password_history = excluded.password_history,
         email_otp_hash = excluded.email_otp_hash,
         email_otp_expires_at = excluded.email_otp_expires_at,
         password_reset_hash = excluded.password_reset_hash,
         password_reset_expires_at = excluded.password_reset_expires_at,
         updated_at = now()`,
      [
        user.id,
        user.email,
        user.name,
        user.passwordHash,
        user.status,
        user.failedAt,
        user.lockedUntil,
        user.passwordHistory,
        user.emailOtpHash,
        user.emailOtpExpiresAt,
        user.passwordResetHash,
        user.passwordResetExpiresAt,
        user.createdAt,
      ],
    );
  }

  async clear(): Promise<void> {
    await query('truncate users cascade');
  }
}
