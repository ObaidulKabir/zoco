import { Injectable } from '@nestjs/common';
import type { Session } from '../../domain/session';
import type { SessionStorePort } from '../../application/ports/session-store.port';

@Injectable()
export class InMemorySessionStore implements SessionStorePort {
  private sessions: Session[] = [];

  async save(session: Session): Promise<void> {
    const idx = this.sessions.findIndex((s) => s.id === session.id);
    if (idx >= 0) this.sessions[idx] = session;
    else this.sessions.push(session);
  }

  async findById(id: string): Promise<Session | null> {
    return this.sessions.find((s) => s.id === id) ?? null;
  }

  async listByUser(userId: string): Promise<Session[]> {
    return this.sessions.filter((s) => s.userId === userId);
  }

  async delete(id: string): Promise<void> {
    this.sessions = this.sessions.filter((s) => s.id !== id);
  }

  async deleteByUser(userId: string): Promise<void> {
    this.sessions = this.sessions.filter((s) => s.userId !== userId);
  }

  async clear(): Promise<void> {
    this.sessions = [];
  }
}
