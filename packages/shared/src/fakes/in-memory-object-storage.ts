import type { ObjectStoragePort, StoredObject } from '../ports/object-storage.port.js';

export class InMemoryObjectStorage implements ObjectStoragePort {
  readonly objects = new Map<string, { body: Buffer; contentType: string }>();

  async put(key: string, body: Buffer, contentType: string): Promise<StoredObject> {
    this.objects.set(key, { body, contentType });
    return { key, size: body.length, contentType };
  }

  async getSignedUrl(key: string, _expiresSeconds: number): Promise<string> {
    if (!this.objects.has(key)) {
      throw new Error(`object not found: ${key}`);
    }
    return `memory://${key}`;
  }
}
