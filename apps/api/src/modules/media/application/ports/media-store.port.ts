import type { MediaFile } from '../../domain/media-file';

export interface MediaStorePort {
  saveMedia(file: MediaFile): Promise<void>;
  findMediaById(orgId: string, id: string): Promise<MediaFile | null>;
  findMediaByObjectKey(objectKey: string): Promise<MediaFile | null>;
  updateScanStatus(id: string, status: 'CLEAN' | 'QUARANTINED', reason?: string): Promise<void>;
  clear(): Promise<void>;
}
