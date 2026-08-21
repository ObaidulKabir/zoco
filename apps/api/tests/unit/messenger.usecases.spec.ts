import type { ClockPort } from '@zoqo/shared';
import { GetOrCreateDmUseCase } from '../../src/modules/messenger/application/get-or-create-dm.usecase';
import { SendDmUseCase } from '../../src/modules/messenger/application/send-dm.usecase';
import { EditMessageUseCase } from '../../src/modules/messenger/application/edit-message.usecase';
import { DeleteMessageUseCase } from '../../src/modules/messenger/application/delete-message.usecase';
import { ReactMessageUseCase } from '../../src/modules/messenger/application/react-message.usecase';
import { PinMessageUseCase } from '../../src/modules/messenger/application/pin-message.usecase';
import { ListConversationsUseCase } from '../../src/modules/messenger/application/list-conversations.usecase';
import { GetMessagesUseCase } from '../../src/modules/messenger/application/get-messages.usecase';
import { MarkReadUseCase } from '../../src/modules/messenger/application/mark-read.usecase';
import {
  RegisterPrekeyBundleUseCase,
  GetPrekeyBundleUseCase,
} from '../../src/modules/messenger/application/prekey-bundle.usecases';
import { MessengerError } from '../../src/modules/messenger/domain/messenger-error';
import { InMemoryMessengerStore } from '../../src/modules/messenger/infrastructure/persistence/in-memory-messenger-store';
import { InMemoryRealtimeNotifier } from '../../src/modules/messenger/infrastructure/realtime/in-memory-realtime-notifier';

class MutableTestClock implements ClockPort {
  constructor(private current: Date) {}
  now(): Date {
    return new Date(this.current);
  }
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

describe('Messenger Use Cases', () => {
  let clock: MutableTestClock;
  let store: InMemoryMessengerStore;
  let notifier: InMemoryRealtimeNotifier;

  let getOrCreateDm: GetOrCreateDmUseCase;
  let sendDm: SendDmUseCase;
  let editMsg: EditMessageUseCase;
  let deleteMsg: DeleteMessageUseCase;
  let reactMsg: ReactMessageUseCase;
  let pinMsg: PinMessageUseCase;
  let listConvs: ListConversationsUseCase;
  let getMsgs: GetMessagesUseCase;
  let markRead: MarkReadUseCase;
  let registerPrekeys: RegisterPrekeyBundleUseCase;
  let getPrekeys: GetPrekeyBundleUseCase;

  const orgId = 'org-acme-123';
  const rahimId = 'user-rahim-1';
  const sarahId = 'user-sarah-2';
  const managerId = 'user-manager-3';

  beforeEach(() => {
    clock = new MutableTestClock(new Date('2026-08-22T10:00:00.000Z'));
    store = new InMemoryMessengerStore();
    notifier = new InMemoryRealtimeNotifier();

    getOrCreateDm = new GetOrCreateDmUseCase(store, clock);
    sendDm = new SendDmUseCase(store, notifier, clock);
    editMsg = new EditMessageUseCase(store, notifier, clock);
    deleteMsg = new DeleteMessageUseCase(store, notifier, clock);
    reactMsg = new ReactMessageUseCase(store, notifier, clock);
    pinMsg = new PinMessageUseCase(store, notifier, clock);
    listConvs = new ListConversationsUseCase(store);
    getMsgs = new GetMessagesUseCase(store);
    markRead = new MarkReadUseCase(store, notifier, clock);
    registerPrekeys = new RegisterPrekeyBundleUseCase(store, clock);
    getPrekeys = new GetPrekeyBundleUseCase(store);
  });

  describe('GetOrCreateDmUseCase', () => {
    it('creates a new DM conversation between two members', async () => {
      const conv = await getOrCreateDm.execute({
        orgId,
        requesterId: rahimId,
        recipientId: sarahId,
      });

      expect(conv.id).toBeDefined();
      expect(conv.orgId).toBe(orgId);
      expect(conv.type).toBe('dm');
      expect(conv.participants).toHaveLength(2);
      expect(conv.participants.map((p) => p.userId)).toEqual([rahimId, sarahId]);
    });

    it('returns existing DM conversation on second call without duplicating', async () => {
      const conv1 = await getOrCreateDm.execute({
        orgId,
        requesterId: rahimId,
        recipientId: sarahId,
      });

      const conv2 = await getOrCreateDm.execute({
        orgId,
        requesterId: sarahId,
        recipientId: rahimId,
      });

      expect(conv2.id).toBe(conv1.id);
    });

    it('rejects starting DM with oneself', async () => {
      await expect(
        getOrCreateDm.execute({
          orgId,
          requesterId: rahimId,
          recipientId: rahimId,
        }),
      ).rejects.toThrow(MessengerError);
    });
  });

  describe('SendDmUseCase & Real-time Delivery', () => {
    it('sends an encrypted direct message and notifies recipient', async () => {
      const conv = await getOrCreateDm.execute({ orgId, requesterId: rahimId, recipientId: sarahId });

      const msg = await sendDm.execute({
        orgId,
        senderId: rahimId,
        conversationId: conv.id,
        contentCiphertext: 'encrypted_base64_payload',
        envelopeIv: 'iv123',
        envelopeTag: 'tag123',
      });

      expect(msg.id).toBeDefined();
      expect(msg.contentCiphertext).toBe('encrypted_base64_payload');
      expect(msg.isEdited).toBe(false);
      expect(msg.isDeleted).toBe(false);

      expect(notifier.emittedEvents).toHaveLength(1);
      expect(notifier.emittedEvents[0].event).toBe('message:new');
      expect(notifier.emittedEvents[0].recipientUserIds).toEqual([sarahId]);
    });

    it('sends a reply to an existing message', async () => {
      const conv = await getOrCreateDm.execute({ orgId, requesterId: rahimId, recipientId: sarahId });
      const parent = await sendDm.execute({
        orgId,
        senderId: rahimId,
        conversationId: conv.id,
        contentCiphertext: 'first message',
      });

      const reply = await sendDm.execute({
        orgId,
        senderId: sarahId,
        conversationId: conv.id,
        contentCiphertext: 'reply message',
        replyToId: parent.id,
      });

      expect(reply.replyToId).toBe(parent.id);
    });

    it('fails when replyTo message does not exist', async () => {
      const conv = await getOrCreateDm.execute({ orgId, requesterId: rahimId, recipientId: sarahId });
      await expect(
        sendDm.execute({
          orgId,
          senderId: sarahId,
          conversationId: conv.id,
          contentCiphertext: 'reply',
          replyToId: 'non-existent-msg',
        }),
      ).rejects.toThrow('Replied message non-existent-msg not found');
    });

    it('fails when contentCiphertext is empty', async () => {
      const conv = await getOrCreateDm.execute({ orgId, requesterId: rahimId, recipientId: sarahId });
      await expect(
        sendDm.execute({
          orgId,
          senderId: rahimId,
          conversationId: conv.id,
          contentCiphertext: '',
        }),
      ).rejects.toThrow('Message content ciphertext is required');
    });

    it('fails when conversation does not exist', async () => {
      await expect(
        sendDm.execute({
          orgId,
          senderId: rahimId,
          conversationId: 'missing-conv',
          contentCiphertext: 'hello',
        }),
      ).rejects.toThrow('Conversation missing-conv not found');
    });

    it('fails when sender is not a participant of conversation', async () => {
      const conv = await getOrCreateDm.execute({ orgId, requesterId: rahimId, recipientId: sarahId });

      await expect(
        sendDm.execute({
          orgId,
          senderId: 'outsider-999',
          conversationId: conv.id,
          contentCiphertext: 'hello',
        }),
      ).rejects.toThrow(MessengerError);
    });
  });

  describe('EditMessageUseCase', () => {
    it('allows author to edit message within 15 minutes', async () => {
      const conv = await getOrCreateDm.execute({ orgId, requesterId: rahimId, recipientId: sarahId });
      const msg = await sendDm.execute({
        orgId,
        senderId: rahimId,
        conversationId: conv.id,
        contentCiphertext: 'initial_text',
      });

      // 10 minutes later
      clock.advance(10 * 60 * 1000);

      const edited = await editMsg.execute({
        orgId,
        userId: rahimId,
        messageId: msg.id,
        contentCiphertext: 'edited_text',
        envelopeIv: 'new_iv',
        envelopeTag: 'new_tag',
      });

      expect(edited.contentCiphertext).toBe('edited_text');
      expect(edited.envelopeIv).toBe('new_iv');
      expect(edited.envelopeTag).toBe('new_tag');
      expect(edited.isEdited).toBe(true);
      expect(edited.editedAt).toBeDefined();
    });

    it('fails when editing message with empty content', async () => {
      await expect(
        editMsg.execute({
          orgId,
          userId: rahimId,
          messageId: 'some-id',
          contentCiphertext: '',
        }),
      ).rejects.toThrow('Updated message content ciphertext is required');
    });

    it('fails when editing non-existent message', async () => {
      await expect(
        editMsg.execute({
          orgId,
          userId: rahimId,
          messageId: 'missing-id',
          contentCiphertext: 'new text',
        }),
      ).rejects.toThrow('Message missing-id not found');
    });

    it('fails when editing a deleted message', async () => {
      const conv = await getOrCreateDm.execute({ orgId, requesterId: rahimId, recipientId: sarahId });
      const msg = await sendDm.execute({
        orgId,
        senderId: rahimId,
        conversationId: conv.id,
        contentCiphertext: 'initial',
      });
      await deleteMsg.execute({ orgId, userId: rahimId, messageId: msg.id });

      await expect(
        editMsg.execute({
          orgId,
          userId: rahimId,
          messageId: msg.id,
          contentCiphertext: 'edited',
        }),
      ).rejects.toThrow('Cannot edit a deleted message');
    });

    it('rejects editing after 15 minutes window has elapsed', async () => {
      const conv = await getOrCreateDm.execute({ orgId, requesterId: rahimId, recipientId: sarahId });
      const msg = await sendDm.execute({
        orgId,
        senderId: rahimId,
        conversationId: conv.id,
        contentCiphertext: 'initial_text',
      });

      // 16 minutes later
      clock.advance(16 * 60 * 1000);

      await expect(
        editMsg.execute({
          orgId,
          userId: rahimId,
          messageId: msg.id,
          contentCiphertext: 'late_edit',
        }),
      ).rejects.toThrow('Message edit window of 15 minutes has expired');
    });

    it('rejects editing by another user', async () => {
      const conv = await getOrCreateDm.execute({ orgId, requesterId: rahimId, recipientId: sarahId });
      const msg = await sendDm.execute({
        orgId,
        senderId: rahimId,
        conversationId: conv.id,
        contentCiphertext: 'initial_text',
      });

      await expect(
        editMsg.execute({
          orgId,
          userId: sarahId,
          messageId: msg.id,
          contentCiphertext: 'tampered',
        }),
      ).rejects.toThrow('Cannot edit another user message');
    });
  });

  describe('DeleteMessageUseCase', () => {
    it('soft deletes message and clears ciphertext', async () => {
      const conv = await getOrCreateDm.execute({ orgId, requesterId: rahimId, recipientId: sarahId });
      const msg = await sendDm.execute({
        orgId,
        senderId: rahimId,
        conversationId: conv.id,
        contentCiphertext: 'secret_info',
      });

      const deleted = await deleteMsg.execute({
        orgId,
        userId: rahimId,
        messageId: msg.id,
      });

      expect(deleted.isDeleted).toBe(true);
      expect(deleted.contentCiphertext).toBe('');
      expect(deleted.deletedAt).toBeDefined();
    });

    it('fails when deleting non-existent message', async () => {
      await expect(
        deleteMsg.execute({
          orgId,
          userId: rahimId,
          messageId: 'missing-id',
        }),
      ).rejects.toThrow('Message missing-id not found');
    });

    it('fails when non-author and non-admin attempts delete', async () => {
      const conv = await getOrCreateDm.execute({ orgId, requesterId: rahimId, recipientId: sarahId });
      const msg = await sendDm.execute({
        orgId,
        senderId: rahimId,
        conversationId: conv.id,
        contentCiphertext: 'hello',
      });

      await expect(
        deleteMsg.execute({
          orgId,
          userId: sarahId,
          userRole: 'member',
          messageId: msg.id,
        }),
      ).rejects.toThrow('Cannot delete this message');
    });

    it('allows admin/owner to delete message from any user', async () => {
      const conv = await getOrCreateDm.execute({ orgId, requesterId: rahimId, recipientId: sarahId });
      const msg = await sendDm.execute({
        orgId,
        senderId: rahimId,
        conversationId: conv.id,
        contentCiphertext: 'violating_message',
      });

      const deleted = await deleteMsg.execute({
        orgId,
        userId: 'admin-1',
        userRole: 'admin',
        messageId: msg.id,
      });

      expect(deleted.isDeleted).toBe(true);
    });
  });

  describe('ReactMessageUseCase', () => {
    it('adds and removes emoji reactions', async () => {
      const conv = await getOrCreateDm.execute({ orgId, requesterId: rahimId, recipientId: sarahId });
      const msg = await sendDm.execute({
        orgId,
        senderId: rahimId,
        conversationId: conv.id,
        contentCiphertext: 'check this',
      });

      const reaction = await reactMsg.addReaction({
        orgId,
        userId: sarahId,
        messageId: msg.id,
        emoji: '👍',
      });

      expect(reaction.emoji).toBe('👍');
      expect(reaction.userId).toBe(sarahId);

      const msgsWithReactions = await getMsgs.execute({
        orgId,
        userId: rahimId,
        conversationId: conv.id,
      });
      expect(msgsWithReactions[0].reactions).toHaveLength(1);
      expect(msgsWithReactions[0].reactions![0].emoji).toBe('👍');

      await reactMsg.removeReaction({
        orgId,
        userId: sarahId,
        messageId: msg.id,
        emoji: '👍',
      });

      const msgsAfterRemove = await getMsgs.execute({
        orgId,
        userId: rahimId,
        conversationId: conv.id,
      });
      expect(msgsAfterRemove[0].reactions).toHaveLength(0);
    });

    it('fails when emoji is empty', async () => {
      await expect(
        reactMsg.addReaction({
          orgId,
          userId: sarahId,
          messageId: 'msg-1',
          emoji: '',
        }),
      ).rejects.toThrow('Emoji is required');
    });

    it('fails when reacting to non-existent message', async () => {
      await expect(
        reactMsg.addReaction({
          orgId,
          userId: sarahId,
          messageId: 'missing-msg',
          emoji: '👍',
        }),
      ).rejects.toThrow('Message missing-msg not found');
    });
  });

  describe('PinMessageUseCase', () => {
    it('allows manager/admin to pin and unpin message', async () => {
      const conv = await getOrCreateDm.execute({ orgId, requesterId: rahimId, recipientId: managerId });
      const msg = await sendDm.execute({
        orgId,
        senderId: rahimId,
        conversationId: conv.id,
        contentCiphertext: 'pinned notice',
      });

      const pinned = await pinMsg.execute({
        orgId,
        userId: managerId,
        userRole: 'manager',
        messageId: msg.id,
        pin: true,
      });

      expect(pinned.isPinned).toBe(true);

      const unpinned = await pinMsg.execute({
        orgId,
        userId: managerId,
        userRole: 'manager',
        messageId: msg.id,
        pin: false,
      });

      expect(unpinned.isPinned).toBe(false);
    });

    it('fails when pinning non-existent message', async () => {
      await expect(
        pinMsg.execute({
          orgId,
          userId: managerId,
          userRole: 'manager',
          messageId: 'missing-msg',
          pin: true,
        }),
      ).rejects.toThrow('Message missing-msg not found');
    });

    it('rejects regular member from pinning', async () => {
      const conv = await getOrCreateDm.execute({ orgId, requesterId: rahimId, recipientId: sarahId });
      const msg = await sendDm.execute({
        orgId,
        senderId: rahimId,
        conversationId: conv.id,
        contentCiphertext: 'notice',
      });

      await expect(
        pinMsg.execute({
          orgId,
          userId: rahimId,
          userRole: 'member',
          messageId: msg.id,
          pin: true,
        }),
      ).rejects.toThrow('Only managers, admins, and owners can pin messages');
    });
  });

  describe('MarkReadUseCase & Read Receipts', () => {
    it('marks message as read and records receipt', async () => {
      const conv = await getOrCreateDm.execute({ orgId, requesterId: rahimId, recipientId: sarahId });
      const msg = await sendDm.execute({
        orgId,
        senderId: rahimId,
        conversationId: conv.id,
        contentCiphertext: 'hello',
      });

      const receipt = await markRead.execute({
        orgId,
        userId: sarahId,
        conversationId: conv.id,
        messageId: msg.id,
      });

      expect(receipt.status).toBe('read');
      expect(receipt.userId).toBe(sarahId);

      const msgs = await getMsgs.execute({
        orgId,
        userId: rahimId,
        conversationId: conv.id,
      });

      expect(msgs[0].receipts).toHaveLength(1);
      expect(msgs[0].receipts![0].status).toBe('read');
    });

    it('fails markRead when message does not exist', async () => {
      const conv = await getOrCreateDm.execute({ orgId, requesterId: rahimId, recipientId: sarahId });
      await expect(
        markRead.execute({
          orgId,
          userId: sarahId,
          conversationId: conv.id,
          messageId: 'missing-msg',
        }),
      ).rejects.toThrow('Message missing-msg not found');
    });
  });

  describe('GetMessagesUseCase & Permissions', () => {
    it('fails when user is not a participant in conversation', async () => {
      const conv = await getOrCreateDm.execute({ orgId, requesterId: rahimId, recipientId: sarahId });

      await expect(
        getMsgs.execute({
          orgId,
          userId: 'outsider-user',
          conversationId: conv.id,
        }),
      ).rejects.toThrow('User is not a participant in this conversation');
    });

    it('fails when conversation does not exist', async () => {
      await expect(
        getMsgs.execute({
          orgId,
          userId: rahimId,
          conversationId: 'non-existent-conv',
        }),
      ).rejects.toThrow('Conversation non-existent-conv not found');
    });
  });

  describe('Prekey Bundle & X3DH Key Exchange', () => {
    it('registers and retrieves X3DH prekey bundle with OTPK consumption', async () => {
      await registerPrekeys.execute({
        userId: sarahId,
        identityKey: 'identity_pub_key_base64',
        signedPrekey: 'signed_prekey_base64',
        signedPrekeySignature: 'sig_base64',
        oneTimePrekeys: [
          { keyId: 1, publicKey: 'otpk_1' },
          { keyId: 2, publicKey: 'otpk_2' },
        ],
      });

      const bundle1 = await getPrekeys.execute(sarahId);
      expect(bundle1.identityKey).toBe('identity_pub_key_base64');
      expect(bundle1.oneTimePrekey?.publicKey).toBe('otpk_1');

      const bundle2 = await getPrekeys.execute(sarahId);
      expect(bundle2.oneTimePrekey?.publicKey).toBe('otpk_2');

      const bundle3 = await getPrekeys.execute(sarahId);
      expect(bundle3.oneTimePrekey).toBeUndefined(); // All OTPKs consumed
    });

    it('fails when prekey bundle is missing mandatory keys', async () => {
      await expect(
        registerPrekeys.execute({
          userId: sarahId,
          identityKey: '',
          signedPrekey: 'key',
          signedPrekeySignature: 'sig',
          oneTimePrekeys: [],
        }),
      ).rejects.toThrow('Identity key, signed prekey, and signature are required');
    });

    it('fails when retrieving non-existent prekey bundle', async () => {
      await expect(getPrekeys.execute('missing-user')).rejects.toThrow('No prekey bundle found');
    });
  });

  describe('ListConversationsUseCase', () => {
    it('lists conversations with latest snippet and unread counts', async () => {
      const conv = await getOrCreateDm.execute({ orgId, requesterId: rahimId, recipientId: sarahId });
      await sendDm.execute({
        orgId,
        senderId: rahimId,
        conversationId: conv.id,
        contentCiphertext: 'latest_msg_cipher',
      });

      const list = await listConvs.execute(orgId, sarahId);
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(conv.id);
      expect(list[0].lastMessage?.contentCiphertext).toBe('latest_msg_cipher');
      expect(list[0].unreadCount).toBe(1);
    });
  });
});
