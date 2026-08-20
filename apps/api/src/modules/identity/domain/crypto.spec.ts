import { newId, randomOtp, randomToken, sha256 } from './crypto';

describe('crypto helpers', () => {
  it('generates ids, otps, tokens, and hashes', () => {
    expect(newId()).toMatch(/-/);
    expect(randomOtp()).toMatch(/^\d{6}$/);
    expect(randomToken()).toHaveLength(64);
    expect(sha256('x')).toHaveLength(64);
  });
});
