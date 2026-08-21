import { CanActivate, ExecutionContext, HttpException, Inject, Injectable } from '@nestjs/common';
import { AuthGuard, type AuthedRequest } from '../../../identity/infrastructure/http/auth.guard';
import type { OrgDirectoryPort } from '../../application/ports/org-directory.port';
import { ORG_DIRECTORY } from '../../org.tokens';

export type OrgRequest = AuthedRequest & { orgId: string; orgRole: string };

@Injectable()
export class OrgGuard implements CanActivate {
  constructor(@Inject(ORG_DIRECTORY) private readonly directory: OrgDirectoryPort) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<OrgRequest>();
    const header = String(req.headers['x-org-id'] ?? '');
    const param = String(req.params.orgId ?? '');
    const orgId = param || header;
    if (!orgId) {
      throw new HttpException(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Organization is required' } },
        400,
      );
    }
    if (param && header && param !== header) {
      throw new HttpException(
        { success: false, error: { code: 'FORBIDDEN', message: 'Organization header does not match' } },
        403,
      );
    }
    const membership = await this.directory.findMembership(orgId, req.userId);
    if (!membership) {
      throw new HttpException(
        { success: false, error: { code: 'FORBIDDEN', message: 'Not a member of this organization' } },
        403,
      );
    }
    req.orgId = orgId;
    req.orgRole = membership.role;
    return true;
  }
}

export const orgAuth = [AuthGuard, OrgGuard];
