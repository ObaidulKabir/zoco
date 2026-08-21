import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StartDmRequest {
  @ApiProperty({ description: 'Target user ID to start conversation with' })
  recipientId!: string;
}

export class SendMessageRequest {
  @ApiProperty({ description: 'Base64/Hex ciphertext of encrypted message' })
  contentCiphertext!: string;

  @ApiPropertyOptional({ description: 'Initialization vector' })
  envelopeIv?: string;

  @ApiPropertyOptional({ description: 'Authentication tag' })
  envelopeTag?: string;

  @ApiPropertyOptional({ enum: ['text', 'system', 'file', 'call_event'], default: 'text' })
  contentType?: 'text' | 'system' | 'file' | 'call_event';

  @ApiPropertyOptional({ description: 'Parent message ID if quoting/replying' })
  replyToId?: string;
}

export class EditMessageRequest {
  @ApiProperty({ description: 'Updated base64/hex ciphertext' })
  contentCiphertext!: string;

  @ApiPropertyOptional({ description: 'Updated IV' })
  envelopeIv?: string;

  @ApiPropertyOptional({ description: 'Updated tag' })
  envelopeTag?: string;
}

export class ReactMessageRequest {
  @ApiProperty({ description: 'Emoji character (e.g. 👍, ❤️, 🎉)' })
  emoji!: string;
}

export class PinMessageRequest {
  @ApiProperty({ description: 'Pin status' })
  pin!: boolean;
}

export class RegisterPrekeysRequest {
  @ApiProperty({ description: 'Identity public key' })
  identityKey!: string;

  @ApiProperty({ description: 'Signed prekey' })
  signedPrekey!: string;

  @ApiProperty({ description: 'Signed prekey signature' })
  signedPrekeySignature!: string;

  @ApiProperty({
    description: 'Array of one-time prekeys',
    type: 'array',
    items: { type: 'object', properties: { keyId: { type: 'number' }, publicKey: { type: 'string' } } },
  })
  oneTimePrekeys!: Array<{ keyId: number; publicKey: string }>;
}
