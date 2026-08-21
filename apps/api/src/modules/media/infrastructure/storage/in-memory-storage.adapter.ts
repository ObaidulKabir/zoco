import type { StoragePort, UploadUrlResult } from '../../application/ports/storage.port';

export class InMemoryStorageAdapter implements StoragePort {
  private objects = new Map<string, Buffer>();

  async generatePresignedUploadUrl(bucket: string, objectKey: string, mimeType: string, sizeBytes: number): Promise<UploadUrlResult> {
    return {
      uploadUrl: `http://localhost:9000/${bucket}/${objectKey}?X-Amz-Signature=mock_signature_12345`,
      objectKey,
      bucket,
      expiresInSeconds: 900,
    };
  }

  async generatePresignedDownloadUrl(bucket: string, objectKey: string, expiresInSeconds = 3600): Promise<string> {
    return `http://localhost:9000/${bucket}/${objectKey}?X-Amz-Signature=mock_dl_signature_12345`;
  }

  async deleteObject(bucket: string, objectKey: string): Promise<void> {
    this.objects.delete(`${bucket}/${objectKey}`);
  }
}
