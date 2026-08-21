export class Channel {
  constructor(
    readonly id: string,
    readonly orgId: string,
    readonly name: string,
    readonly slug: string,
    readonly memberIds: string[],
  ) {}

  addMember(userId: string): void {
    if (!this.memberIds.includes(userId)) this.memberIds.push(userId);
  }

  toPublic() {
    return {
      id: this.id,
      orgId: this.orgId,
      name: this.name,
      slug: this.slug,
      memberIds: [...this.memberIds],
    };
  }
}
