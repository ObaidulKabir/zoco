export interface UploadUrlResult {
  uploadUrl: string;
  objectKey: string;
  bucket: string;
  expiresInSeconds: number;
}

export interface StoragePort {
  generatePresignedUploadUrl(bucket: string, objectKey: string, mimeType: string, sizeBytes: number): Promise<UploadUrlResult>;
  generatePresignedDownloadUrl(bucket: string, objectKey: string, expiresInSeconds?: number): Promise<string>;
  deleteObject(bucket: string, objectKey: string): Promise<void>;
}
