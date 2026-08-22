export type MentionType = 'user' | 'channel' | 'here' | 'role';

export interface ParsedMention {
  raw: string;
  type: MentionType;
  target?: string;
}

export function parseMentions(text: string): ParsedMention[] {
  if (!text) return [];
  const mentions: ParsedMention[] = [];
  const regex = /@([a-zA-Z0-9_\-\.]+)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const raw = match[0];
    const identifier = (match[1] ?? '').toLowerCase();

    if (identifier === 'channel' || identifier === 'all' || identifier === 'everyone') {
      mentions.push({ raw, type: 'channel' });
    } else if (identifier === 'here') {
      mentions.push({ raw, type: 'here' });
    } else if (['admin', 'admins', 'manager', 'managers', 'owner'].includes(identifier)) {
      mentions.push({ raw, type: 'role', target: identifier });
    } else {
      mentions.push({ raw, type: 'user', target: match[1] ?? '' });
    }
  }

  return mentions;
}
