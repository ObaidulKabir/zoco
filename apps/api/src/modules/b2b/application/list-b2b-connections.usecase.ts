import type { B2bConnection, B2bConnectionStatus } from '../domain/b2b-connection';
import type { B2bStorePort } from './ports/b2b-store.port';

export class ListB2bConnectionsUseCase {
  constructor(private readonly store: B2bStorePort) {}

  async execute(orgId: string, status?: B2bConnectionStatus): Promise<B2bConnection[]> {
    return this.store.listConnectionsForOrg(orgId, status);
  }
}
