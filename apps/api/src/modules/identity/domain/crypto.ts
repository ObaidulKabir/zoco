import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';

export const newId = (): string => randomUUID();

export const sha256 = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

export const randomToken = (): string => randomBytes(32).toString('hex');

export const randomOtp = (): string => String(randomInt(100000, 1000000));
