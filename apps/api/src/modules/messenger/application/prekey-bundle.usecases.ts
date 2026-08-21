import type { ClockPort } from '@zoqo/shared';
import type { OneTimePrekey, PrekeyBundle } from '../domain/prekey-bundle';
import { MessengerError } from '../domain/messenger-error';
import type { MessengerStorePort } from './ports/messenger-store.port';

export interface RegisterPrekeyBundleCommand {
  userId: string;
  identityKey: string;
  signedPrekey: string;
  signedPrekeySignature: string;
  oneTimePrekeys: OneTimePrekey[];
}

export class RegisterPrekeyBundleUseCase {
  constructor(
    private readonly store: MessengerStorePort,
    private readonly clock: ClockPort,
  ) {}

  async execute(cmd: RegisterPrekeyBundleCommand): Promise<void> {
    if (!cmd.identityKey || !cmd.signedPrekey || !cmd.signedPrekeySignature) {
      throw new MessengerError('VALIDATION_ERROR', 'Identity key, signed prekey, and signature are required');
    }

    const bundle: PrekeyBundle = {
      userId: cmd.userId,
      identityKey: cmd.identityKey,
      signedPrekey: cmd.signedPrekey,
      signedPrekeySignature: cmd.signedPrekeySignature,
      oneTimePrekeys: cmd.oneTimePrekeys || [],
      updatedAt: this.clock.now(),
    };

    await this.store.savePrekeyBundle(bundle);
  }
}

export class GetPrekeyBundleUseCase {
  constructor(private readonly store: MessengerStorePort) {}

  async execute(targetUserId: string): Promise<{
    identityKey: string;
    signedPrekey: string;
    signedPrekeySignature: string;
    oneTimePrekey?: { keyId: number; publicKey: string };
  }> {
    const bundle = await this.store.consumeOneTimePrekey(targetUserId);
    if (!bundle) {
      throw new MessengerError('PREKEY_NOT_FOUND', `No prekey bundle found for user ${targetUserId}`);
    }
    return bundle;
  }
}
