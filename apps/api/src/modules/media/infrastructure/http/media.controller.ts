import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../../../identity/infrastructure/http/auth.guard';
import { OrgGuard, type OrgRequest } from '../../../org/infrastructure/http/org.guard';
import { MediaError } from '../../domain/media-error';
import { RequestUploadUrlUseCase } from '../../application/request-upload-url.usecase';
import { ScanAndConfirmUseCase, GetDownloadUrlUseCase } from '../../application/scan-and-confirm.usecase';
import { RequestUploadUrlRequest, ConfirmUploadRequest } from './dto/media.dto';

function unwrapMedia<T>(action: () => Promise<T>): Promise<{ success: true; data: T }> {
  return action()
    .then((data) => ({ success: true as const, data }))
    .catch((err) => {
      if (err instanceof MediaError) {
        const map: Record<string, number> = {
          FILE_NOT_FOUND: HttpStatus.NOT_FOUND,
          FILE_QUARANTINED: HttpStatus.FORBIDDEN,
          FILE_TOO_LARGE: HttpStatus.PAYLOAD_TOO_LARGE,
          INVALID_FILE_TYPE: HttpStatus.BAD_REQUEST,
          UNAUTHORIZED: HttpStatus.UNAUTHORIZED,
          PERMISSION_DENIED: HttpStatus.FORBIDDEN,
        };
        const status = map[err.code] || HttpStatus.BAD_REQUEST;
        throw new HttpException({ success: false, error: { code: err.code, message: err.message } }, status);
      }
      throw err;
    });
}

@ApiTags('Media')
@Controller('v1/media')
export class MediaController {
  constructor(
    @Inject(RequestUploadUrlUseCase) private readonly requestUploadUseCase: RequestUploadUrlUseCase,
    @Inject(ScanAndConfirmUseCase) private readonly scanConfirmUseCase: ScanAndConfirmUseCase,
    @Inject(GetDownloadUrlUseCase) private readonly getDownloadUseCase: GetDownloadUrlUseCase,
  ) {}

  @Post('upload-url')
  @UseGuards(AuthGuard, OrgGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: 'Request pre-signed upload URL for S3/MinIO' })
  @ApiResponse({ status: 200, description: 'Pre-signed upload URL generated' })
  async requestUploadUrl(@Req() req: OrgRequest, @Body() body: RequestUploadUrlRequest) {
    return unwrapMedia(() =>
      this.requestUploadUseCase.execute({
        orgId: req.orgId,
        userId: req.userId,
        filename: body.filename,
        mimeType: body.mimeType,
        sizeBytes: body.sizeBytes,
      }),
    );
  }

  @Post('confirm')
  @UseGuards(AuthGuard, OrgGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: 'Confirm upload and trigger anti-malware virus scan' })
  @ApiResponse({ status: 200, description: 'Upload confirmed and scan completed' })
  async confirmUpload(@Req() req: OrgRequest, @Body() body: ConfirmUploadRequest) {
    return unwrapMedia(() => this.scanConfirmUseCase.execute(body.fileId));
  }

  @Get(':fileId/download-url')
  @UseGuards(AuthGuard, OrgGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get secure pre-signed download URL for a clean file' })
  @ApiResponse({ status: 200, description: 'Download URL generated' })
  async getDownloadUrl(@Req() req: OrgRequest, @Param('fileId') fileId: string) {
    return unwrapMedia(() => this.getDownloadUseCase.execute(req.orgId, fileId));
  }
}
