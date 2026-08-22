import type { B2bConnection, B2bConnectionStatus } from '../../domain/b2b-connection';

export interface B2bStorePort {
  saveConnection(conn: B2bConnection): Promise<void>;
  findConnectionById(id: string): Promise<B2bConnection | null>;
  findConnectionBetweenOrgs(orgAId: string, orgBId: string): Promise<B2bConnection | null>;
  listConnectionsForOrg(orgId: string, status?: B2bConnectionStatus): Promise<B2bConnection[]>;
  countDailyRequests(orgId: string, dateStr: string): Promise<number>;
  deleteConnection(id: string): Promise<void>;
}
