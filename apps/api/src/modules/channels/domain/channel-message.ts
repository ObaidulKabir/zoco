import type { ContentType, MessageReaction, MessageReceipt } from '../../messenger/domain/message';

export interface ChannelMessage {
  id: string;
  channelId: string;
  orgId: string;
  senderId: string;
  content: string;
  contentCiphertext?: string;
  envelopeIv?: string;
  envelopeTag?: string;
  contentType: ContentType;
  threadId?: string;
  replyToId?: string;
  isBroadcast: boolean;
  replyCount: number;
  lastReplyAt?: Date;
  isEdited: boolean;
  editedAt?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  isPinned: boolean;
  reactions?: MessageReaction[];
  receipts?: MessageReceipt[];
  mentions?: string[];
  createdAt: Date;
  updatedAt: Date;
}
