import { Injectable } from '@nestjs/common';
import { randomOtp } from '../../domain/crypto';
import type { OtpPort } from '../../application/ports/otp.port';

@Injectable()
export class CryptoOtp implements OtpPort {
  generate(): string {
    return randomOtp();
  }
}
