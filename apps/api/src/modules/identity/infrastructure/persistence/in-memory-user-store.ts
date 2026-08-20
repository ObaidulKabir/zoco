import { Injectable } from '@nestjs/common';
import type { User } from '../../domain/user';
import type { UserStorePort } from '../../application/ports/user-store.port';

@Injectable()
export class InMemoryUserStore implements UserStorePort {
  private users: User[] = [];

  async list(): Promise<User[]> {
    return [...this.users];
  }

  async findById(id: string): Promise<User | null> {
    return this.users.find((u) => u.id === id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.users.find((u) => u.email === email) ?? null;
  }

  async save(user: User): Promise<void> {
    const idx = this.users.findIndex((u) => u.id === user.id);
    if (idx >= 0) this.users[idx] = user;
    else this.users.push(user);
  }

  async clear(): Promise<void> {
    this.users = [];
  }
}
