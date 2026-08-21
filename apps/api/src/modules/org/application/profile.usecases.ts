import type { ObjectStoragePort } from '@zoqo/shared';
import { orgError } from '../domain/org-error';
import { AVATAR_MAX_BYTES, LOGO_MAX_BYTES, PRESENCE, type Presence } from '../domain/policy';
import type { OrgDirectoryPort } from './ports/org-directory.port';
import { wrapOrg } from './wrap-org';

const IMAGE = /^(image\/png|image\/jpeg|image\/jpg|image\/webp)$/;
const LOGO = /^(image\/png|image\/jpeg|image\/jpg|image\/svg\+xml)$/;

export class GetProfileUseCase {
  constructor(private readonly directory: OrgDirectoryPort) {}

  execute(orgId: string, userId: string) {
    return wrapOrg(async () => {
      if (!(await this.directory.findMembership(orgId, userId))) {
        throw orgError('FORBIDDEN', 'Not a member of this organization');
      }
      const profile = await this.directory.findProfile(orgId, userId);
      if (!profile) throw orgError('NOT_FOUND', 'Profile not found');
      return profile.toPublic();
    });
  }
}

export class UpdateProfileUseCase {
  constructor(private readonly directory: OrgDirectoryPort) {}

  execute(input: {
    orgId: string;
    userId: string;
    displayName?: string;
    title?: string;
    phone?: string;
    timezone?: string;
    language?: string;
    bio?: string;
    presence?: string;
  }) {
    return wrapOrg(async () => {
      if (!(await this.directory.findMembership(input.orgId, input.userId))) {
        throw orgError('FORBIDDEN', 'Not a member of this organization');
      }
      const profile = await this.directory.findProfile(input.orgId, input.userId);
      if (!profile) throw orgError('NOT_FOUND', 'Profile not found');
      if (input.displayName !== undefined) profile.displayName = input.displayName.trim();
      if (input.title !== undefined) profile.title = input.title.trim();
      if (input.phone !== undefined) profile.phone = input.phone.trim();
      if (input.timezone !== undefined) profile.timezone = input.timezone;
      if (input.language !== undefined) profile.language = input.language;
      if (input.bio !== undefined) profile.bio = input.bio.trim();
      if (input.presence !== undefined) {
        if (!(PRESENCE as readonly string[]).includes(input.presence)) {
          throw orgError('VALIDATION_ERROR', 'Presence is invalid', [
            { field: 'presence', message: 'Presence is invalid', code: 'INVALID' },
          ]);
        }
        profile.presence = input.presence as Presence;
      }
      await this.directory.saveProfile(profile);
      return profile.toPublic();
    });
  }
}

export class RequestAvatarUploadUseCase {
  constructor(
    private readonly directory: OrgDirectoryPort,
    private readonly storage: ObjectStoragePort,
  ) {}

  execute(input: { orgId: string; userId: string; contentType: string; size: number }) {
    return wrapOrg(async () => {
      if (!(await this.directory.findMembership(input.orgId, input.userId))) {
        throw orgError('FORBIDDEN', 'Not a member of this organization');
      }
      if (!IMAGE.test(input.contentType)) {
        throw orgError('VALIDATION_ERROR', 'Avatar must be PNG, JPEG, or WebP', [
          { field: 'contentType', message: 'Avatar must be PNG, JPEG, or WebP', code: 'INVALID' },
        ]);
      }
      if (input.size > AVATAR_MAX_BYTES) {
        throw orgError('VALIDATION_ERROR', 'Avatar must be 5MB or smaller', [
          { field: 'size', message: 'Avatar must be 5MB or smaller', code: 'TOO_LARGE' },
        ]);
      }
      const key = `avatars/${input.orgId}/${input.userId}`;
      await this.storage.put(key, Buffer.alloc(0), input.contentType);
      const uploadUrl = await this.storage.getSignedUrl(key, 600);
      const profile = await this.directory.findProfile(input.orgId, input.userId);
      if (profile) {
        profile.avatarUrl = uploadUrl;
        await this.directory.saveProfile(profile);
      }
      return { uploadUrl, key };
    });
  }
}

export class RequestLogoUploadUseCase {
  constructor(
    private readonly directory: OrgDirectoryPort,
    private readonly storage: ObjectStoragePort,
  ) {}

  execute(input: { orgId: string; actorId: string; contentType: string; size: number }) {
    return wrapOrg(async () => {
      const actor = await this.directory.findMembership(input.orgId, input.actorId);
      if (!actor || (actor.role !== 'owner' && actor.role !== 'admin')) {
        throw orgError('FORBIDDEN', 'Only owners and admins can change the logo');
      }
      if (!LOGO.test(input.contentType)) {
        throw orgError('VALIDATION_ERROR', 'Logo must be PNG, JPEG, or SVG', [
          { field: 'contentType', message: 'Logo must be PNG, JPEG, or SVG', code: 'INVALID' },
        ]);
      }
      if (input.size > LOGO_MAX_BYTES) {
        throw orgError('VALIDATION_ERROR', 'Logo must be 2MB or smaller', [
          { field: 'size', message: 'Logo must be 2MB or smaller', code: 'TOO_LARGE' },
        ]);
      }
      const org = await this.directory.findOrgById(input.orgId);
      if (!org) throw orgError('NOT_FOUND', 'Organization not found');
      const key = `logos/${input.orgId}`;
      await this.storage.put(key, Buffer.alloc(0), input.contentType);
      const uploadUrl = await this.storage.getSignedUrl(key, 600);
      org.logoUrl = uploadUrl;
      await this.directory.saveOrg(org);
      return { uploadUrl, key };
    });
  }
}
