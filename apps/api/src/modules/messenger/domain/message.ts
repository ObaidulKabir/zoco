export type ContentType = 'text' | 'system' | 'file' | 'call_event';

export interface EncryptedEnvelope {
  contentCiphertext: string;
  envelopeIv: string;
  envelopeTag: string;
}

export interface MessageReaction {
  id: string;
  messageId: string;
  orgId: string;
  userId: string;
  emoji: string;
  createdAt: Date;
}

export interface MessageReceipt {
  id: string;
  messageId: string;
  orgId: string;
  userId: string;
  status: 'delivered' | 'read';
  readAt: Date;
}

export interface DirectMessage {
  id: string;
  conversationId: string;
  orgId: string;
  senderId: string;
  contentCiphertext: string;
  envelopeIv: string;
  envelopeTag: string;
  contentType: ContentType;
  replyToId?: string;
  isEdited: boolean;
  editedAt?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  isPinned: boolean;
  reactions?: MessageReaction[];
  receipts?: MessageReceipt[];
  createdAt: Date;
  updatedAt: Date;
}

export const EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes per MSG-DM-002
