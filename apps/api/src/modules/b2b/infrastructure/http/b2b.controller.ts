import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthGuard } from '../../../identity/infrastructure/http/auth.guard';
import { OrgGuard } from '../../../org/infrastructure/http/org.guard';
import { B2bError } from '../../domain/b2b-error';
import { SendConnectionRequestUseCase } from '../../application/send-connection-request.usecase';
import { AcceptConnectionRequestUseCase } from '../../application/accept-connection-request.usecase';
import { RejectConnectionRequestUseCase } from '../../application/reject-connection-request.usecase';
import { BlockConnectionRequestUseCase } from '../../application/block-connection-request.usecase';
import { DisconnectB2bUseCase } from '../../application/disconnect-b2b.usecase';
import { ListB2bConnectionsUseCase } from '../../application/list-b2b-connections.usecase';
import type { B2bConnectionStatus } from '../../domain/b2b-connection';

export class SendConnectionRequestBody {
  receiverOrgId!: string;
  introMessage!: string;
}

function unwrapB2b<T>(fn: () => Promise<T>): Promise<T> {
  return fn().catch((err) => {
    if (err instanceof B2bError) {
      if (err.code === 'B2B_NOT_FOUND') {
        throw new NotFoundException({ success: false, error: { code: err.code, message: err.message } });
      }
      if (
        err.code === 'B2B_SELF_CONNECTION_FORBIDDEN' ||
        err.code === 'B2B_CONNECTION_BLOCKED' ||
        err.code === 'B2B_UNAUTHORIZED_ACTION' ||
        err.code === 'B2B_NOT_CONNECTED'
      ) {
        throw new ForbiddenException({ success: false, error: { code: err.code, message: err.message } });
      }
      if (err.code === 'B2B_ALREADY_CONNECTED' || err.code === 'B2B_DAILY_LIMIT_EXCEEDED' || err.code === 'B2B_INVALID_INTRO') {
        throw new BadRequestException({ success: false, error: { code: err.code, message: err.message } });
      }
    }
    throw err;
  });
}

@ApiTags('B2B')
@ApiBearerAuth()
@ApiHeader({ name: 'x-org-id', required: true, description: 'Active organization ID' })
@Controller('v1/b2b')
@UseGuards(AuthGuard, OrgGuard)
export class B2bController {
  constructor(
    @Inject(SendConnectionRequestUseCase) private readonly sendRequest: SendConnectionRequestUseCase,
    @Inject(AcceptConnectionRequestUseCase) private readonly acceptRequest: AcceptConnectionRequestUseCase,
    @Inject(RejectConnectionRequestUseCase) private readonly rejectRequest: RejectConnectionRequestUseCase,
    @Inject(BlockConnectionRequestUseCase) private readonly blockRequest: BlockConnectionRequestUseCase,
    @Inject(DisconnectB2bUseCase) private readonly disconnectUseCase: DisconnectB2bUseCase,
    @Inject(ListB2bConnectionsUseCase) private readonly listUseCase: ListB2bConnectionsUseCase,
  ) {}

  @Post('connections')
  @ApiOperation({ summary: 'Send a B2B connection request with an introduction' })
  async sendConnection(@Req() req: Request, @Body() body: SendConnectionRequestBody) {
    const senderOrgId = (req as any).orgId as string;
    const senderUserId = (req as any).userId as string;
    const conn = await unwrapB2b(() =>
      this.sendRequest.execute({
        senderOrgId,
        senderUserId,
        receiverOrgId: body.receiverOrgId,
        introMessage: body.introMessage,
      }),
    );
    return { status: 'success', data: conn };
  }

  @Get('connections')
  @ApiOperation({ summary: 'List B2B connections for active organization' })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'accepted', 'rejected', 'blocked'] })
  async listConnections(@Req() req: Request, @Query('status') status?: B2bConnectionStatus) {
    const orgId = (req as any).orgId as string;
    const connections = await unwrapB2b(() => this.listUseCase.execute(orgId, status));
    return { status: 'success', data: connections };
  }

  @Post('connections/:id/accept')
  @HttpCode(200)
  @ApiOperation({ summary: 'Accept a B2B connection request' })
  async acceptConnection(@Req() req: Request, @Param('id') connectionId: string) {
    const receiverOrgId = (req as any).orgId as string;
    const receiverUserId = (req as any).userId as string;
    const conn = await unwrapB2b(() =>
      this.acceptRequest.execute({
        connectionId,
        receiverOrgId,
        receiverUserId,
      }),
    );
    return { status: 'success', data: conn };
  }

  @Post('connections/:id/reject')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reject a B2B connection request' })
  async rejectConnection(@Req() req: Request, @Param('id') connectionId: string) {
    const receiverOrgId = (req as any).orgId as string;
    const receiverUserId = (req as any).userId as string;
    const conn = await unwrapB2b(() =>
      this.rejectRequest.execute({
        connectionId,
        receiverOrgId,
        receiverUserId,
      }),
    );
    return { status: 'success', data: conn };
  }

  @Post('connections/:id/block')
  @HttpCode(200)
  @ApiOperation({ summary: 'Block a B2B connection request by connection ID' })
  async blockConnection(@Req() req: Request, @Param('id') connectionId: string) {
    const blockerOrgId = (req as any).orgId as string;
    const blockerUserId = (req as any).userId as string;
    const conn = await unwrapB2b(() =>
      this.blockRequest.execute({
        connectionId,
        blockerOrgId,
        blockerUserId,
      }),
    );
    return { status: 'success', data: conn };
  }

  @Post('connections/block')
  @HttpCode(200)
  @ApiOperation({ summary: 'Block an organization by target org ID' })
  async blockOrg(@Req() req: Request, @Body() body: { targetOrgId: string }) {
    const blockerOrgId = (req as any).orgId as string;
    const blockerUserId = (req as any).userId as string;
    const conn = await unwrapB2b(() =>
      this.blockRequest.execute({
        targetOrgId: body.targetOrgId,
        blockerOrgId,
        blockerUserId,
      }),
    );
    return { status: 'success', data: conn };
  }

  @Delete('connections/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Disconnect an active B2B connection' })
  async disconnect(@Req() req: Request, @Param('id') connectionId: string) {
    const orgId = (req as any).orgId as string;
    const userId = (req as any).userId as string;
    const res = await unwrapB2b(() =>
      this.disconnectUseCase.execute({
        connectionId,
        orgId,
        userId,
      }),
    );
    return { status: 'success', data: res };
  }
}
