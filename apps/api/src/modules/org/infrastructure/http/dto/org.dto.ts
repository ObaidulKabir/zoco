import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CHANNEL_POLICIES, INVITE_POLICIES, INVITE_ROLES, ORG_ROLES, ORG_SIZES, PRESENCE } from '../../../domain/policy';

/** See the note in the identity DTOs on why every property states its type. */
export class CreateOrgRequest {
  @ApiProperty({ type: String, example: 'Acme' })
  name!: string;

  @ApiProperty({ type: String, example: 'Software' })
  industry!: string;

  @ApiProperty({ type: String, enum: ORG_SIZES, example: '11-50' })
  size!: string;

  @ApiProperty({ type: String, example: 'BD', description: 'ISO 3166-1 alpha-2.' })
  country!: string;

  @ApiProperty({ type: String, example: 'Asia/Dhaka', description: 'IANA time zone.' })
  timezone!: string;
}

export class AcceptInviteRequest {
  @ApiProperty({
    type: String,
    description: 'Token from the invitation email. Single use, expires after 7 days.',
  })
  token!: string;
}

export class UpdateOrgRequest {
  @ApiPropertyOptional({ type: String })
  name?: string;

  @ApiPropertyOptional({ type: String, example: 'Asia/Dhaka' })
  timezone?: string;

  @ApiPropertyOptional({ type: String, example: 'en' })
  defaultLanguage?: string;

  @ApiPropertyOptional({ type: String, enum: INVITE_POLICIES })
  invitationPolicy?: string;

  @ApiPropertyOptional({ type: Boolean, description: 'Whether members may talk to other organizations.' })
  externalCommunication?: boolean;

  @ApiPropertyOptional({ type: String, enum: CHANNEL_POLICIES })
  channelCreationPolicy?: string;
}

export class InviteMembersRequest {
  @ApiPropertyOptional({
    type: [String],
    example: ['lee@acme.test', 'pat@acme.test'],
    description: 'Up to 100 per request. Supply this or csv.',
  })
  emails?: string[];

  @ApiPropertyOptional({
    type: String,
    description: 'Pasted CSV. Unparseable rows are reported rather than silently dropped.',
  })
  csv?: string;

  @ApiPropertyOptional({ type: String, enum: INVITE_ROLES, default: 'member' })
  role?: string;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  departmentId?: string;
}

export class UpdateMemberRequest {
  @ApiPropertyOptional({ type: String, enum: ORG_ROLES, description: 'The last owner cannot be demoted.' })
  role?: string;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  departmentId?: string | null;
}

export class CreateDepartmentRequest {
  @ApiProperty({ type: String, example: 'Engineering' })
  name!: string;

  @ApiPropertyOptional({ type: String })
  description?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Nesting is capped at 5 levels.',
  })
  parentId?: string | null;
}

export class UpdateDepartmentRequest {
  @ApiPropertyOptional({ type: String })
  name?: string;

  @ApiPropertyOptional({ type: String })
  description?: string;
}

export class DeleteDepartmentRequest {
  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    description: 'Where to move members of the deleted department. Required when it still has members.',
  })
  reassignToDepartmentId?: string;
}

export class CreateTeamRequest {
  @ApiProperty({ type: String, format: 'uuid' })
  departmentId!: string;

  @ApiProperty({ type: String, example: 'Platform' })
  name!: string;

  @ApiPropertyOptional({ type: String })
  description?: string;
}

export class UpdateTeamRequest {
  @ApiPropertyOptional({ type: String })
  name?: string;

  @ApiPropertyOptional({ type: String })
  description?: string;
}

export class UpdateProfileRequest {
  @ApiPropertyOptional({ type: String })
  displayName?: string;

  @ApiPropertyOptional({ type: String, example: 'Staff Engineer' })
  title?: string;

  @ApiPropertyOptional({ type: String })
  phone?: string;

  @ApiPropertyOptional({ type: String, example: 'Asia/Dhaka' })
  timezone?: string;

  @ApiPropertyOptional({ type: String, example: 'bn' })
  language?: string;

  @ApiPropertyOptional({ type: String })
  bio?: string;

  @ApiPropertyOptional({ type: String, enum: PRESENCE })
  presence?: string;
}

export class UploadUrlRequest {
  @ApiProperty({ type: String, example: 'image/png' })
  contentType!: string;

  @ApiProperty({ type: Number, description: 'Bytes. Avatars cap at 5 MB, logos at 2 MB.', example: 204800 })
  size!: number;
}

export class UploadUrlResponse {
  @ApiProperty({ type: String, description: 'Pre-signed PUT target on the object store.' })
  uploadUrl!: string;

  @ApiProperty({ type: String, description: 'Where the object will be readable once uploaded.' })
  publicUrl!: string;
}

export class OrgSettingsView {
  @ApiProperty({ type: String, enum: INVITE_POLICIES })
  invitationPolicy!: string;

  @ApiProperty({ type: String })
  defaultTimezone!: string;

  @ApiProperty({ type: String })
  defaultLanguage!: string;

  @ApiProperty({ type: Boolean })
  externalCommunication!: boolean;

  @ApiProperty({ type: Number })
  maxFileSizeMb!: number;

  @ApiProperty({ type: String, enum: CHANNEL_POLICIES })
  channelCreationPolicy!: string;
}

export class OrgView {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String, description: 'Derived from the name and unique across the install.' })
  slug!: string;

  @ApiProperty({ type: String })
  industry!: string;

  @ApiProperty({ type: String, enum: ORG_SIZES })
  size!: string;

  @ApiProperty({ type: String })
  country!: string;

  @ApiProperty({ type: String })
  timezone!: string;

  @ApiProperty({ type: String, nullable: true })
  logoUrl!: string | null;

  @ApiProperty({ type: OrgSettingsView })
  settings!: OrgSettingsView;
}

export class MemberView {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  orgId!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  userId!: string;

  @ApiProperty({ type: String, format: 'email' })
  email!: string;

  @ApiProperty({ type: String, enum: ORG_ROLES })
  role!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  departmentId!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  teamId!: string | null;
}

export class DepartmentView {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  orgId!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String })
  description!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  parentId!: string | null;

  @ApiProperty({ type: Number, minimum: 1, maximum: 5 })
  level!: number;
}

export class TeamView {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  orgId!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  departmentId!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String })
  description!: string;
}

export class MemberProfileView {
  @ApiProperty({ type: String, format: 'uuid' })
  userId!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  orgId!: string;

  @ApiProperty({ type: String })
  displayName!: string;

  @ApiProperty({ type: String })
  title!: string;

  @ApiProperty({ type: String })
  phone!: string;

  @ApiProperty({ type: String, nullable: true })
  avatarUrl!: string | null;

  @ApiProperty({ type: String })
  timezone!: string;

  @ApiProperty({ type: String })
  language!: string;

  @ApiProperty({ type: String })
  bio!: string;

  @ApiProperty({ type: String, enum: PRESENCE })
  presence!: string;
}

export class InvitationView {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  orgId!: string;

  @ApiProperty({ type: String, format: 'email' })
  email!: string;

  @ApiProperty({ type: String, enum: INVITE_ROLES })
  role!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  departmentId!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  expiresAt!: string;

  @ApiProperty({ type: String, enum: ['pending', 'accepted', 'expired'] })
  status!: string;
}
