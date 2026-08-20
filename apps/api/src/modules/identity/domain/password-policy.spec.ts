import { isCommonPassword, COMMON_PASSWORD_COUNT } from './common-passwords';
import { validateName, validatePassword } from './password-policy';
import { User } from './user';

describe('password policy', () => {
  it('bundles at least 10,000 common passwords', () => {
    expect(COMMON_PASSWORD_COUNT).toBeGreaterThanOrEqual(10_000);
    expect(isCommonPassword('password')).toBe(true);
  });

  it('rejects short names and common passwords', () => {
    expect(() => validateName('A')).toThrow(/2–100/);
    expect(() => validatePassword('password')).toThrow(/common|requirements/i);
    expect(() => validatePassword('CorrectH0rse!')).not.toThrow();
  });
});

describe('User lockout', () => {
  const now = new Date('2026-08-20T12:00:00Z');

  it('locks after five failures in 15 minutes', () => {
    const user = User.create({
      id: 'u1',
      email: 'a@b.test',
      name: 'A B',
      passwordHash: 'h',
      now,
    });
    for (let i = 0; i < 5; i += 1) {
      user.recordFailedLogin(new Date(now.getTime() + i * 1000));
    }
    expect(user.isLocked(new Date(now.getTime() + 5000))).toBe(true);
    expect(user.isLocked(new Date(now.getTime() + 31 * 60 * 1000))).toBe(false);
  });
});
