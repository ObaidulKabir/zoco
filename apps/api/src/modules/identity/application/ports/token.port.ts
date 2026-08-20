export interface TokenPort {
  signAccess(userId: string, sessionId: string): string;
  signRefresh(userId: string, sessionId: string): string;
  verifyAccess(token: string): { userId: string; sessionId: string };
  verifyRefresh(token: string): { userId: string; sessionId: string };
}
