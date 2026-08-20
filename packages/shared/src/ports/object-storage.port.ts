export type StoredObject = {
  key: string;
  size: number;
  contentType: string;
};

export interface ObjectStoragePort {
  put(key: string, body: Buffer, contentType: string): Promise<StoredObject>;
  getSignedUrl(key: string, expiresSeconds: number): Promise<string>;
}
