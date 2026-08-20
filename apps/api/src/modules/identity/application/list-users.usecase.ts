import type { UserStorePort } from './ports/user-store.port';
import type { User } from '../domain/user';

export class ListUsersUseCase {
  constructor(private readonly store: UserStorePort) {}

  execute(): Promise<User[]> {
    return this.store.list();
  }
}
