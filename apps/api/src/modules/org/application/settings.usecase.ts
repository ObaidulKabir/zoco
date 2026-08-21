import type { ClockPort } from '@zoqo/shared';
import { orgError } from '../domain/org-error';
import { canManageOrg, CHANNEL_POLICIES, type ChannelPolicy } from '../domain/policy';
import { validateInvitePolicy, validateOrgName, validateTimezone } from '../domain/validation';
import type { OrgAuditPort } from './ports/org-audit.port';
import type { OrgDirectoryPort } from './ports/org-directory.port';
import { wrapOrg } from './wrap-org';

export class UpdateOrgSettingsUseCase {
  constructor(
    private readonly directory: OrgDirectoryPort,
    private readonly audit: OrgAuditPort,
    private readonly clock: ClockPort,
  ) {}

  execute(input: {
    orgId: string;
    actorId: string;
    name?: string;
    timezone?: string;
    defaultLanguage?: string;
    invitationPolicy?: string;
    externalCommunication?: boolean;
    channelCreationPolicy?: string;
  }) {
    return wrapOrg(async () => {
      const actor = await this.directory.findMembership(input.orgId, input.actorId);
      if (!actor || !canManageOrg(actor.role)) {
        throw orgError('FORBIDDEN', 'Only owners and admins can change organization settings');
      }
      const org = await this.directory.findOrgById(input.orgId);
      if (!org) throw orgError('NOT_FOUND', 'Organization not found');
      if (input.name) org.name = validateOrgName(input.name);
      if (input.timezone) org.settings.defaultTimezone = validateTimezone(input.timezone);
      if (input.defaultLanguage) org.settings.defaultLanguage = input.defaultLanguage;
      if (input.invitationPolicy) org.settings.invitationPolicy = validateInvitePolicy(input.invitationPolicy);
      if (input.externalCommunication !== undefined) org.settings.externalCommunication = input.externalCommunication;
      if (input.channelCreationPolicy) {
        if (!(CHANNEL_POLICIES as readonly string[]).includes(input.channelCreationPolicy)) {
          throw orgError('VALIDATION_ERROR', 'Channel creation policy is invalid', [
            { field: 'channelCreationPolicy', message: 'Channel creation policy is invalid', code: 'INVALID' },
          ]);
        }
        org.settings.channelCreationPolicy = input.channelCreationPolicy as ChannelPolicy;
      }
      await this.directory.saveOrg(org);
      await this.audit.record({
        type: 'org_settings_updated',
        orgId: org.id,
        userId: input.actorId,
        email: actor.email,
        at: this.clock.now(),
        meta: { invitationPolicy: org.settings.invitationPolicy },
      });
      return org.toPublic();
    });
  }
}
