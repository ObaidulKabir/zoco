import { orgError } from './org-error';
import { INDUSTRIES, isIndustry } from './industries';
import { INVITE_POLICIES, ORG_SIZES, type InvitePolicy, type OrgSize } from './policy';

const COUNTRY = /^[A-Z]{2}$/;

export const slugify = (name: string): string => {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'org';
};

export const uniqueSlug = (base: string, taken: Set<string>): string => {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
};

export const validateOrgName = (name: string): string => {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 200) {
    throw orgError('VALIDATION_ERROR', 'Organization name must be 2–200 characters', [
      { field: 'name', message: 'Organization name must be 2–200 characters', code: 'INVALID' },
    ]);
  }
  return trimmed;
};

export const validateIndustry = (industry: string): string => {
  if (!isIndustry(industry)) {
    throw orgError('VALIDATION_ERROR', `Industry must be one of: ${INDUSTRIES.slice(0, 3).join(', ')}…`, [
      { field: 'industry', message: 'Industry is not in the allowed list', code: 'INVALID' },
    ]);
  }
  return industry;
};

export const validateSize = (size: string): OrgSize => {
  if (!(ORG_SIZES as readonly string[]).includes(size)) {
    throw orgError('VALIDATION_ERROR', 'Organization size is invalid', [
      { field: 'size', message: 'Organization size is invalid', code: 'INVALID' },
    ]);
  }
  return size as OrgSize;
};

export const validateCountry = (country: string): string => {
  const value = country.trim().toUpperCase();
  if (!COUNTRY.test(value)) {
    throw orgError('VALIDATION_ERROR', 'Country must be an ISO 3166 alpha-2 code', [
      { field: 'country', message: 'Country must be an ISO 3166 alpha-2 code', code: 'INVALID' },
    ]);
  }
  return value;
};

export const validateTimezone = (timezone: string): string => {
  const zones = new Set(Intl.supportedValuesOf('timeZone'));
  if (!zones.has(timezone)) {
    throw orgError('VALIDATION_ERROR', 'Timezone must be a valid IANA name', [
      { field: 'timezone', message: 'Timezone must be a valid IANA name', code: 'INVALID' },
    ]);
  }
  return timezone;
};

export const validateInvitePolicy = (policy: string): InvitePolicy => {
  if (!(INVITE_POLICIES as readonly string[]).includes(policy)) {
    throw orgError('VALIDATION_ERROR', 'Invitation policy is invalid', [
      { field: 'invitationPolicy', message: 'Invitation policy is invalid', code: 'INVALID' },
    ]);
  }
  return policy as InvitePolicy;
};
