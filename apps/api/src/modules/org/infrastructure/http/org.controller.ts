import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthedErrors, ApiConflict, ApiOrgScoped } from '../../../../openapi/envelope';
import { AuthGuard, type AuthedRequest } from '../../../identity/infrastructure/http/auth.guard';
import { CreateOrganizationUseCase } from '../../application/create-organization.usecase';
import {
  CreateDepartmentUseCase,
  DeleteDepartmentUseCase,
  ListDepartmentsUseCase,
  UpdateDepartmentUseCase,
} from '../../application/departments.usecases';
import { GetOrganizationUseCase } from '../../application/get-organization.usecase';
import { AcceptInviteUseCase, InviteMembersUseCase } from '../../application/invite.usecases';
import { ListOrgsUseCase } from '../../application/list-orgs.usecase';
import { ListMembersUseCase, RemoveMemberUseCase, UpdateMemberRoleUseCase } from '../../application/members.usecases';
import {
  GetProfileUseCase,
  RequestAvatarUploadUseCase,
  RequestLogoUploadUseCase,
  UpdateProfileUseCase,
} from '../../application/profile.usecases';
import { UpdateOrgSettingsUseCase } from '../../application/settings.usecase';
import { CreateTeamUseCase, DeleteTeamUseCase, ListTeamsUseCase, UpdateTeamUseCase } from '../../application/teams.usecases';
import {
  AcceptInviteRequest,
  CreateDepartmentRequest,
  CreateOrgRequest,
  CreateTeamRequest,
  DeleteDepartmentRequest,
  DepartmentView,
  InvitationView,
  InviteMembersRequest,
  MemberProfileView,
  MemberView,
  OrgView,
  TeamView,
  UpdateDepartmentRequest,
  UpdateMemberRequest,
  UpdateOrgRequest,
  UpdateProfileRequest,
  UpdateTeamRequest,
  UploadUrlRequest,
  UploadUrlResponse,
} from './dto/org.dto';
import { unwrapOrg } from './envelope';
import { OrgGuard, type OrgRequest } from './org.guard';

@ApiTags('org')
@Controller('v1/orgs')
export class OrgController {
  constructor(
    @Inject(CreateOrganizationUseCase) private readonly createOrg: CreateOrganizationUseCase,
    @Inject(ListOrgsUseCase) private readonly listOrgs: ListOrgsUseCase,
    @Inject(GetOrganizationUseCase) private readonly getOrg: GetOrganizationUseCase,
    @Inject(InviteMembersUseCase) private readonly inviteMembers: InviteMembersUseCase,
    @Inject(AcceptInviteUseCase) private readonly acceptInvite: AcceptInviteUseCase,
    @Inject(ListMembersUseCase) private readonly listMembers: ListMembersUseCase,
    @Inject(UpdateMemberRoleUseCase) private readonly updateMember: UpdateMemberRoleUseCase,
    @Inject(RemoveMemberUseCase) private readonly removeMember: RemoveMemberUseCase,
    @Inject(CreateDepartmentUseCase) private readonly createDept: CreateDepartmentUseCase,
    @Inject(ListDepartmentsUseCase) private readonly listDepts: ListDepartmentsUseCase,
    @Inject(UpdateDepartmentUseCase) private readonly updateDept: UpdateDepartmentUseCase,
    @Inject(DeleteDepartmentUseCase) private readonly deleteDept: DeleteDepartmentUseCase,
    @Inject(CreateTeamUseCase) private readonly createTeam: CreateTeamUseCase,
    @Inject(ListTeamsUseCase) private readonly listTeamsUc: ListTeamsUseCase,
    @Inject(UpdateTeamUseCase) private readonly updateTeam: UpdateTeamUseCase,
    @Inject(DeleteTeamUseCase) private readonly deleteTeam: DeleteTeamUseCase,
    @Inject(GetProfileUseCase) private readonly getProfile: GetProfileUseCase,
    @Inject(UpdateProfileUseCase) private readonly updateProfile: UpdateProfileUseCase,
    @Inject(RequestAvatarUploadUseCase) private readonly avatarUpload: RequestAvatarUploadUseCase,
    @Inject(RequestLogoUploadUseCase) private readonly logoUpload: RequestLogoUploadUseCase,
    @Inject(UpdateOrgSettingsUseCase) private readonly updateSettings: UpdateOrgSettingsUseCase,
  ) {}

  @Post()
  @UseGuards(AuthGuard)
  @HttpCode(201)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Create an organization',
    description: 'The caller becomes its owner. Free plan installs cap each person at 10 organizations.',
  })
  @ApiResponse({ status: 201, description: 'Organization created.', type: OrgView })
  @ApiConflict('An organization with this slug already exists.')
  @ApiAuthedErrors()
  async create(@Req() req: AuthedRequest, @Body() body: CreateOrgRequest) {
    const data = unwrapOrg(
      await this.createOrg.execute({
        userId: req.userId,
        name: body.name ?? '',
        industry: body.industry ?? '',
        size: body.size ?? '',
        country: body.country ?? '',
        timezone: body.timezone ?? '',
      }),
    );
    return { success: true, data };
  }

  @Get()
  @UseGuards(AuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List the organizations the caller belongs to' })
  @ApiResponse({ status: 200, description: 'Organizations.', type: [OrgView] })
  @ApiAuthedErrors()
  async list(@Req() req: AuthedRequest) {
    const orgs = await this.listOrgs.execute(req.userId);
    return { success: true, data: orgs.map((o) => o.toPublic()) };
  }

  @Post('invitations/accept')
  @UseGuards(AuthGuard)
  @HttpCode(200)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Accept an invitation',
    description: 'Joins the inviting organization. Expired or already-used tokens are refused.',
  })
  @ApiResponse({ status: 200, description: 'Joined.', type: MemberView })
  @ApiAuthedErrors()
  async accept(@Req() req: AuthedRequest, @Body() body: AcceptInviteRequest) {
    const data = unwrapOrg(await this.acceptInvite.execute({ userId: req.userId, token: body.token ?? '' }));
    return { success: true, data };
  }

  @Get('members')
  @UseGuards(AuthGuard, OrgGuard)
  @ApiOrgScoped()
  @ApiOperation({
    summary: 'List members of the acting organization',
    description: 'Same as GET /v1/orgs/{orgId}/members, with the organization taken from the header.',
  })
  @ApiResponse({ status: 200, description: 'Members.', type: [MemberView] })
  async membersByHeader(@Req() req: OrgRequest) {
    const data = unwrapOrg(await this.listMembers.execute(req.orgId, req.userId));
    return { success: true, data };
  }

  @Get(':orgId')
  @UseGuards(AuthGuard, OrgGuard)
  @ApiOrgScoped()
  @ApiOperation({ summary: 'Get one organization' })
  @ApiResponse({ status: 200, description: 'Organization.', type: OrgView })
  async get(@Req() req: OrgRequest) {
    const data = unwrapOrg(await this.getOrg.execute(req.orgId, req.userId));
    return { success: true, data };
  }

  @Patch(':orgId')
  @UseGuards(AuthGuard, OrgGuard)
  @ApiOrgScoped()
  @ApiOperation({
    summary: 'Update organization name and settings',
    description: 'Admin or owner only. Settings changes are written to the audit log.',
  })
  @ApiResponse({ status: 200, description: 'Updated organization.', type: OrgView })
  async patch(@Req() req: OrgRequest, @Body() body: UpdateOrgRequest) {
    const data = unwrapOrg(await this.updateSettings.execute({ orgId: req.orgId, actorId: req.userId, ...body }));
    return { success: true, data };
  }

  @Post(':orgId/invite')
  @UseGuards(AuthGuard, OrgGuard)
  @HttpCode(201)
  @ApiOrgScoped()
  @ApiOperation({
    summary: 'Invite people by email or pasted CSV',
    description:
      'Who may invite depends on the organization invitationPolicy. Rows that cannot be parsed are ' +
      'returned as rejects rather than dropped, so the caller can correct them.',
  })
  @ApiResponse({ status: 201, description: 'Invitations created.', type: [InvitationView] })
  async invite(@Req() req: OrgRequest, @Body() body: InviteMembersRequest) {
    const data = unwrapOrg(
      await this.inviteMembers.execute({
        orgId: req.orgId,
        actorId: req.userId,
        emails: body.emails,
        csv: body.csv,
        role: body.role,
        departmentId: body.departmentId,
      }),
    );
    return { success: true, data };
  }

  @Get(':orgId/members')
  @UseGuards(AuthGuard, OrgGuard)
  @ApiOrgScoped()
  @ApiOperation({ summary: 'List members of an organization' })
  @ApiResponse({ status: 200, description: 'Members.', type: [MemberView] })
  async members(@Req() req: OrgRequest) {
    const data = unwrapOrg(await this.listMembers.execute(req.orgId, req.userId));
    return { success: true, data };
  }

  @Patch(':orgId/members/:userId')
  @UseGuards(AuthGuard, OrgGuard)
  @ApiOrgScoped()
  @ApiOperation({
    summary: "Change a member's role or department",
    description: 'Demoting the last owner is refused, so an organization always has one.',
  })
  @ApiResponse({ status: 200, description: 'Updated member.', type: MemberView })
  async patchMember(
    @Req() req: OrgRequest,
    @Param('userId') userId: string,
    @Body() body: UpdateMemberRequest,
  ) {
    const data = unwrapOrg(
      await this.updateMember.execute({
        orgId: req.orgId,
        actorId: req.userId,
        userId,
        role: body.role,
        departmentId: body.departmentId,
      }),
    );
    return { success: true, data };
  }

  @Delete(':orgId/members/:userId')
  @UseGuards(AuthGuard, OrgGuard)
  @HttpCode(204)
  @ApiOrgScoped()
  @ApiOperation({ summary: 'Remove a member from an organization' })
  @ApiResponse({ status: 204, description: 'Member removed.' })
  async deleteMember(@Req() req: OrgRequest, @Param('userId') userId: string) {
    unwrapOrg(await this.removeMember.execute({ orgId: req.orgId, actorId: req.userId, userId }));
  }

  @Get(':orgId/departments')
  @UseGuards(AuthGuard, OrgGuard)
  @ApiOrgScoped()
  @ApiOperation({ summary: 'List departments' })
  @ApiResponse({ status: 200, description: 'Departments.', type: [DepartmentView] })
  async departments(@Req() req: OrgRequest) {
    const data = unwrapOrg(await this.listDepts.execute(req.orgId, req.userId));
    return { success: true, data };
  }

  @Post(':orgId/departments')
  @UseGuards(AuthGuard, OrgGuard)
  @HttpCode(201)
  @ApiOrgScoped()
  @ApiOperation({ summary: 'Create a department', description: 'Nesting is capped at 5 levels.' })
  @ApiResponse({ status: 201, description: 'Department created.', type: DepartmentView })
  @ApiConflict('A department with this name already exists here.')
  async addDepartment(@Req() req: OrgRequest, @Body() body: CreateDepartmentRequest) {
    const data = unwrapOrg(
      await this.createDept.execute({
        orgId: req.orgId,
        actorId: req.userId,
        name: body.name ?? '',
        description: body.description,
        parentId: body.parentId,
      }),
    );
    return { success: true, data };
  }

  @Patch(':orgId/departments/:deptId')
  @UseGuards(AuthGuard, OrgGuard)
  @ApiOrgScoped()
  @ApiOperation({ summary: 'Rename or describe a department' })
  @ApiResponse({ status: 200, description: 'Updated department.', type: DepartmentView })
  async patchDepartment(
    @Req() req: OrgRequest,
    @Param('deptId') deptId: string,
    @Body() body: UpdateDepartmentRequest,
  ) {
    const data = unwrapOrg(
      await this.updateDept.execute({ orgId: req.orgId, actorId: req.userId, deptId, ...body }),
    );
    return { success: true, data };
  }

  @Delete(':orgId/departments/:deptId')
  @UseGuards(AuthGuard, OrgGuard)
  @HttpCode(204)
  @ApiOrgScoped()
  @ApiOperation({
    summary: 'Delete a department',
    description: 'Members must be reassigned in the same call, so nobody is orphaned.',
  })
  @ApiResponse({ status: 204, description: 'Department deleted.' })
  async removeDepartment(
    @Req() req: OrgRequest,
    @Param('deptId') deptId: string,
    @Body() body: DeleteDepartmentRequest,
  ) {
    unwrapOrg(
      await this.deleteDept.execute({
        orgId: req.orgId,
        actorId: req.userId,
        deptId,
        reassignToDepartmentId: body.reassignToDepartmentId,
      }),
    );
  }

  @Get(':orgId/teams')
  @UseGuards(AuthGuard, OrgGuard)
  @ApiOrgScoped()
  @ApiOperation({ summary: 'List teams' })
  @ApiResponse({ status: 200, description: 'Teams.', type: [TeamView] })
  async teams(@Req() req: OrgRequest) {
    const data = unwrapOrg(await this.listTeamsUc.execute(req.orgId, req.userId));
    return { success: true, data };
  }

  @Post(':orgId/teams')
  @UseGuards(AuthGuard, OrgGuard)
  @HttpCode(201)
  @ApiOrgScoped()
  @ApiOperation({ summary: 'Create a team inside a department' })
  @ApiResponse({ status: 201, description: 'Team created.', type: TeamView })
  async addTeam(@Req() req: OrgRequest, @Body() body: CreateTeamRequest) {
    const data = unwrapOrg(
      await this.createTeam.execute({
        orgId: req.orgId,
        actorId: req.userId,
        departmentId: body.departmentId ?? '',
        name: body.name ?? '',
        description: body.description,
      }),
    );
    return { success: true, data };
  }

  @Patch(':orgId/teams/:teamId')
  @UseGuards(AuthGuard, OrgGuard)
  @ApiOrgScoped()
  @ApiOperation({ summary: 'Rename or describe a team' })
  @ApiResponse({ status: 200, description: 'Updated team.', type: TeamView })
  async patchTeam(
    @Req() req: OrgRequest,
    @Param('teamId') teamId: string,
    @Body() body: UpdateTeamRequest,
  ) {
    const data = unwrapOrg(await this.updateTeam.execute({ orgId: req.orgId, actorId: req.userId, teamId, ...body }));
    return { success: true, data };
  }

  @Delete(':orgId/teams/:teamId')
  @UseGuards(AuthGuard, OrgGuard)
  @HttpCode(204)
  @ApiOrgScoped()
  @ApiOperation({ summary: 'Delete a team' })
  @ApiResponse({ status: 204, description: 'Team deleted.' })
  async removeTeam(@Req() req: OrgRequest, @Param('teamId') teamId: string) {
    unwrapOrg(await this.deleteTeam.execute({ orgId: req.orgId, actorId: req.userId, teamId }));
  }

  @Get(':orgId/profile')
  @UseGuards(AuthGuard, OrgGuard)
  @ApiOrgScoped()
  @ApiOperation({
    summary: "Get the caller's profile in this organization",
    description: 'Profiles are per-organization, so the same person can present differently in each.',
  })
  @ApiResponse({ status: 200, description: 'Profile.', type: MemberProfileView })
  async profile(@Req() req: OrgRequest) {
    const data = unwrapOrg(await this.getProfile.execute(req.orgId, req.userId));
    return { success: true, data };
  }

  @Patch(':orgId/profile')
  @UseGuards(AuthGuard, OrgGuard)
  @ApiOrgScoped()
  @ApiOperation({ summary: "Update the caller's profile in this organization" })
  @ApiResponse({ status: 200, description: 'Updated profile.', type: MemberProfileView })
  async patchProfile(@Req() req: OrgRequest, @Body() body: UpdateProfileRequest) {
    const data = unwrapOrg(await this.updateProfile.execute({ orgId: req.orgId, userId: req.userId, ...body }));
    return { success: true, data };
  }

  @Post(':orgId/profile/avatar-url')
  @UseGuards(AuthGuard, OrgGuard)
  @HttpCode(200)
  @ApiOrgScoped()
  @ApiOperation({
    summary: 'Get a pre-signed URL for an avatar upload',
    description: 'The image goes straight to object storage; the API never proxies the bytes. Max 5 MB.',
  })
  @ApiResponse({ status: 200, description: 'Upload target.', type: UploadUrlResponse })
  async avatar(@Req() req: OrgRequest, @Body() body: UploadUrlRequest) {
    const data = unwrapOrg(
      await this.avatarUpload.execute({
        orgId: req.orgId,
        userId: req.userId,
        contentType: body.contentType ?? '',
        size: body.size ?? 0,
      }),
    );
    return { success: true, data };
  }

  @Post(':orgId/logo-url')
  @UseGuards(AuthGuard, OrgGuard)
  @HttpCode(200)
  @ApiOrgScoped()
  @ApiOperation({
    summary: 'Get a pre-signed URL for an organization logo upload',
    description: 'Admin or owner only. Max 2 MB.',
  })
  @ApiResponse({ status: 200, description: 'Upload target.', type: UploadUrlResponse })
  async logo(@Req() req: OrgRequest, @Body() body: UploadUrlRequest) {
    const data = unwrapOrg(
      await this.logoUpload.execute({
        orgId: req.orgId,
        actorId: req.userId,
        contentType: body.contentType ?? '',
        size: body.size ?? 0,
      }),
    );
    return { success: true, data };
  }

  @Get(':orgId/chart')
  @UseGuards(AuthGuard, OrgGuard)
  @ApiOrgScoped()
  @ApiOperation({
    summary: 'Get the organization chart',
    description: 'Not implemented yet. ORG-DEPT org chart is a P1 carried forward from Sprint 2.',
  })
  @ApiResponse({ status: 501, description: 'Not implemented.' })
  chart() {
    throw new HttpException(
      {
        success: false,
        error: { code: 'NOT_IMPLEMENTED', message: 'Org chart ships later if not completed in Sprint 2.' },
      },
      501,
    );
  }
}
