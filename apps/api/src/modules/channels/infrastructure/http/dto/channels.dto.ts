import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateChannelRequest {
  @ApiProperty({ example: 'engineering' })
  name!: string;

  @ApiPropertyOptional({ example: 'Software development discussions' })
  topic?: string;

  @ApiPropertyOptional({ example: 'Private team space' })
  description?: string;

  @ApiPropertyOptional({ enum: ['public', 'private', 'announcement', 'shared'], default: 'public' })
  type?: 'public' | 'private' | 'announcement' | 'shared';
}

export class InviteChannelMemberRequest {
  @ApiProperty({ example: '37dce4ba-b5d3-4a4a-bc4d-658d02c6ae66' })
  userId!: string;
}

export class SendChannelMessageRequest {
  @ApiProperty({ example: 'Hello channel!' })
  content!: string;

  @ApiPropertyOptional({ example: 'YWJjMTIz...' })
  contentCiphertext?: string;

  @ApiPropertyOptional({ example: 'deadbeef1234' })
  envelopeIv?: string;

  @ApiPropertyOptional({ example: 'cafebabe5678' })
  envelopeTag?: string;

  @ApiPropertyOptional({ enum: ['text', 'system', 'file', 'call_event'], default: 'text' })
  contentType?: 'text' | 'system' | 'file' | 'call_event';

  @ApiPropertyOptional({ example: 'd18f153c-f814-446c-b646-1b88f4406af3' })
  threadId?: string;

  @ApiPropertyOptional({ example: '69aeb373-2233-4118-b863-b02144182afc' })
  replyToId?: string;

  @ApiPropertyOptional({ default: false })
  broadcastToChannel?: boolean;
}

export class CreateSharedChannelRequest {
  @ApiProperty({ example: 'acme-tokyo-sync' })
  name!: string;

  @ApiProperty({ example: 'b2b-target-org-id' })
  targetOrgId!: string;

  @ApiPropertyOptional({ example: 'Joint roadmap' })
  topic?: string;
}
