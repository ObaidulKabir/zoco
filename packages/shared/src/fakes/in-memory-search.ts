import type { SearchHit, SearchPort } from '../ports/search.port.js';

type Doc = { id: string; tenantId: string; text: string };

export class InMemorySearch implements SearchPort {
  readonly docs: Doc[] = [];

  async index(id: string, tenantId: string, text: string): Promise<void> {
    this.docs.push({ id, tenantId, text });
  }

  async query(tenantId: string, q: string): Promise<SearchHit[]> {
    const needle = q.toLowerCase();
    return this.docs
      .filter((d) => d.tenantId === tenantId && d.text.toLowerCase().includes(needle))
      .map((d) => ({ id: d.id, score: 1 }));
  }
}
