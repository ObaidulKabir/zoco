import { InMemoryEventBus } from './fakes/in-memory-event-bus';
import { InMemoryIdentityProvider } from './fakes/in-memory-identity-provider';
import { InMemoryMailer } from './fakes/in-memory-mailer';
import { InMemoryObjectStorage } from './fakes/in-memory-object-storage';
import { InMemoryPush } from './fakes/in-memory-push';
import { InMemorySearch } from './fakes/in-memory-search';
import { InMemoryTranslation } from './fakes/in-memory-translation';
import { FixedClock, SystemClock } from './fakes/clock';

describe('port fakes', () => {
  it('mailer records outbound mail', async () => {
    const mailer = new InMemoryMailer();
    await mailer.send({ to: 'a@b.test', subject: 'Hi', text: 'x' });
    expect(mailer.sent).toHaveLength(1);
  });

  it('search is tenant-scoped', async () => {
    const search = new InMemorySearch();
    await search.index('1', 'acme', 'hello');
    await search.index('2', 'nodi', 'hello');
    const hits = await search.query('acme', 'hello');
    expect(hits.map((h) => h.id)).toEqual(['1']);
  });

  it('translation prefixes target language and detects Bengali', async () => {
    const t = new InMemoryTranslation();
    await expect(t.translate('hi', 'en', 'bn')).resolves.toBe('[bn] hi');
    await expect(t.detect('হ্যালো')).resolves.toMatchObject({ language: 'bn' });
    await expect(t.detect('hello')).resolves.toMatchObject({ language: 'en' });
  });

  it('object storage round-trips and signs in-memory urls', async () => {
    const store = new InMemoryObjectStorage();
    const put = await store.put('a.txt', Buffer.from('hi'), 'text/plain');
    expect(put.size).toBe(2);
    await expect(store.getSignedUrl('a.txt', 60)).resolves.toBe('memory://a.txt');
    await expect(store.getSignedUrl('missing', 60)).rejects.toThrow(/not found/);
  });

  it('push and event bus record messages', async () => {
    const push = new InMemoryPush();
    await push.send({ subscriptionEndpoint: 'https://local/push', title: 't', body: 'b' });
    expect(push.sent).toHaveLength(1);
    const bus = new InMemoryEventBus();
    await bus.publish({ type: 'user.created', tenantId: null, payload: { id: '1' } });
    expect(bus.events[0]?.type).toBe('user.created');
  });

  it('identity provider authenticates local credentials', async () => {
    const idp = new InMemoryIdentityProvider([
      { id: 'u1', email: 'sarah@acme.test', password: 'secret' },
    ]);
    await expect(
      idp.authenticate({ email: 'sarah@acme.test', password: 'secret' }),
    ).resolves.toEqual({ id: 'u1', email: 'sarah@acme.test' });
    await expect(
      idp.authenticate({ email: 'sarah@acme.test', password: 'nope' }),
    ).resolves.toBeNull();
  });

  it('clocks return a Date', () => {
    const fixed = new Date('2026-08-20T00:00:00.000Z');
    expect(new FixedClock(fixed).now()).toBe(fixed);
    expect(new SystemClock().now()).toBeInstanceOf(Date);
  });
});
