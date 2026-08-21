import type { ChannelPolicy, InvitePolicy, OrgSize } from './policy';

export type OrgSettings = {
  invitationPolicy: InvitePolicy;
  defaultTimezone: string;
  defaultLanguage: string;
  externalCommunication: boolean;
  maxFileSizeMb: number;
  channelCreationPolicy: ChannelPolicy;
};

export class Organization {
  constructor(
    readonly id: string,
    public name: string,
    readonly slug: string,
    readonly industry: string,
    readonly size: OrgSize,
    readonly country: string,
    readonly timezone: string,
    public logoUrl: string | null,
    public settings: OrgSettings,
    readonly createdAt: Date,
  ) {}

  static defaults(timezone: string): OrgSettings {
    return {
      invitationPolicy: 'admins_only',
      defaultTimezone: timezone,
      defaultLanguage: 'en',
      externalCommunication: true,
      maxFileSizeMb: 25,
      channelCreationPolicy: 'anyone',
    };
  }

  toPublic() {
    return {
      id: this.id,
      name: this.name,
      slug: this.slug,
      industry: this.industry,
      size: this.size,
      country: this.country,
      timezone: this.timezone,
      logoUrl: this.logoUrl,
      settings: this.settings,
    };
  }
}
