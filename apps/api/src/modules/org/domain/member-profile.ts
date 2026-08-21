import type { Presence } from './policy';

export class MemberProfile {
  constructor(
    readonly userId: string,
    readonly orgId: string,
    public displayName: string,
    public title: string,
    public phone: string,
    public avatarUrl: string | null,
    public timezone: string,
    public language: string,
    public bio: string,
    public presence: Presence,
  ) {}

  toPublic() {
    return {
      userId: this.userId,
      orgId: this.orgId,
      displayName: this.displayName,
      title: this.title,
      phone: this.phone,
      avatarUrl: this.avatarUrl,
      timezone: this.timezone,
      language: this.language,
      bio: this.bio,
      presence: this.presence,
    };
  }
}
