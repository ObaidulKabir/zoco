export type LocalCredentials = {
  email: string;
  password: string;
};

export type AuthUser = {
  id: string;
  email: string;
};

export interface IdentityProviderPort {
  authenticate(creds: LocalCredentials): Promise<AuthUser | null>;
}
