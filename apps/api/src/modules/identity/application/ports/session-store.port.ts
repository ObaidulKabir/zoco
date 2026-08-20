import type { Session } from '../../domain/session';

export interface SessionStorePort {
  save(session: Session): Promise<void>;
  findById(id: string): Promise<Session | null>;
  listByUser(userId: string): Promise<Session[]>;
  delete(id: string): Promise<void>;
  deleteByUser(userId: string): Promise<void>;
  clear(): Promise<void>;
}
