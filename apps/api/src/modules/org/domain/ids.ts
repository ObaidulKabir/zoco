import { randomBytes, randomUUID, createHash } from 'node:crypto';

export const newOrgId = (): string => randomUUID();

export const sha256 = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

export const randomToken = (): string => randomBytes(32).toString('hex');
