import { ApiProperty } from '@nestjs/swagger';

export class RequestUploadUrlRequest {
  @ApiProperty({ example: 'quarterly-report.pdf' })
  filename!: string;

  @ApiProperty({ example: 'application/pdf' })
  mimeType!: string;

  @ApiProperty({ example: 1048576 })
  sizeBytes!: number;
}

export class ConfirmUploadRequest {
  @ApiProperty({ example: 'file-uuid-or-key' })
  fileId!: string;
}
