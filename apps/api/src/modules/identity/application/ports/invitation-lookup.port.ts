export type PendingInvitation = {
  email: string;
  expiresAt: Date;
};

export interface InvitationLookupPort {
  findByTokenHash(tokenHash: string): Promise<PendingInvitation | null>;
}

export interface InvitationRegistryPort extends InvitationLookupPort {
  record(tokenHash: string, invitation: PendingInvitation): Promise<void>;
  clear(): Promise<void>;
}
