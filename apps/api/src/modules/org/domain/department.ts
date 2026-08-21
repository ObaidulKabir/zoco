export class Department {
  constructor(
    readonly id: string,
    readonly orgId: string,
    public name: string,
    public description: string,
    public parentId: string | null,
    readonly level: number,
  ) {}

  toPublic() {
    return {
      id: this.id,
      orgId: this.orgId,
      name: this.name,
      description: this.description,
      parentId: this.parentId,
      level: this.level,
    };
  }
}
