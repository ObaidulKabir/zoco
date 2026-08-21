export type Person = { id: string; email: string; name: string };

export interface PeoplePort {
  findById(id: string): Promise<Person | null>;
  findByEmail(email: string): Promise<Person | null>;
}
