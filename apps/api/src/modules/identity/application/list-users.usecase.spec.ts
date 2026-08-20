import { ListUsersUseCase } from './list-users.usecase';
import type { UserStorePort } from './ports/user-store.port';
import { User } from '../domain/user';

class FakeUserStore implements UserStorePort {
  constructor(private readonly users: User[]) {}
  list(): Promise<User[]> {
    return Promise.resolve(this.users);
  }
  findById(id: string): Promise<User | null> {
    return Promise.resolve(this.users.find((u) => u.id === id) ?? null);
  }
  findByEmail(email: string): Promise<User | null> {
    return Promise.resolve(this.users.find((u) => u.email === email) ?? null);
  }
  async save(): Promise<void> {}
  async clear(): Promise<void> {}
}

describe('ListUsersUseCase', () => {
  it('returns an empty list when the store is empty (Sprint 0 skeleton)', async () => {
    const usecase = new ListUsersUseCase(new FakeUserStore([]));
    await expect(usecase.execute()).resolves.toEqual([]);
  });

  it('returns users from the store', async () => {
    const user = User.create({
      id: 'u1',
      email: 'sarah@acme.test',
      name: 'Sarah',
      passwordHash: 'h:x',
      now: new Date('2026-08-20T00:00:00Z'),
    });
    const usecase = new ListUsersUseCase(new FakeUserStore([user]));
    await expect(usecase.execute()).resolves.toEqual([user]);
  });
});
