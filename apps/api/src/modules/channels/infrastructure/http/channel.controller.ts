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
  Query,
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
import { ChannelError } from '../../domain/channel-error';
import { CreateChannelUseCase } from '../../application/create-channel.usecase';
import { JoinChannelUseCase, LeaveChannelUseCase } from '../../application/join-channel.usecase';
import { InviteChannelMemberUseCase } from '../../application/invite-channel-member.usecase';
import { SendChannelMessageUseCase } from '../../application/send-channel-message.usecase';
import { ListChannelsUseCase } from '../../application/list-channels.usecase';
import { GetChannelMessagesUseCase, GetThreadMessagesUseCase } from '../../application/get-channel-messages.usecase';
import { ArchiveChannelUseCase, CreateSharedChannelUseCase, AcceptSharedChannelUseCase } from '../../application/archive-channel.usecase';
import {
  CreateChannelRequest,
  InviteChannelMemberRequest,
  SendChannelMessageRequest,
  CreateSharedChannelRequest,
} from './dto/channels.dto';

function unwrapChannel<T>(action: () => Promise<T>): Promise<{ success: true; data: T }> {
  return action()
    .then((data) => ({ success: true as const, data }))
    .catch((err) => {
      if (err instanceof ChannelError) {
        const map: Record<string, number> = {
          CHANNEL_NOT_FOUND: HttpStatus.NOT_FOUND,
          MESSAGE_NOT_FOUND: HttpStatus.NOT_FOUND,
          CHANNEL_ACCESS_DENIED: HttpStatus.FORBIDDEN,
          ANNOUNCEMENT_POST_RESTRICTED: HttpStatus.FORBIDDEN,
          PERMISSION_DENIED: HttpStatus.FORBIDDEN,
          CHANNEL_ARCHIVED: HttpStatus.FORBIDDEN,
          CHANNEL_ALREADY_EXISTS: HttpStatus.CONFLICT,
          VALIDATION_ERROR: HttpStatus.BAD_REQUEST,
          INVALID_CHANNEL_NAME: HttpStatus.BAD_REQUEST,
        };
        const status = map[err.code] || HttpStatus.BAD_REQUEST;
        throw new HttpException({ success: false, error: { code: err.code, message: err.message } }, status);
      }
      throw err;
    });
}

@ApiTags('Channels')
@Controller('v1/channels')
export class ChannelController {
  constructor(
    @Inject(CreateChannelUseCase) private readonly createChannelUseCase: CreateChannelUseCase,
    @Inject(JoinChannelUseCase) private readonly joinChannelUseCase: JoinChannelUseCase,
    @Inject(LeaveChannelUseCase) private readonly leaveChannelUseCase: LeaveChannelUseCase,
    @Inject(InviteChannelMemberUseCase) private readonly inviteMemberUseCase: InviteChannelMemberUseCase,
    @Inject(SendChannelMessageUseCase) private readonly sendMessageUseCase: SendChannelMessageUseCase,
    @Inject(ListChannelsUseCase) private readonly listChannelsUseCase: ListChannelsUseCase,
    @Inject(GetChannelMessagesUseCase) private readonly getMessagesUseCase: GetChannelMessagesUseCase,
    @Inject(GetThreadMessagesUseCase) private readonly getThreadMessagesUseCase: GetThreadMessagesUseCase,
    @Inject(ArchiveChannelUseCase) private readonly archiveChannelUseCase: ArchiveChannelUseCase,
    @Inject(CreateSharedChannelUseCase) private readonly createSharedUseCase: CreateSharedChannelUseCase,
    @Inject(AcceptSharedChannelUseCase) private readonly acceptSharedUseCase: AcceptSharedChannelUseCase,
  ) {}

  @Get()
  @UseGuards(AuthGuard, OrgGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List channels in organization' })
  @ApiResponse({ status: 200, description: 'Channels list' })
  async listChannels(@Req() req: OrgRequest) {
    return unwrapChannel(() => this.listChannelsUseCase.execute(req.orgId, req.userId));
  }

  @Post()
  @UseGuards(AuthGuard, OrgGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new public, private, or announcement channel' })
  @ApiResponse({ status: 201, description: 'Channel created' })
  async createChannel(@Req() req: OrgRequest, @Body() body: CreateChannelRequest) {
    return unwrapChannel(() =>
      this.createChannelUseCase.execute({
        orgId: req.orgId,
        userId: req.userId,
        name: body.name,
        topic: body.topic,
        description: body.description,
        type: body.type,
      }),
    );
  }

  @Post(':channelSlug/join')
  @UseGuards(AuthGuard, OrgGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: 'Join a public channel' })
  @ApiResponse({ status: 200, description: 'Joined channel' })
  async joinChannel(@Req() req: OrgRequest, @Param('channelSlug') channelSlug: string) {
    return unwrapChannel(() => this.joinChannelUseCase.execute(req.orgId, channelSlug, req.userId));
  }

  @Post(':channelSlug/leave')
  @UseGuards(AuthGuard, OrgGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: 'Leave a channel' })
  @ApiResponse({ status: 200, description: 'Left channel' })
  async leaveChannel(@Req() req: OrgRequest, @Param('channelSlug') channelSlug: string) {
    return unwrapChannel(() => this.leaveChannelUseCase.execute(req.orgId, channelSlug, req.userId));
  }

  @Post(':channelSlug/members')
  @UseGuards(AuthGuard, OrgGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: 'Invite a member to a channel' })
  @ApiResponse({ status: 200, description: 'Member invited' })
  async inviteMember(
    @Req() req: OrgRequest,
    @Param('channelSlug') channelSlug: string,
    @Body() body: InviteChannelMemberRequest,
  ) {
    return unwrapChannel(() =>
      this.inviteMemberUseCase.execute(req.orgId, channelSlug, req.userId, body.userId),
    );
  }

  @Get(':channelSlug/messages')
  @UseGuards(AuthGuard, OrgGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get channel message history' })
  @ApiResponse({ status: 200, description: 'Messages list' })
  async getMessages(
    @Req() req: OrgRequest,
    @Param('channelSlug') channelSlug: string,
    @Query('limit') limit?: number,
  ) {
    return unwrapChannel(() =>
      this.getMessagesUseCase.execute({
        orgId: req.orgId,
        channelIdOrSlug: channelSlug,
        userId: req.userId,
        limit: limit ? Number(limit) : 50,
      }),
    );
  }

  @Post(':channelSlug/messages')
  @UseGuards(AuthGuard, OrgGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send a message to a channel' })
  @ApiResponse({ status: 201, description: 'Message sent' })
  async sendMessage(
    @Req() req: OrgRequest,
    @Param('channelSlug') channelSlug: string,
    @Body() body: SendChannelMessageRequest,
  ) {
    return unwrapChannel(() =>
      this.sendMessageUseCase.execute({
        orgId: req.orgId,
        channelIdOrSlug: channelSlug,
        senderId: req.userId,
        senderOrgRole: req.orgRole,
        content: body.content,
        contentCiphertext: body.contentCiphertext,
        envelopeIv: body.envelopeIv,
        envelopeTag: body.envelopeTag,
        contentType: body.contentType,
        threadId: body.threadId,
        replyToId: body.replyToId,
        broadcastToChannel: body.broadcastToChannel,
      }),
    );
  }

  @Get('messages/:messageId/threads')
  @UseGuards(AuthGuard, OrgGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get thread messages for a root message' })
  @ApiResponse({ status: 200, description: 'Thread message list' })
  async getThreadMessages(@Req() req: OrgRequest, @Param('messageId') messageId: string) {
    return unwrapChannel(() => this.getThreadMessagesUseCase.execute(req.orgId, messageId));
  }

  @Post(':channelSlug/archive')
  @UseGuards(AuthGuard, OrgGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: 'Archive a channel' })
  @ApiResponse({ status: 200, description: 'Channel archived' })
  async archiveChannel(@Req() req: OrgRequest, @Param('channelSlug') channelSlug: string) {
    return unwrapChannel(() => this.archiveChannelUseCase.execute(req.orgId, channelSlug, req.orgRole));
  }

  @Post('shared')
  @UseGuards(AuthGuard, OrgGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a shared B2B channel' })
  @ApiResponse({ status: 201, description: 'Shared channel created' })
  async createSharedChannel(@Req() req: OrgRequest, @Body() body: CreateSharedChannelRequest) {
    return unwrapChannel(() =>
      this.createSharedUseCase.execute({
        orgId: req.orgId,
        userId: req.userId,
        name: body.name,
        targetOrgId: body.targetOrgId,
        topic: body.topic,
      }),
    );
  }

  @Post('shared/:channelId/accept')
  @UseGuards(AuthGuard, OrgGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: 'Accept invitation to a shared B2B channel' })
  @ApiResponse({ status: 200, description: 'Shared channel accepted' })
  async acceptSharedChannel(@Req() req: OrgRequest, @Param('channelId') channelId: string) {
    return unwrapChannel(() => this.acceptSharedUseCase.execute(channelId, req.orgId, req.userId));
  }
}
