import type { ClockPort } from '@zoqo/shared';
import { Channel } from '../domain/channel';
import { Department } from '../domain/department';
import { DiscoverProfile } from '../domain/discover-profile';
import { newOrgId } from '../domain/ids';
import { MemberProfile } from '../domain/member-profile';
import { Membership } from '../domain/membership';
import { Organization } from '../domain/organization';
import { orgError } from '../domain/org-error';
import { FREE_ORG_CAP } from '../domain/policy';
import {
  slugify,
  uniqueSlug,
  validateCountry,
  validateIndustry,
  validateOrgName,
  validateSize,
  validateTimezone,
} from '../domain/validation';
import type { OrgDirectoryPort } from './ports/org-directory.port';
import type { PeoplePort } from './ports/people.port';
import { wrapOrg } from './wrap-org';

export class CreateOrganizationUseCase {
  constructor(
    private readonly directory: OrgDirectoryPort,
    private readonly people: PeoplePort,
    private readonly clock: ClockPort,
  ) {}

  execute(input: {
    userId: string;
    name: string;
    industry: string;
    size: string;
    country: string;
    timezone: string;
  }) {
    return wrapOrg(async () => {
      const person = await this.people.findById(input.userId);
      if (!person) throw orgError('UNAUTHORIZED', 'Unknown user');
      if ((await this.directory.countOrgsForUser(input.userId)) >= FREE_ORG_CAP) {
        throw orgError('VALIDATION_ERROR', `Free tier allows at most ${FREE_ORG_CAP} organizations`, [
          { field: 'name', message: `Free tier allows at most ${FREE_ORG_CAP} organizations`, code: 'LIMIT' },
        ]);
      }
      const name = validateOrgName(input.name);
      const industry = validateIndustry(input.industry);
      const size = validateSize(input.size);
      const country = validateCountry(input.country);
      const timezone = validateTimezone(input.timezone);
      const slug = uniqueSlug(slugify(name), new Set(await this.directory.listOrgSlugs()));
      const now = this.clock.now();
      const org = new Organization(
        newOrgId(),
        name,
        slug,
        industry,
        size,
        country,
        timezone,
        null,
        Organization.defaults(timezone),
        now,
      );
      await this.directory.saveOrg(org);
      const general = new Department(newOrgId(), org.id, 'General', 'Default department', null, 1);
      const management = new Department(newOrgId(), org.id, 'Management', 'Leadership', null, 1);
      await this.directory.saveDepartment(general);
      await this.directory.saveDepartment(management);
      const membership = new Membership(
        newOrgId(),
        org.id,
        person.id,
        person.email,
        'owner',
        general.id,
        null,
        now,
      );
      await this.directory.saveMembership(membership);
      const generalCh = new Channel(newOrgId(), org.id, 'general', 'general', [person.id]);
      const announceCh = new Channel(newOrgId(), org.id, 'announcements', 'announcements', [person.id]);
      await this.directory.saveChannel(generalCh);
      await this.directory.saveChannel(announceCh);
      await this.directory.saveProfile(
        new MemberProfile(person.id, org.id, person.name, '', '', null, timezone, 'en', '', 'offline'),
      );
      const discover = new DiscoverProfile(org.id, name, industry, country, false);
      await this.directory.saveDiscover(discover);
      return {
        organization: org.toPublic(),
        membership: membership.toPublic(),
        departments: [general.toPublic(), management.toPublic()],
        channels: [generalCh.toPublic(), announceCh.toPublic()],
        discoverProfile: discover.toPublic(),
      };
    });
  }
}
