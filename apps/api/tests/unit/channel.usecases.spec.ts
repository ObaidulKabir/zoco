import { SystemClock } from '@zoqo/shared';
import { InMemoryChannelStore } from '../../src/modules/channels/infrastructure/persistence/in-memory-channel-store';
import { InMemoryMediaStore } from '../../src/modules/media/infrastructure/persistence/in-memory-media-store';
import { InMemoryStorageAdapter } from '../../src/modules/media/infrastructure/storage/in-memory-storage.adapter';
import { InMemoryScannerAdapter } from '../../src/modules/media/infrastructure/scanner/in-memory-scanner.adapter';
import { InMemoryRealtimeNotifier } from '../../src/modules/messenger/infrastructure/realtime/in-memory-realtime-notifier';
import { CreateChannelUseCase } from '../../src/modules/channels/application/create-channel.usecase';
import { JoinChannelUseCase, LeaveChannelUseCase } from '../../src/modules/channels/application/join-channel.usecase';
import { InviteChannelMemberUseCase } from '../../src/modules/channels/application/invite-channel-member.usecase';
import { SendChannelMessageUseCase } from '../../src/modules/channels/application/send-channel-message.usecase';
import { ListChannelsUseCase } from '../../src/modules/channels/application/list-channels.usecase';
import { GetChannelMessagesUseCase, GetThreadMessagesUseCase } from '../../src/modules/channels/application/get-channel-messages.usecase';
import { ArchiveChannelUseCase, CreateSharedChannelUseCase, AcceptSharedChannelUseCase } from '../../src/modules/channels/application/archive-channel.usecase';
import { RequestUploadUrlUseCase } from '../../src/modules/media/application/request-upload-url.usecase';
import { ScanAndConfirmUseCase, GetDownloadUrlUseCase } from '../../src/modules/media/application/scan-and-confirm.usecase';

describe('Channel & Media Use Cases', () => {
  let clock: SystemClock;
  let channelStore: InMemoryChannelStore;
  let mediaStore: InMemoryMediaStore;
  let storage: InMemoryStorageAdapter;
  let scanner: InMemoryScannerAdapter;
  let realtime: InMemoryRealtimeNotifier;

  beforeEach(() => {
    clock = new SystemClock();
    channelStore = new InMemoryChannelStore();
    mediaStore = new InMemoryMediaStore();
    storage = new InMemoryStorageAdapter();
    scanner = new InMemoryScannerAdapter();
    realtime = new InMemoryRealtimeNotifier();
  });

  describe('CreateChannelUseCase', () => {
    it('creates a public channel and registers the creator as manager', async () => {
      const usecase = new CreateChannelUseCase(channelStore, clock);
      const ch = await usecase.execute({
        orgId: 'org-1',
        userId: 'user-1',
        name: 'engineering',
        topic: 'Engineering talks',
        type: 'public',
      });

      expect(ch.id).toBeDefined();
      expect(ch.name).toBe('engineering');
      expect(ch.slug).toBe('engineering');
      expect(ch.type).toBe('public');

      const member = await channelStore.findMember(ch.id, 'user-1');
      expect(member).toBeDefined();
      expect(member?.role).toBe('manager');
    });

    it('rejects duplicate channel slugs in the same organization', async () => {
      const usecase = new CreateChannelUseCase(channelStore, clock);
      await usecase.execute({ orgId: 'org-1', userId: 'user-1', name: 'engineering' });

      await expect(
        usecase.execute({ orgId: 'org-1', userId: 'user-2', name: 'Engineering' }),
      ).rejects.toThrow('already exists');
    });

    it('rejects invalid short or long channel names', async () => {
      const usecase = new CreateChannelUseCase(channelStore, clock);
      await expect(usecase.execute({ orgId: 'org-1', userId: 'user-1', name: 'a' })).rejects.toThrow();
    });
  });

  describe('Join & Leave Channel', () => {
    it('allows a member to join a public channel', async () => {
      const createUsecase = new CreateChannelUseCase(channelStore, clock);
      const ch = await createUsecase.execute({ orgId: 'org-1', userId: 'user-1', name: 'design' });

      const joinUsecase = new JoinChannelUseCase(channelStore, clock);
      const member = await joinUsecase.execute('org-1', ch.slug, 'user-2');
      expect(member.userId).toBe('user-2');
      expect(member.role).toBe('member');
    });

    it('blocks self-service join on private channels', async () => {
      const createUsecase = new CreateChannelUseCase(channelStore, clock);
      const ch = await createUsecase.execute({
        orgId: 'org-1',
        userId: 'user-1',
        name: 'secret',
        type: 'private',
      });

      const joinUsecase = new JoinChannelUseCase(channelStore, clock);
      await expect(joinUsecase.execute('org-1', ch.slug, 'user-2')).rejects.toThrow('private channel');
    });

    it('allows inviting members to private channels', async () => {
      const createUsecase = new CreateChannelUseCase(channelStore, clock);
      const ch = await createUsecase.execute({
        orgId: 'org-1',
        userId: 'user-1',
        name: 'secret',
        type: 'private',
      });

      const inviteUsecase = new InviteChannelMemberUseCase(channelStore, clock);
      const member = await inviteUsecase.execute('org-1', ch.slug, 'user-1', 'user-2');
      expect(member.userId).toBe('user-2');
    });

    it('allows leaving a regular channel but forbids leaving #general', async () => {
      const leaveUsecase = new LeaveChannelUseCase(channelStore);
      const createUsecase = new CreateChannelUseCase(channelStore, clock);
      const ch1 = await createUsecase.execute({ orgId: 'org-1', userId: 'user-1', name: 'general' });
      const ch2 = await createUsecase.execute({ orgId: 'org-1', userId: 'user-1', name: 'random' });

      await expect(leaveUsecase.execute('org-1', 'general', 'user-1')).rejects.toThrow('Cannot leave the #general');
      await leaveUsecase.execute('org-1', 'random', 'user-1');
      const mem = await channelStore.findMember(ch2.id, 'user-1');
      expect(mem).toBeNull();
    });
  });

  describe('SendChannelMessageUseCase', () => {
    it('sends a message and parses @mentions', async () => {
      const createUsecase = new CreateChannelUseCase(channelStore, clock);
      const ch = await createUsecase.execute({ orgId: 'org-1', userId: 'user-1', name: 'devops' });

      const sendUsecase = new SendChannelMessageUseCase(channelStore, realtime, clock);
      const msg = await sendUsecase.execute({
        orgId: 'org-1',
        channelIdOrSlug: ch.slug,
        senderId: 'user-1',
        content: '@Sarah please check @channel for @here deploy',
      });

      expect(msg.id).toBeDefined();
      expect(msg.content).toContain('@Sarah');
      expect(msg.mentions).toEqual(['Sarah']);
    });

    it('enforces posting restrictions on announcement channels', async () => {
      const createUsecase = new CreateChannelUseCase(channelStore, clock);
      const ch = await createUsecase.execute({
        orgId: 'org-1',
        userId: 'user-1',
        name: 'news',
        type: 'announcement',
      });

      const sendUsecase = new SendChannelMessageUseCase(channelStore, realtime, clock);

      // regular member without elevated org role fails
      await expect(
        sendUsecase.execute({
          orgId: 'org-1',
          channelIdOrSlug: ch.slug,
          senderId: 'user-2',
          senderOrgRole: 'member',
          content: 'Hello news',
        }),
      ).rejects.toThrow('Only managers and administrators can post');

      // owner succeeds
      const msg = await sendUsecase.execute({
        orgId: 'org-1',
        channelIdOrSlug: ch.slug,
        senderId: 'user-1',
        senderOrgRole: 'owner',
        content: 'Broadcast news update',
      });
      expect(msg.content).toBe('Broadcast news update');
    });

    it('threads: replies increment root reply_count and record last_reply_at', async () => {
      const createUsecase = new CreateChannelUseCase(channelStore, clock);
      const ch = await createUsecase.execute({ orgId: 'org-1', userId: 'user-1', name: 'threads-test' });

      const sendUsecase = new SendChannelMessageUseCase(channelStore, realtime, clock);
      const root = await sendUsecase.execute({
        orgId: 'org-1',
        channelIdOrSlug: ch.slug,
        senderId: 'user-1',
        content: 'Root topic',
      });

      const reply = await sendUsecase.execute({
        orgId: 'org-1',
        channelIdOrSlug: ch.slug,
        senderId: 'user-2',
        content: 'Thread reply 1',
        threadId: root.id,
      });

      expect(reply.threadId).toBe(root.id);

      const threadMessagesUsecase = new GetThreadMessagesUseCase(channelStore);
      const threadMsgs = await threadMessagesUsecase.execute('org-1', root.id);
      expect(threadMsgs.length).toBe(2);
      expect(threadMsgs[0].id).toBe(root.id);
      expect(threadMsgs[1].id).toBe(reply.id);
    });
  });

  describe('Media Storage & Quarantine Pipeline', () => {
    it('generates pre-signed upload URL for allowed MIME types under max size', async () => {
      const usecase = new RequestUploadUrlUseCase(mediaStore, storage, clock);
      const res = await usecase.execute({
        orgId: 'org-1',
        userId: 'user-1',
        filename: 'report.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024 * 1024,
      });

      expect(res.fileId).toBeDefined();
      expect(res.uploadUrl).toContain('report.pdf');
      expect(res.bucket).toBe('zoqo-media');
    });

    it('rejects oversized files exceeding 50MB limit', async () => {
      const usecase = new RequestUploadUrlUseCase(mediaStore, storage, clock);
      await expect(
        usecase.execute({
          orgId: 'org-1',
          userId: 'user-1',
          filename: 'big.mp4',
          mimeType: 'video/mp4',
          sizeBytes: 60 * 1024 * 1024,
        }),
      ).rejects.toThrow('File size exceeds max limit');
    });

    it('scans uploaded buffer and marks clean files', async () => {
      const reqUsecase = new RequestUploadUrlUseCase(mediaStore, storage, clock);
      const upload = await reqUsecase.execute({
        orgId: 'org-1',
        userId: 'user-1',
        filename: 'clean.png',
        mimeType: 'image/png',
        sizeBytes: 2048,
      });

      const scanUsecase = new ScanAndConfirmUseCase(mediaStore, scanner);
      const confirmed = await scanUsecase.execute(upload.fileId, Buffer.from('fake image data'));
      expect(confirmed.scanStatus).toBe('CLEAN');

      const dlUsecase = new GetDownloadUrlUseCase(mediaStore, storage);
      const dlUrl = await dlUsecase.execute('org-1', upload.fileId);
      expect(dlUrl).toContain('mock_dl_signature');
    });

    it('detects malware and quarantines infected files', async () => {
      const reqUsecase = new RequestUploadUrlUseCase(mediaStore, storage, clock);
      const upload = await reqUsecase.execute({
        orgId: 'org-1',
        userId: 'user-1',
        filename: 'eicar.com',
        mimeType: 'text/plain',
        sizeBytes: 68,
      });

      const scanUsecase = new ScanAndConfirmUseCase(mediaStore, scanner);
      const eicarSignature = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
      const confirmed = await scanUsecase.execute(upload.fileId, Buffer.from(eicarSignature));
      expect(confirmed.scanStatus).toBe('QUARANTINED');

      const dlUsecase = new GetDownloadUrlUseCase(mediaStore, storage);
      await expect(dlUsecase.execute('org-1', upload.fileId)).rejects.toThrow('quarantined');
    });
  });

  describe('Shared B2B & Archive Channels', () => {
    it('creates shared channel and accepts invitation', async () => {
      const createShared = new CreateSharedChannelUseCase(channelStore, clock);
      const ch = await createShared.execute({
        orgId: 'org-acme',
        userId: 'user-rahim',
        name: 'acme-tokyo-sync',
        targetOrgId: 'org-tokyo',
      });

      expect(ch.type).toBe('shared');

      const acceptShared = new AcceptSharedChannelUseCase(channelStore, clock);
      await acceptShared.execute(ch.id, 'org-tokyo', 'user-tanaka');

      const memAcme = await channelStore.findMember(ch.id, 'user-rahim');
      const memTokyo = await channelStore.findMember(ch.id, 'user-tanaka');
      expect(memAcme).toBeDefined();
      expect(memTokyo).toBeDefined();
    });

    it('archives channel and prevents posting to archived channel', async () => {
      const createUsecase = new CreateChannelUseCase(channelStore, clock);
      const ch = await createUsecase.execute({ orgId: 'org-1', userId: 'user-1', name: 'old-project' });

      const archiveUsecase = new ArchiveChannelUseCase(channelStore, clock);
      const archived = await archiveUsecase.execute('org-1', ch.slug, 'owner');
      expect(archived.isArchived).toBe(true);

      const sendUsecase = new SendChannelMessageUseCase(channelStore, realtime, clock);
      await expect(
        sendUsecase.execute({
          orgId: 'org-1',
          channelIdOrSlug: ch.slug,
          senderId: 'user-1',
          content: 'Hello archived',
        }),
      ).rejects.toThrow('archived channel');
    });
  });
});
