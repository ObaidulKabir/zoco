export interface InviteRegistryPort {
  record(input: { tokenHash: string; email: string; expiresAt: Date }): Promise<void>;
}
