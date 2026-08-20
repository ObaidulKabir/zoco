import { err, ok } from './result';

describe('Result', () => {
  it('wraps success', () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 });
  });

  it('wraps failure', () => {
    expect(err('nope')).toEqual({ ok: false, error: 'nope' });
  });
});
