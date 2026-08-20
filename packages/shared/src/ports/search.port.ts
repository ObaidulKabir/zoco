export type SearchHit = {
  id: string;
  score: number;
};

export interface SearchPort {
  index(id: string, tenantId: string, text: string): Promise<void>;
  query(tenantId: string, q: string): Promise<SearchHit[]>;
}
