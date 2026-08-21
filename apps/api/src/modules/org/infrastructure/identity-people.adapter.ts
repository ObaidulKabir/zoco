import type { UserStorePort } from '../../identity/application/ports/user-store.port';
import type { PeoplePort, Person } from '../application/ports/people.port';

export class IdentityPeopleAdapter implements PeoplePort {
  constructor(private readonly users: UserStorePort) {}

  async findById(id: string): Promise<Person | null> {
    const user = await this.users.findById(id);
    return user ? { id: user.id, email: user.email, name: user.name } : null;
  }

  async findByEmail(email: string): Promise<Person | null> {
    const user = await this.users.findByEmail(email);
    return user ? { id: user.id, email: user.email, name: user.name } : null;
  }
}
