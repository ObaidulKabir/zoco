export class DiscoverProfile {
  constructor(
    readonly orgId: string,
    readonly displayName: string,
    readonly industry: string,
    readonly country: string,
    readonly published: boolean,
  ) {}

  toPublic() {
    return {
      orgId: this.orgId,
      displayName: this.displayName,
      industry: this.industry,
      country: this.country,
      published: this.published,
    };
  }
}
