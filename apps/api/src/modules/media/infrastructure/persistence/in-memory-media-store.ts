import type { MediaStorePort } from '../../application/ports/media-store.port';
import type { MediaFile } from '../../domain/media-file';

export class InMemoryMediaStore implements MediaStorePort {
  private files = new Map<string, MediaFile>();

  async saveMedia(file: MediaFile): Promise<void> {
    this.files.set(file.id, { ...file });
  }

  async findMediaById(orgId: string, id: string): Promise<MediaFile | null> {
    const f = this.files.get(id);
    if (f && f.orgId === orgId) return { ...f };
    return null;
  }

  async findMediaByObjectKey(objectKey: string): Promise<MediaFile | null> {
    for (const f of this.files.values()) {
      if (f.objectKey === objectKey || f.id === objectKey || f.filename === objectKey) {
        return { ...f };
      }
    }
    return null;
  }

  async updateScanStatus(id: string, status: 'CLEAN' | 'QUARANTINED', reason?: string): Promise<void> {
    const f = this.files.get(id);
    if (f) {
      f.scanStatus = status;
      f.quarantineReason = reason;
      this.files.set(id, f);
    }
  }

  async clear(): Promise<void> {
    this.files.clear();
  }
}
