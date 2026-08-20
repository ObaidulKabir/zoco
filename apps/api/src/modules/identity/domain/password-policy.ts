import { authError, AuthError } from './auth-error';
import { isCommonPassword } from './common-passwords';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SPECIAL = /[^A-Za-z0-9]/;

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export const validateName = (name: string): void => {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 100) {
    throw authError('VALIDATION_ERROR', 'Full name must be 2–100 characters', [
      { field: 'name', message: 'Full name must be 2–100 characters', code: 'INVALID' },
    ]);
  }
};

export const validateEmailFormat = (email: string): void => {
  if (!EMAIL.test(email.trim())) {
    throw authError('VALIDATION_ERROR', 'Email address is invalid', [
      { field: 'email', message: 'Email address is invalid', code: 'INVALID' },
    ]);
  }
};

export const validatePassword = (plain: string): void => {
  const details: Array<{ field: string; message: string; code: string }> = [];
  if (plain.length < 8) {
    details.push({ field: 'password', message: 'Must be at least 8 characters', code: 'TOO_SHORT' });
  }
  if (!/[A-Z]/.test(plain)) {
    details.push({ field: 'password', message: 'Must include an uppercase letter', code: 'WEAK' });
  }
  if (!/[0-9]/.test(plain)) {
    details.push({ field: 'password', message: 'Must include a number', code: 'WEAK' });
  }
  if (!SPECIAL.test(plain)) {
    details.push({ field: 'password', message: 'Must include a special character', code: 'WEAK' });
  }
  if (isCommonPassword(plain)) {
    details.push({
      field: 'password',
      message: 'This password is too common',
      code: 'COMMON',
    });
  }
  if (details.length) {
    throw new AuthError('VALIDATION_ERROR', 'Password does not meet requirements', details);
  }
};
