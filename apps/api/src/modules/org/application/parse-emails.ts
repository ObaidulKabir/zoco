import { orgError } from '../domain/org-error';
import { MAX_INVITE_BATCH } from '../domain/policy';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const parseInviteEmails = (input: { emails?: string[]; csv?: string }): string[] => {
  const raw: string[] = [...(input.emails ?? [])];
  if (input.csv) {
    for (const line of input.csv.split(/\r?\n/)) {
      const cells = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      for (const cell of cells) {
        if (cell && cell.toLowerCase() !== 'email') raw.push(cell);
      }
    }
  }
  const emails = [...new Set(raw.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (!emails.length) {
    throw orgError('VALIDATION_ERROR', 'Provide at least one email', [
      { field: 'emails', message: 'Provide at least one email', code: 'INVALID' },
    ]);
  }
  if (emails.length > MAX_INVITE_BATCH) {
    throw orgError('VALIDATION_ERROR', `At most ${MAX_INVITE_BATCH} emails per batch`, [
      { field: 'emails', message: `At most ${MAX_INVITE_BATCH} emails per batch`, code: 'INVALID' },
    ]);
  }
  for (const email of emails) {
    if (!EMAIL.test(email)) {
      throw orgError('VALIDATION_ERROR', 'Email address is invalid', [
        { field: 'emails', message: `${email} is not a valid email`, code: 'INVALID' },
      ]);
    }
  }
  return emails;
};
