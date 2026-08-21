import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard, type AuthedRequest } from '../../../identity/infrastructure/http/auth.guard';
import { OrgGuard, type OrgRequest } from '../../../org/infrastructure/http/org.guard';
import { GetOrCreateDmUseCase } from '../../application/get-or-create-dm.usecase';
import { SendDmUseCase } from '../../application/send-dm.usecase';
import { EditMessageUseCase } from '../../application/edit-message.usecase';
import { DeleteMessageUseCase } from '../../application/delete-message.usecase';
import { ReactMessageUseCase } from '../../application/react-message.usecase';
import { PinMessageUseCase } from '../../application/pin-message.usecase';
import { ListConversationsUseCase } from '../../application/list-conversations.usecase';
import { GetMessagesUseCase } from '../../application/get-messages.usecase';
import { MarkReadUseCase } from '../../application/mark-read.usecase';
import {
  RegisterPrekeyBundleUseCase,
  GetPrekeyBundleUseCase,
} from '../../application/prekey-bundle.usecases';
import { MessengerError } from '../../domain/messenger-error';
import {
  EditMessageRequest,
  PinMessageRequest,
  ReactMessageRequest,
  RegisterPrekeysRequest,
  SendMessageRequest,
  StartDmRequest,
} from './dto/messenger.dto';

function unwrapMessenger<T>(fn: () => Promise<T>): Promise<{ success: true; data: T }> {
  return fn()
    .then((data) => ({ success: true as const, data }))
    .catch((err) => {
      if (err instanceof MessengerError) {
        const status =
          err.code === 'CONVERSATION_NOT_FOUND' || err.code === 'MESSAGE_NOT_FOUND' || err.code === 'PREKEY_NOT_FOUND'
            ? 404
            : err.code === 'NOT_PARTICIPANT' || err.code === 'PERMISSION_DENIED' || err.code === 'CROSS_TENANT_FORBIDDEN'
              ? 403
              : 400;
        throw new HttpException({ success: false, error: { code: err.code, message: err.message } }, status);
      }
      throw err;
    });
}

import { Inject } from '@nestjs/common';

@ApiTags('Messenger')
@Controller('v1/messenger')
export class MessengerController {
  constructor(
    @Inject(GetOrCreateDmUseCase) private readonly getOrCreateDmUseCase: GetOrCreateDmUseCase,
    @Inject(SendDmUseCase) private readonly sendDmUseCase: SendDmUseCase,
    @Inject(EditMessageUseCase) private readonly editMessageUseCase: EditMessageUseCase,
    @Inject(DeleteMessageUseCase) private readonly deleteMessageUseCase: DeleteMessageUseCase,
    @Inject(ReactMessageUseCase) private readonly reactMessageUseCase: ReactMessageUseCase,
    @Inject(PinMessageUseCase) private readonly pinMessageUseCase: PinMessageUseCase,
    @Inject(ListConversationsUseCase) private readonly listConversationsUseCase: ListConversationsUseCase,
    @Inject(GetMessagesUseCase) private readonly getMessagesUseCase: GetMessagesUseCase,
    @Inject(MarkReadUseCase) private readonly markReadUseCase: MarkReadUseCase,
    @Inject(RegisterPrekeyBundleUseCase) private readonly registerPrekeysUseCase: RegisterPrekeyBundleUseCase,
    @Inject(GetPrekeyBundleUseCase) private readonly getPrekeysUseCase: GetPrekeyBundleUseCase,
  ) {}

  @Post('conversations/dm')
  @UseGuards(AuthGuard, OrgGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start or get an existing 1:1 direct message conversation' })
  @ApiResponse({ status: 201, description: 'Direct message conversation created or retrieved' })
  async startDm(@Req() req: OrgRequest, @Body() body: StartDmRequest) {
    return unwrapMessenger(() =>
      this.getOrCreateDmUseCase.execute({
        orgId: req.orgId,
        requesterId: req.userId,
        recipientId: body.recipientId,
      }),
    );
  }

  @Get('conversations')
  @UseGuards(AuthGuard, OrgGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List active conversations for the current user' })
  @ApiResponse({ status: 200, description: 'List of conversations' })
  async listConversations(@Req() req: OrgRequest) {
    return unwrapMessenger(() => this.listConversationsUseCase.execute(req.orgId, req.userId));
  }

  @Get('conversations/:convId/messages')
  @UseGuards(AuthGuard, OrgGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get paginated messages for a conversation' })
  @ApiResponse({ status: 200, description: 'List of messages' })
  async getMessages(
    @Req() req: OrgRequest,
    @Param('convId') convId: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    return unwrapMessenger(() =>
      this.getMessagesUseCase.execute({
        orgId: req.orgId,
        userId: req.userId,
        conversationId: convId,
        limit: limit ? parseInt(limit, 10) : undefined,
        before: before ? new Date(before) : undefined,
      }),
    );
  }

  @Post('conversations/:convId/messages')
  @UseGuards(AuthGuard, OrgGuard)
  @ApiBearerAuth()
  @HttpCode(201)
  @ApiOperation({ summary: 'Send an encrypted direct message' })
  @ApiResponse({ status: 201, description: 'Message sent successfully' })
  async sendMessage(
    @Req() req: OrgRequest,
    @Param('convId') convId: string,
    @Body() body: SendMessageRequest,
  ) {
    return unwrapMessenger(() =>
      this.sendDmUseCase.execute({
        orgId: req.orgId,
        senderId: req.userId,
        conversationId: convId,
        contentCiphertext: body.contentCiphertext,
        envelopeIv: body.envelopeIv,
        envelopeTag: body.envelopeTag,
        contentType: body.contentType,
        replyToId: body.replyToId,
      }),
    );
  }

  @Patch('messages/:msgId')
  @UseGuards(AuthGuard, OrgGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit message content within 15 minutes window' })
  @ApiResponse({ status: 200, description: 'Message edited successfully' })
  async editMessage(
    @Req() req: OrgRequest,
    @Param('msgId') msgId: string,
    @Body() body: EditMessageRequest,
  ) {
    return unwrapMessenger(() =>
      this.editMessageUseCase.execute({
        orgId: req.orgId,
        userId: req.userId,
        messageId: msgId,
        contentCiphertext: body.contentCiphertext,
        envelopeIv: body.envelopeIv,
        envelopeTag: body.envelopeTag,
      }),
    );
  }

  @Delete('messages/:msgId')
  @UseGuards(AuthGuard, OrgGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Soft delete a message' })
  @ApiResponse({ status: 200, description: 'Message soft deleted' })
  async deleteMessage(@Req() req: OrgRequest, @Param('msgId') msgId: string) {
    return unwrapMessenger(() =>
      this.deleteMessageUseCase.execute({
        orgId: req.orgId,
        userId: req.userId,
        userRole: req.orgRole,
        messageId: msgId,
      }),
    );
  }

  @Post('messages/:msgId/reactions')
  @UseGuards(AuthGuard, OrgGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: 'Add an emoji reaction to a message' })
  @ApiResponse({ status: 200, description: 'Reaction added' })
  async addReaction(
    @Req() req: OrgRequest,
    @Param('msgId') msgId: string,
    @Body() body: ReactMessageRequest,
  ) {
    return unwrapMessenger(() =>
      this.reactMessageUseCase.addReaction({
        orgId: req.orgId,
        userId: req.userId,
        messageId: msgId,
        emoji: body.emoji,
      }),
    );
  }

  @Delete('messages/:msgId/reactions/:emoji')
  @UseGuards(AuthGuard, OrgGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove an emoji reaction from a message' })
  @ApiResponse({ status: 200, description: 'Reaction removed' })
  async removeReaction(
    @Req() req: OrgRequest,
    @Param('msgId') msgId: string,
    @Param('emoji') emoji: string,
  ) {
    return unwrapMessenger(() =>
      this.reactMessageUseCase.removeReaction({
        orgId: req.orgId,
        userId: req.userId,
        messageId: msgId,
        emoji: decodeURIComponent(emoji),
      }),
    );
  }

  @Post('messages/:msgId/pin')
  @UseGuards(AuthGuard, OrgGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: 'Pin or unpin a message (Manager+)' })
  @ApiResponse({ status: 200, description: 'Message pin status updated' })
  async pinMessage(
    @Req() req: OrgRequest,
    @Param('msgId') msgId: string,
    @Body() body: PinMessageRequest,
  ) {
    return unwrapMessenger(() =>
      this.pinMessageUseCase.execute({
        orgId: req.orgId,
        userId: req.userId,
        userRole: req.orgRole,
        messageId: msgId,
        pin: body.pin,
      }),
    );
  }

  @Post('conversations/:convId/messages/:msgId/read')
  @UseGuards(AuthGuard, OrgGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark a message as read and update read receipt' })
  @ApiResponse({ status: 200, description: 'Message marked as read' })
  async markRead(
    @Req() req: OrgRequest,
    @Param('convId') convId: string,
    @Param('msgId') msgId: string,
  ) {
    return unwrapMessenger(() =>
      this.markReadUseCase.execute({
        orgId: req.orgId,
        userId: req.userId,
        conversationId: convId,
        messageId: msgId,
      }),
    );
  }

  @Post('keys/prekeys')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Publish user X3DH prekey bundle' })
  @ApiResponse({ status: 201, description: 'Prekey bundle registered' })
  async registerPrekeys(@Req() req: AuthedRequest, @Body() body: RegisterPrekeysRequest) {
    return unwrapMessenger(() =>
      this.registerPrekeysUseCase.execute({
        userId: req.userId,
        identityKey: body.identityKey,
        signedPrekey: body.signedPrekey,
        signedPrekeySignature: body.signedPrekeySignature,
        oneTimePrekeys: body.oneTimePrekeys,
      }),
    );
  }

  @Get('keys/prekeys/:userId')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Fetch X3DH prekey bundle for a target user (consumes 1 OTPK)' })
  @ApiResponse({ status: 200, description: 'Target user prekey bundle' })
  async getPrekeys(@Param('userId') userId: string) {
    return unwrapMessenger(() => this.getPrekeysUseCase.execute(userId));
  }
}
