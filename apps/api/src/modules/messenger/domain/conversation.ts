export type ConversationType = 'dm' | 'channel' | 'b2b_dm' | 'b2b_shared';

export interface ConversationParticipant {
  userId: string;
  orgId: string;
  joinedAt: Date;
  lastReadAt?: Date;
  isMuted: boolean;
}

export interface Conversation {
  id: string;
  orgId: string;
  type: ConversationType;
  channelId?: string;
  createdBy: string;
  participants: ConversationParticipant[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationSummary {
  id: string;
  orgId: string;
  type: ConversationType;
  channelId?: string;
  otherParticipant?: {
    userId: string;
    displayName?: string;
    avatarUrl?: string;
    presence?: string;
  };
  lastMessage?: {
    id: string;
    senderId: string;
    contentCiphertext: string;
    contentType: string;
    createdAt: Date;
  };
  unreadCount: number;
  updatedAt: Date;
}
