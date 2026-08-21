export class Team {
  constructor(
    readonly id: string,
    readonly orgId: string,
    public departmentId: string,
    public name: string,
    public description: string,
  ) {}

  toPublic() {
    return {
      id: this.id,
      orgId: this.orgId,
      departmentId: this.departmentId,
      name: this.name,
      description: this.description,
    };
  }
}
