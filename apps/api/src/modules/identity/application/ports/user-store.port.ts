import type { User } from '../../domain/user';

export interface UserStorePort {
  list(): Promise<User[]>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<void>;
  clear(): Promise<void>;
}
