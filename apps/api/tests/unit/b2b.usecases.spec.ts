import { SystemClock } from '@zoqo/shared';
import { InMemoryB2bStore } from '../../src/modules/b2b/infrastructure/persistence/in-memory-b2b-store';
import { SendConnectionRequestUseCase } from '../../src/modules/b2b/application/send-connection-request.usecase';
import { AcceptConnectionRequestUseCase } from '../../src/modules/b2b/application/accept-connection-request.usecase';
import { RejectConnectionRequestUseCase } from '../../src/modules/b2b/application/reject-connection-request.usecase';
import { BlockConnectionRequestUseCase } from '../../src/modules/b2b/application/block-connection-request.usecase';
import { DisconnectB2bUseCase } from '../../src/modules/b2b/application/disconnect-b2b.usecase';
import { CheckB2bConnectionUseCase } from '../../src/modules/b2b/application/check-b2b-connection.usecase';
import { ListB2bConnectionsUseCase } from '../../src/modules/b2b/application/list-b2b-connections.usecase';
import { B2bError } from '../../src/modules/b2b/domain/b2b-error';
import type { AuditPort } from '../../src/modules/identity/application/ports/audit.port';

describe('B2B Connection Use Cases (Sprint 5)', () => {
  let store: InMemoryB2bStore;
  let clock: SystemClock;
  let sendReq: SendConnectionRequestUseCase;
  let acceptReq: AcceptConnectionRequestUseCase;
  let rejectReq: RejectConnectionRequestUseCase;
  let blockReq: BlockConnectionRequestUseCase;
  let disconnectReq: DisconnectB2bUseCase;
  let checkConn: CheckB2bConnectionUseCase;
  let listConn: ListB2bConnectionsUseCase;

  const orgA = 'org-acme-1';
  const orgB = 'org-tokyo-2';
  const userA = 'user-rahim-1';
  const userB = 'user-tanaka-2';

  beforeEach(() => {
    store = new InMemoryB2bStore();
    clock = new SystemClock();
    sendReq = new SendConnectionRequestUseCase(store, clock);
    acceptReq = new AcceptConnectionRequestUseCase(store, clock);
    rejectReq = new RejectConnectionRequestUseCase(store, clock);
    blockReq = new BlockConnectionRequestUseCase(store, clock);
    disconnectReq = new DisconnectB2bUseCase(store, clock);
    checkConn = new CheckB2bConnectionUseCase(store);
    listConn = new ListB2bConnectionsUseCase(store);
  });

  describe('SendConnectionRequestUseCase', () => {
    it('sends a connection request with valid introduction message', async () => {
      const conn = await sendReq.execute({
        senderOrgId: orgA,
        senderUserId: userA,
        receiverOrgId: orgB,
        introMessage: 'Hello Tokyo Corp, we would like to collaborate on our supply chain.',
      });

      expect(conn.id).toBeDefined();
      expect(conn.status).toBe('pending');
      expect(conn.senderOrgId).toBe(orgA);
      expect(conn.receiverOrgId).toBe(orgB);
      expect(conn.introMessage).toBe('Hello Tokyo Corp, we would like to collaborate on our supply chain.');
    });

    it('rejects connection request to own organization', async () => {
      await expect(
        sendReq.execute({
          senderOrgId: orgA,
          senderUserId: userA,
          receiverOrgId: orgA,
          introMessage: 'Self connect',
        }),
      ).rejects.toThrow(B2bError);
    });

    it('rejects connection request without intro message or intro > 500 chars', async () => {
      await expect(
        sendReq.execute({
          senderOrgId: orgA,
          senderUserId: userA,
          receiverOrgId: orgB,
          introMessage: '',
        }),
      ).rejects.toThrow('Introduction message is required');

      await expect(
        sendReq.execute({
          senderOrgId: orgA,
          senderUserId: userA,
          receiverOrgId: orgB,
          introMessage: 'a'.repeat(501),
        }),
      ).rejects.toThrow('Introduction message is required');
    });

    it('rejects duplicate connection request if already pending or accepted', async () => {
      await sendReq.execute({
        senderOrgId: orgA,
        senderUserId: userA,
        receiverOrgId: orgB,
        introMessage: 'First request',
      });

      await expect(
        sendReq.execute({
          senderOrgId: orgA,
          senderUserId: userA,
          receiverOrgId: orgB,
          introMessage: 'Second request',
        }),
      ).rejects.toThrow('already pending');
    });

    it('enforces daily limit of 10 requests per day for free tier', async () => {
      for (let i = 0; i < 10; i++) {
        await sendReq.execute({
          senderOrgId: orgA,
          senderUserId: userA,
          receiverOrgId: `org-target-${i}`,
          introMessage: `Request ${i}`,
        });
      }

      await expect(
        sendReq.execute({
          senderOrgId: orgA,
          senderUserId: userA,
          receiverOrgId: 'org-target-11',
          introMessage: 'Over limit request',
        }),
      ).rejects.toThrow('Daily connection request limit');
    });
  });

  describe('Accept & Reject & Block Use Cases', () => {
    it('accepts a pending connection request when called by target organization', async () => {
      const pending = await sendReq.execute({
        senderOrgId: orgA,
        senderUserId: userA,
        receiverOrgId: orgB,
        introMessage: 'Please connect',
      });

      const accepted = await acceptReq.execute({
        connectionId: pending.id,
        receiverOrgId: orgB,
        receiverUserId: userB,
      });

      expect(accepted.status).toBe('accepted');
      expect(accepted.acceptedAt).toBeDefined();

      const areConnected = await checkConn.areConnected(orgA, orgB);
      expect(areConnected).toBe(true);
    });

    it('rejects accept attempt by unauthorized organization', async () => {
      const pending = await sendReq.execute({
        senderOrgId: orgA,
        senderUserId: userA,
        receiverOrgId: orgB,
        introMessage: 'Please connect',
      });

      await expect(
        acceptReq.execute({
          connectionId: pending.id,
          receiverOrgId: 'rogue-org-3',
          receiverUserId: 'rogue-user',
        }),
      ).rejects.toThrow('Only the target organization can accept');
    });

    it('rejects a pending connection request', async () => {
      const pending = await sendReq.execute({
        senderOrgId: orgA,
        senderUserId: userA,
        receiverOrgId: orgB,
        introMessage: 'Please connect',
      });

      const rejected = await rejectReq.execute({
        connectionId: pending.id,
        receiverOrgId: orgB,
        receiverUserId: userB,
      });

      expect(rejected.status).toBe('rejected');
      expect(await checkConn.areConnected(orgA, orgB)).toBe(false);
    });

    it('blocks an organization and prevents future connection requests', async () => {
      const pending = await sendReq.execute({
        senderOrgId: orgA,
        senderUserId: userA,
        receiverOrgId: orgB,
        introMessage: 'Please connect',
      });

      const blocked = await blockReq.execute({
        connectionId: pending.id,
        blockerOrgId: orgB,
        blockerUserId: userB,
      });

      expect(blocked.status).toBe('blocked');

      await expect(
        sendReq.execute({
          senderOrgId: orgA,
          senderUserId: userA,
          receiverOrgId: orgB,
          introMessage: 'Try again',
        }),
      ).rejects.toThrow('blocked');
    });
  });

  describe('Disconnect & List Use Cases', () => {
    it('disconnects an active B2B connection and archives relationship', async () => {
      const conn = await sendReq.execute({
        senderOrgId: orgA,
        senderUserId: userA,
        receiverOrgId: orgB,
        introMessage: 'Connect',
      });
      await acceptReq.execute({
        connectionId: conn.id,
        receiverOrgId: orgB,
        receiverUserId: userB,
      });

      expect(await checkConn.areConnected(orgA, orgB)).toBe(true);

      const res = await disconnectReq.execute({
        connectionId: conn.id,
        orgId: orgA,
        userId: userA,
      });

      expect(res.disconnected).toBe(true);
      expect(await checkConn.areConnected(orgA, orgB)).toBe(false);
    });

    it('lists connections filtered by status', async () => {
      const c1 = await sendReq.execute({
        senderOrgId: orgA,
        senderUserId: userA,
        receiverOrgId: orgB,
        introMessage: 'Req 1',
      });
      const c2 = await sendReq.execute({
        senderOrgId: orgA,
        senderUserId: userA,
        receiverOrgId: 'org-nodi-3',
        introMessage: 'Req 2',
      });
      await acceptReq.execute({
        connectionId: c1.id,
        receiverOrgId: orgB,
        receiverUserId: userB,
      });

      const all = await listConn.execute(orgA);
      expect(all.length).toBe(2);

      const acceptedOnly = await listConn.execute(orgA, 'accepted');
      expect(acceptedOnly.length).toBe(1);
      expect(acceptedOnly[0].id).toBe(c1.id);

      const pendingOnly = await listConn.execute(orgA, 'pending');
      expect(pendingOnly.length).toBe(1);
      expect(pendingOnly[0].id).toBe(c2.id);
    });
  });

  describe('Audit events', () => {
    it('records audit events for request, accept, and disconnect', async () => {
      const audit: AuditPort = { record: jest.fn(async () => undefined) };

      const sendWithAudit = new SendConnectionRequestUseCase(store, clock, audit);
      const acceptWithAudit = new AcceptConnectionRequestUseCase(store, clock, audit);
      const disconnectWithAudit = new DisconnectB2bUseCase(store, clock, audit);

      const requested = await sendWithAudit.execute({
        senderOrgId: orgA,
        senderUserId: userA,
        receiverOrgId: orgB,
        introMessage: 'Please connect for external collaboration',
      });

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: orgA,
          userId: userA,
          action: 'b2b.connection.requested',
          targetId: requested.id,
        }),
      );

      await acceptWithAudit.execute({
        connectionId: requested.id,
        receiverOrgId: orgB,
        receiverUserId: userB,
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: orgB,
          userId: userB,
          action: 'b2b.connection.accepted',
          targetId: requested.id,
        }),
      );

      await disconnectWithAudit.execute({
        connectionId: requested.id,
        orgId: orgA,
        userId: userA,
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: orgA,
          userId: userA,
          action: 'b2b.connection.disconnected',
          targetId: requested.id,
        }),
      );
    });
  });
});
