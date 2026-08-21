import { randomUUID } from 'node:crypto';
import type { ClockPort } from '@zoqo/shared';
import { MediaError } from '../domain/media-error';
import { ALLOWED_MIME_TYPES, MAX_ATTACHMENT_SIZE_BYTES, type MediaFile } from '../domain/media-file';
import type { MediaStorePort } from './ports/media-store.port';
import type { StoragePort, UploadUrlResult } from './ports/storage.port';

export interface RequestUploadUrlCommand {
  orgId: string;
  userId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export interface RequestUploadUrlResponse extends UploadUrlResult {
  fileId: string;
}

export class RequestUploadUrlUseCase {
  constructor(
    private readonly store: MediaStorePort,
    private readonly storage: StoragePort,
    private readonly clock: ClockPort,
  ) {}

  async execute(cmd: RequestUploadUrlCommand): Promise<RequestUploadUrlResponse> {
    if (cmd.sizeBytes > MAX_ATTACHMENT_SIZE_BYTES) {
      throw new MediaError('FILE_TOO_LARGE', `File size exceeds max limit of ${MAX_ATTACHMENT_SIZE_BYTES / 1024 / 1024}MB`);
    }

    if (!ALLOWED_MIME_TYPES.includes(cmd.mimeType.toLowerCase())) {
      throw new MediaError('INVALID_FILE_TYPE', `MIME type ${cmd.mimeType} is not supported`);
    }

    const fileId = randomUUID();
    const objectKey = `${cmd.orgId}/${fileId}/${cmd.filename}`;
    const bucket = 'zoqo-media';

    const presigned = await this.storage.generatePresignedUploadUrl(bucket, objectKey, cmd.mimeType, cmd.sizeBytes);

    const now = this.clock.now();
    const file: MediaFile = {
      id: fileId,
      orgId: cmd.orgId,
      uploaderId: cmd.userId,
      bucket,
      objectKey,
      filename: cmd.filename,
      mimeType: cmd.mimeType,
      sizeBytes: cmd.sizeBytes,
      sha256Checksum: '',
      scanStatus: 'PENDING_SCAN',
      createdAt: now,
      updatedAt: now,
    };

    await this.store.saveMedia(file);

    return {
      fileId,
      ...presigned,
    };
  }
}
