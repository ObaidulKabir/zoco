import type { B2bStorePort } from './ports/b2b-store.port';

export class CheckB2bConnectionUseCase {
  constructor(private readonly store: B2bStorePort) {}

  async areConnected(orgAId: string, orgBId: string): Promise<boolean> {
    if (orgAId === orgBId) return true;
    const conn = await this.store.findConnectionBetweenOrgs(orgAId, orgBId);
    return conn ? conn.isConnected() : false;
  }
}
