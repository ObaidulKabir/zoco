export interface OneTimePrekey {
  keyId: number;
  publicKey: string;
}

export interface PrekeyBundle {
  userId: string;
  identityKey: string;
  signedPrekey: string;
  signedPrekeySignature: string;
  oneTimePrekeys: OneTimePrekey[];
  updatedAt: Date;
}
