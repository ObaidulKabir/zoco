import { Injectable } from '@nestjs/common';
import type { B2bConnection, B2bConnectionStatus } from '../../domain/b2b-connection';
import type { B2bStorePort } from '../../application/ports/b2b-store.port';

@Injectable()
export class InMemoryB2bStore implements B2bStorePort {
  private connections: Map<string, B2bConnection> = new Map();

  async saveConnection(conn: B2bConnection): Promise<void> {
    this.connections.set(conn.id, conn);
  }

  async findConnectionById(id: string): Promise<B2bConnection | null> {
    return this.connections.get(id) ?? null;
  }

  async findConnectionBetweenOrgs(orgAId: string, orgBId: string): Promise<B2bConnection | null> {
    for (const conn of this.connections.values()) {
      if (
        (conn.senderOrgId === orgAId && conn.receiverOrgId === orgBId) ||
        (conn.senderOrgId === orgBId && conn.receiverOrgId === orgAId)
      ) {
        return conn;
      }
    }
    return null;
  }

  async listConnectionsForOrg(orgId: string, status?: B2bConnectionStatus): Promise<B2bConnection[]> {
    const results: B2bConnection[] = [];
    for (const conn of this.connections.values()) {
      if (conn.senderOrgId === orgId || conn.receiverOrgId === orgId) {
        if (!status || conn.status === status) {
          results.push(conn);
        }
      }
    }
    return results;
  }

  async countDailyRequests(orgId: string, dateStr: string): Promise<number> {
    let count = 0;
    for (const conn of this.connections.values()) {
      if (conn.senderOrgId === orgId && conn.lastRequestDate === dateStr) {
        count++;
      }
    }
    return count;
  }

  async deleteConnection(id: string): Promise<void> {
    this.connections.delete(id);
  }

  async clear(): Promise<void> {
    this.connections.clear();
  }
}
