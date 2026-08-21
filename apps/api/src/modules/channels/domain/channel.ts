import { ChannelError } from './channel-error';

export type ChannelType = 'public' | 'private' | 'announcement' | 'shared';

export interface Channel {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  topic?: string;
  description?: string;
  type: ChannelType;
  isArchived: boolean;
  createdBy: string;
  sharedOrgIds?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const RESERVED_SLUGS = ['general', 'announcements', 'all', 'everyone', 'here'];

export function slugifyChannelName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

  if (slug.length < 2) {
    throw new ChannelError('INVALID_CHANNEL_NAME', 'Channel slug must be at least 2 characters');
  }
  return slug;
}

export function validateChannelCreation(name: string, type: ChannelType): string {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 80) {
    throw new ChannelError('VALIDATION_ERROR', 'Channel name must be between 2 and 80 characters');
  }
  const slug = slugifyChannelName(trimmed);
  return slug;
}
