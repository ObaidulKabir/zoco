import { withTenantClient } from '../../../../db/pool';
import type { Conversation, ConversationParticipant, ConversationSummary } from '../../domain/conversation';
import type { DirectMessage, MessageReaction, MessageReceipt } from '../../domain/message';
import type { PrekeyBundle } from '../../domain/prekey-bundle';
import type { MessengerStorePort } from '../../application/ports/messenger-store.port';

export class PgMessengerStore implements MessengerStorePort {
  async createConversation(conv: Conversation): Promise<void> {
    await withTenantClient(conv.orgId, async (client) => {
      await client.query('begin');
      try {
        await client.query(
          `insert into conversations (id, org_id, type, channel_id, created_by, created_at, updated_at)
           values ($1, $2, $3, $4, $5, $6, $7)`,
          [conv.id, conv.orgId, conv.type, conv.channelId || null, conv.createdBy, conv.createdAt, conv.updatedAt],
        );

        for (const p of conv.participants) {
          await client.query(
            `insert into conversation_participants (id, conversation_id, user_id, org_id, joined_at, last_read_at, is_muted)
             values (gen_random_uuid(), $1, $2, $3, $4, $5, $6)`,
            [conv.id, p.userId, p.orgId, p.joinedAt, p.lastReadAt || null, p.isMuted],
          );
        }
        await client.query('commit');
      } catch (err) {
        await client.query('rollback');
        throw err;
      }
    });
  }

  async findConversationById(orgId: string, id: string): Promise<Conversation | null> {
    return withTenantClient(orgId, async (client) => {
      const convRes = await client.query<{
        id: string;
        org_id: string;
        type: string;
        channel_id: string | null;
        created_by: string;
        created_at: Date;
        updated_at: Date;
      }>('select * from conversations where id = $1 and org_id = $2', [id, orgId]);

      if (convRes.rows.length === 0) return null;
      const row = convRes.rows[0];

      const partRes = await client.query<{
        user_id: string;
        org_id: string;
        joined_at: Date;
        last_read_at: Date | null;
        is_muted: boolean;
      }>('select * from conversation_participants where conversation_id = $1', [id]);

      return {
        id: row.id,
        orgId: row.org_id,
        type: row.type as any,
        channelId: row.channel_id || undefined,
        createdBy: row.created_by,
        participants: partRes.rows.map((p) => ({
          userId: p.user_id,
          orgId: p.org_id,
          joinedAt: p.joined_at,
          lastReadAt: p.last_read_at || undefined,
          isMuted: p.is_muted,
        })),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
  }

  async findDirectConversation(orgId: string, userA: string, userB: string): Promise<Conversation | null> {
    return withTenantClient(orgId, async (client) => {
      const res = await client.query<{ id: string }>(
        `select c.id from conversations c
         join conversation_participants p1 on p1.conversation_id = c.id and p1.user_id = $1
         join conversation_participants p2 on p2.conversation_id = c.id and p2.user_id = $2
         where c.org_id = $3 and c.type = 'dm' limit 1`,
        [userA, userB, orgId],
      );

      if (res.rows.length === 0) return null;
      return this.findConversationById(orgId, res.rows[0].id);
    });
  }

  async listConversationsForUser(orgId: string, userId: string): Promise<ConversationSummary[]> {
    return withTenantClient(orgId, async (client) => {
      const res = await client.query<{
        id: string;
        org_id: string;
        type: string;
        channel_id: string | null;
        updated_at: Date;
        other_user_id: string | null;
        display_name: string | null;
        avatar_url: string | null;
        presence: string | null;
        last_msg_id: string | null;
        last_msg_sender_id: string | null;
        last_msg_ciphertext: string | null;
        last_msg_content_type: string | null;
        last_msg_created_at: Date | null;
        last_read_at: Date | null;
      }>(
        `select c.id, c.org_id, c.type, c.channel_id, c.updated_at,
                p_self.last_read_at,
                p_other.user_id as other_user_id,
                prof.display_name, prof.avatar_url, prof.presence,
                m.id as last_msg_id, m.sender_id as last_msg_sender_id,
                m.content_ciphertext as last_msg_ciphertext, m.content_type as last_msg_content_type,
                m.created_at as last_msg_created_at
         from conversations c
         join conversation_participants p_self on p_self.conversation_id = c.id and p_self.user_id = $1
         left join conversation_participants p_other on p_other.conversation_id = c.id and p_other.user_id != $1
         left join member_profiles prof on prof.org_id = c.org_id and prof.user_id = p_other.user_id
         left join lateral (
           select id, sender_id, content_ciphertext, content_type, created_at
           from messages where conversation_id = c.id
           order by created_at desc limit 1
         ) m on true
         where c.org_id = $2
         order by c.updated_at desc`,
        [userId, orgId],
      );

      return res.rows.map((row) => ({
        id: row.id,
        orgId: row.org_id,
        type: row.type as any,
        channelId: row.channel_id || undefined,
        otherParticipant: row.other_user_id
          ? {
              userId: row.other_user_id,
              displayName: row.display_name || undefined,
              avatarUrl: row.avatar_url || undefined,
              presence: row.presence || undefined,
            }
          : undefined,
        lastMessage: row.last_msg_id
          ? {
              id: row.last_msg_id,
              senderId: row.last_msg_sender_id!,
              contentCiphertext: row.last_msg_ciphertext!,
              contentType: row.last_msg_content_type!,
              createdAt: row.last_msg_created_at!,
            }
          : undefined,
        unreadCount: 0,
        updatedAt: row.updated_at,
      }));
    });
  }

  async saveMessage(msg: DirectMessage): Promise<void> {
    await withTenantClient(msg.orgId, async (client) => {
      await client.query('begin');
      try {
        await client.query(
          `insert into messages (id, conversation_id, org_id, sender_id, content_ciphertext, envelope_iv, envelope_tag, content_type, reply_to_id, is_edited, is_deleted, is_pinned, created_at, updated_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [
            msg.id,
            msg.conversationId,
            msg.orgId,
            msg.senderId,
            msg.contentCiphertext,
            msg.envelopeIv,
            msg.envelopeTag,
            msg.contentType,
            msg.replyToId || null,
            msg.isEdited,
            msg.isDeleted,
            msg.isPinned,
            msg.createdAt,
            msg.updatedAt,
          ],
        );
        await client.query('update conversations set updated_at = $1 where id = $2', [msg.createdAt, msg.conversationId]);
        await client.query('commit');
      } catch (err) {
        await client.query('rollback');
        throw err;
      }
    });
  }

  async findMessageById(orgId: string, id: string): Promise<DirectMessage | null> {
    return withTenantClient(orgId, async (client) => {
      const res = await client.query<{
        id: string;
        conversation_id: string;
        org_id: string;
        sender_id: string;
        content_ciphertext: string;
        envelope_iv: string;
        envelope_tag: string;
        content_type: string;
        reply_to_id: string | null;
        is_edited: boolean;
        edited_at: Date | null;
        is_deleted: boolean;
        deleted_at: Date | null;
        is_pinned: boolean;
        created_at: Date;
        updated_at: Date;
      }>('select * from messages where id = $1 and org_id = $2', [id, orgId]);

      if (res.rows.length === 0) return null;
      const row = res.rows[0];

      return {
        id: row.id,
        conversationId: row.conversation_id,
        orgId: row.org_id,
        senderId: row.sender_id,
        contentCiphertext: row.content_ciphertext,
        envelopeIv: row.envelope_iv,
        envelopeTag: row.envelope_tag,
        contentType: row.content_type as any,
        replyToId: row.reply_to_id || undefined,
        isEdited: row.is_edited,
        editedAt: row.edited_at || undefined,
        isDeleted: row.is_deleted,
        deletedAt: row.deleted_at || undefined,
        isPinned: row.is_pinned,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
  }

  async updateMessage(msg: DirectMessage): Promise<void> {
    await withTenantClient(msg.orgId, async (client) => {
      await client.query(
        `update messages set
           content_ciphertext = $1,
           envelope_iv = $2,
           envelope_tag = $3,
           is_edited = $4,
           edited_at = $5,
           is_deleted = $6,
           deleted_at = $7,
           is_pinned = $8,
           updated_at = $9
         where id = $10 and org_id = $11`,
        [
          msg.contentCiphertext,
          msg.envelopeIv,
          msg.envelopeTag,
          msg.isEdited,
          msg.editedAt || null,
          msg.isDeleted,
          msg.deletedAt || null,
          msg.isPinned,
          msg.updatedAt,
          msg.id,
          msg.orgId,
        ],
      );
    });
  }

  async listMessages(
    orgId: string,
    conversationId: string,
    options?: { limit?: number; before?: Date },
  ): Promise<DirectMessage[]> {
    return withTenantClient(orgId, async (client) => {
      let sql = `select * from messages where org_id = $1 and conversation_id = $2`;
      const params: any[] = [orgId, conversationId];

      if (options?.before) {
        params.push(options.before);
        sql += ` and created_at < $${params.length}`;
      }

      sql += ` order by created_at desc`;
      if (options?.limit) {
        params.push(options.limit);
        sql += ` limit $${params.length}`;
      }

      const res = await client.query<{
        id: string;
        conversation_id: string;
        org_id: string;
        sender_id: string;
        content_ciphertext: string;
        envelope_iv: string;
        envelope_tag: string;
        content_type: string;
        reply_to_id: string | null;
        is_edited: boolean;
        edited_at: Date | null;
        is_deleted: boolean;
        deleted_at: Date | null;
        is_pinned: boolean;
        created_at: Date;
        updated_at: Date;
      }>(sql, params);

      return res.rows.reverse().map((row) => ({
        id: row.id,
        conversationId: row.conversation_id,
        orgId: row.org_id,
        senderId: row.sender_id,
        contentCiphertext: row.content_ciphertext,
        envelopeIv: row.envelope_iv,
        envelopeTag: row.envelope_tag,
        contentType: row.content_type as any,
        replyToId: row.reply_to_id || undefined,
        isEdited: row.is_edited,
        editedAt: row.edited_at || undefined,
        isDeleted: row.is_deleted,
        deletedAt: row.deleted_at || undefined,
        isPinned: row.is_pinned,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    });
  }

  async addReaction(reaction: MessageReaction): Promise<void> {
    await withTenantClient(reaction.orgId, async (client) => {
      await client.query(
        `insert into message_reactions (id, message_id, org_id, user_id, emoji, created_at)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (message_id, user_id, emoji) do nothing`,
        [reaction.id, reaction.messageId, reaction.orgId, reaction.userId, reaction.emoji, reaction.createdAt],
      );
    });
  }

  async removeReaction(orgId: string, messageId: string, userId: string, emoji: string): Promise<void> {
    await withTenantClient(orgId, async (client) => {
      await client.query(
        `delete from message_reactions where org_id = $1 and message_id = $2 and user_id = $3 and emoji = $4`,
        [orgId, messageId, userId, emoji],
      );
    });
  }

  async listReactionsForMessages(orgId: string, messageIds: string[]): Promise<MessageReaction[]> {
    if (messageIds.length === 0) return [];
    return withTenantClient(orgId, async (client) => {
      const res = await client.query<{
        id: string;
        message_id: string;
        org_id: string;
        user_id: string;
        emoji: string;
        created_at: Date;
      }>(`select * from message_reactions where org_id = $1 and message_id = any($2)`, [orgId, messageIds]);

      return res.rows.map((r) => ({
        id: r.id,
        messageId: r.message_id,
        orgId: r.org_id,
        userId: r.user_id,
        emoji: r.emoji,
        createdAt: r.created_at,
      }));
    });
  }

  async saveReceipt(receipt: MessageReceipt): Promise<void> {
    await withTenantClient(receipt.orgId, async (client) => {
      await client.query(
        `insert into message_receipts (id, message_id, org_id, user_id, status, read_at)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (message_id, user_id, status) do update set read_at = excluded.read_at`,
        [receipt.id, receipt.messageId, receipt.orgId, receipt.userId, receipt.status, receipt.readAt],
      );
    });
  }

  async listReceiptsForMessages(orgId: string, messageIds: string[]): Promise<MessageReceipt[]> {
    if (messageIds.length === 0) return [];
    return withTenantClient(orgId, async (client) => {
      const res = await client.query<{
        id: string;
        message_id: string;
        org_id: string;
        user_id: string;
        status: string;
        read_at: Date;
      }>(`select * from message_receipts where org_id = $1 and message_id = any($2)`, [orgId, messageIds]);

      return res.rows.map((r) => ({
        id: r.id,
        messageId: r.message_id,
        orgId: r.org_id,
        userId: r.user_id,
        status: r.status as any,
        readAt: r.read_at,
      }));
    });
  }

  async updateParticipantLastRead(conversationId: string, userId: string, readAt: Date): Promise<void> {
    // We update across the conversation
    await withTenantClient(null, async (client) => {
      await client.query(
        `update conversation_participants set last_read_at = $1 where conversation_id = $2 and user_id = $3`,
        [readAt, conversationId, userId],
      );
    });
  }

  async savePrekeyBundle(bundle: PrekeyBundle): Promise<void> {
    await withTenantClient(null, async (client) => {
      await client.query(
        `insert into prekey_bundles (user_id, identity_key, signed_prekey, signed_prekey_signature, one_time_prekeys, updated_at)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (user_id) do update set
           identity_key = excluded.identity_key,
           signed_prekey = excluded.signed_prekey,
           signed_prekey_signature = excluded.signed_prekey_signature,
           one_time_prekeys = excluded.one_time_prekeys,
           updated_at = excluded.updated_at`,
        [
          bundle.userId,
          bundle.identityKey,
          bundle.signedPrekey,
          bundle.signedPrekeySignature,
          JSON.stringify(bundle.oneTimePrekeys),
          bundle.updatedAt,
        ],
      );
    });
  }

  async findPrekeyBundle(userId: string): Promise<PrekeyBundle | null> {
    return withTenantClient(null, async (client) => {
      const res = await client.query<{
        user_id: string;
        identity_key: string;
        signed_prekey: string;
        signed_prekey_signature: string;
        one_time_prekeys: any;
        updated_at: Date;
      }>('select * from prekey_bundles where user_id = $1', [userId]);

      if (res.rows.length === 0) return null;
      const row = res.rows[0];

      return {
        userId: row.user_id,
        identityKey: row.identity_key,
        signedPrekey: row.signed_prekey,
        signedPrekeySignature: row.signed_prekey_signature,
        oneTimePrekeys: typeof row.one_time_prekeys === 'string' ? JSON.parse(row.one_time_prekeys) : row.one_time_prekeys,
        updatedAt: row.updated_at,
      };
    });
  }

  async consumeOneTimePrekey(userId: string): Promise<{
    identityKey: string;
    signedPrekey: string;
    signedPrekeySignature: string;
    oneTimePrekey?: { keyId: number; publicKey: string };
  } | null> {
    return withTenantClient(null, async (client) => {
      await client.query('begin');
      try {
        const res = await client.query<{
          user_id: string;
          identity_key: string;
          signed_prekey: string;
          signed_prekey_signature: string;
          one_time_prekeys: any;
        }>('select * from prekey_bundles where user_id = $1 for update', [userId]);

        if (res.rows.length === 0) {
          await client.query('rollback');
          return null;
        }

        const row = res.rows[0];
        const otps = Array.isArray(row.one_time_prekeys)
          ? row.one_time_prekeys
          : typeof row.one_time_prekeys === 'string'
            ? JSON.parse(row.one_time_prekeys)
            : [];

        let consumedOtp: { keyId: number; publicKey: string } | undefined;
        if (otps.length > 0) {
          consumedOtp = otps.shift();
          await client.query('update prekey_bundles set one_time_prekeys = $1 where user_id = $2', [
            JSON.stringify(otps),
            userId,
          ]);
        }

        await client.query('commit');
        return {
          identityKey: row.identity_key,
          signedPrekey: row.signed_prekey,
          signedPrekeySignature: row.signed_prekey_signature,
          oneTimePrekey: consumedOtp,
        };
      } catch (err) {
        await client.query('rollback');
        throw err;
      }
    });
  }
}
