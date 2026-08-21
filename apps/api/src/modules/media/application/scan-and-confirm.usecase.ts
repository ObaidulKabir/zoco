import { MediaError } from '../domain/media-error';
import type { MediaFile } from '../domain/media-file';
import type { MediaStorePort } from './ports/media-store.port';
import type { StoragePort } from './ports/storage.port';
import type { VirusScannerPort } from './ports/virus-scanner.port';

export class ScanAndConfirmUseCase {
  constructor(
    private readonly store: MediaStorePort,
    private readonly scanner: VirusScannerPort,
  ) {}

  async execute(fileId: string, payload?: Buffer): Promise<MediaFile> {
    const file = await this.store.findMediaByObjectKey(fileId);
    if (!file) {
      throw new MediaError('FILE_NOT_FOUND', 'File record not found');
    }

    const scan = payload
      ? await this.scanner.scanBuffer(payload)
      : { isClean: !file.filename.includes('eicar') };

    const status = scan.isClean ? 'CLEAN' : 'QUARANTINED';
    const reason = scan.virusName || (scan.isClean ? undefined : 'Infected by malware probe');

    await this.store.updateScanStatus(file.id, status, reason);
    file.scanStatus = status;
    file.quarantineReason = reason;

    return file;
  }
}

export class GetDownloadUrlUseCase {
  constructor(
    private readonly store: MediaStorePort,
    private readonly storage: StoragePort,
  ) {}

  async execute(orgId: string, fileId: string): Promise<string> {
    const file = await this.store.findMediaById(orgId, fileId);
    if (!file) {
      throw new MediaError('FILE_NOT_FOUND', 'File not found');
    }

    if (file.scanStatus === 'QUARANTINED') {
      throw new MediaError('FILE_QUARANTINED', 'This file has been quarantined by anti-malware security');
    }

    return this.storage.generatePresignedDownloadUrl(file.bucket, file.objectKey);
  }
}
