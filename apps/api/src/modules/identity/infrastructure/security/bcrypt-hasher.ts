import { Injectable } from '@nestjs/common';
import { hash, compare } from 'bcryptjs';
import type { PasswordHasherPort } from '../../application/ports/password-hasher.port';

@Injectable()
export class BcryptHasher implements PasswordHasherPort {
  private readonly rounds = Number(process.env.BCRYPT_ROUNDS ?? 12);

  hash(plain: string): Promise<string> {
    return hash(plain, this.rounds);
  }

  verify(plain: string, passwordHash: string): Promise<boolean> {
    return compare(plain, passwordHash);
  }
}
