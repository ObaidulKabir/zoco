export type ScanStatus = 'PENDING_SCAN' | 'CLEAN' | 'QUARANTINED';

export interface MediaFile {
  id: string;
  orgId: string;
  uploaderId: string;
  bucket: string;
  objectKey: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sha256Checksum: string;
  scanStatus: ScanStatus;
  quarantineReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const MAX_ATTACHMENT_SIZE_BYTES = 50 * 1024 * 1024; // 50MB per file
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/zip',
  'text/plain',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'audio/webm',
  'video/mp4',
];
