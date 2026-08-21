import { Global, Module } from '@nestjs/common';
import { InMemoryObjectStorage, type MailerPort, type ObjectStoragePort } from '@zoqo/shared';
import { isPostgresEnabled } from '../../db/pool';
import { IdentityModule } from '../identity/identity.module';
import { AUDIT, INVITATION_REGISTRY, MAILER, USER_STORE } from '../identity/identity.tokens';
import type { AuditPort } from '../identity/application/ports/audit.port';
import type { InvitationRegistryPort } from '../identity/application/ports/invitation-lookup.port';
import type { UserStorePort } from '../identity/application/ports/user-store.port';
import { NestSystemClock } from '../identity/infrastructure/clock/nest-system-clock';
import { CreateOrganizationUseCase } from './application/create-organization.usecase';
import {
  CreateDepartmentUseCase,
  DeleteDepartmentUseCase,
  ListDepartmentsUseCase,
  UpdateDepartmentUseCase,
} from './application/departments.usecases';
import { GetOrganizationUseCase } from './application/get-organization.usecase';
import { AcceptInviteUseCase, InviteMembersUseCase } from './application/invite.usecases';
import { ListOrgsUseCase } from './application/list-orgs.usecase';
import { ListMembersUseCase, RemoveMemberUseCase, UpdateMemberRoleUseCase } from './application/members.usecases';
import {
  GetProfileUseCase,
  RequestAvatarUploadUseCase,
  RequestLogoUploadUseCase,
  UpdateProfileUseCase,
} from './application/profile.usecases';
import type { OrgDirectoryPort } from './application/ports/org-directory.port';
import { UpdateOrgSettingsUseCase } from './application/settings.usecase';
import { CreateTeamUseCase, DeleteTeamUseCase, ListTeamsUseCase, UpdateTeamUseCase } from './application/teams.usecases';
import { IdentityInviteRegistryAdapter } from './infrastructure/identity-invite-registry.adapter';
import { IdentityOrgAuditAdapter } from './infrastructure/identity-org-audit.adapter';
import { IdentityPeopleAdapter } from './infrastructure/identity-people.adapter';
import { OrgController } from './infrastructure/http/org.controller';
import { OrgGuard } from './infrastructure/http/org.guard';
import { InMemoryOrgDirectory } from './infrastructure/persistence/in-memory-org-directory';
import { PgOrgDirectory } from './infrastructure/persistence/pg-org-directory';
import { OBJECT_STORAGE, ORG_DIRECTORY } from './org.tokens';

@Global()
@Module({
  imports: [IdentityModule],
  controllers: [OrgController],
  providers: [
    OrgGuard,
    { provide: OBJECT_STORAGE, useClass: InMemoryObjectStorage },
    {
      provide: ORG_DIRECTORY,
      useFactory: (): OrgDirectoryPort =>
        isPostgresEnabled() ? new PgOrgDirectory() : new InMemoryOrgDirectory(),
    },
    {
      provide: IdentityPeopleAdapter,
      useFactory: (users: UserStorePort) => new IdentityPeopleAdapter(users),
      inject: [USER_STORE],
    },
    {
      provide: IdentityOrgAuditAdapter,
      useFactory: (audit: AuditPort) => new IdentityOrgAuditAdapter(audit),
      inject: [AUDIT],
    },
    {
      provide: IdentityInviteRegistryAdapter,
      useFactory: (registry: InvitationRegistryPort) => new IdentityInviteRegistryAdapter(registry),
      inject: [INVITATION_REGISTRY],
    },
    {
      provide: CreateOrganizationUseCase,
      useFactory: (dir: OrgDirectoryPort, people: IdentityPeopleAdapter, clock: NestSystemClock) =>
        new CreateOrganizationUseCase(dir, people, clock),
      inject: [ORG_DIRECTORY, IdentityPeopleAdapter, NestSystemClock],
    },
    {
      provide: ListOrgsUseCase,
      useFactory: (dir: OrgDirectoryPort) => new ListOrgsUseCase(dir),
      inject: [ORG_DIRECTORY],
    },
    {
      provide: GetOrganizationUseCase,
      useFactory: (dir: OrgDirectoryPort) => new GetOrganizationUseCase(dir),
      inject: [ORG_DIRECTORY],
    },
    {
      provide: InviteMembersUseCase,
      useFactory: (
        dir: OrgDirectoryPort,
        people: IdentityPeopleAdapter,
        mailer: MailerPort,
        clock: NestSystemClock,
        registry: IdentityInviteRegistryAdapter,
      ) =>
        new InviteMembersUseCase(
          dir,
          people,
          mailer,
          clock,
          process.env.WEB_URL ?? 'http://localhost:3000',
          registry,
        ),
      inject: [ORG_DIRECTORY, IdentityPeopleAdapter, MAILER, NestSystemClock, IdentityInviteRegistryAdapter],
    },
    {
      provide: AcceptInviteUseCase,
      useFactory: (dir: OrgDirectoryPort, people: IdentityPeopleAdapter, clock: NestSystemClock) =>
        new AcceptInviteUseCase(dir, people, clock),
      inject: [ORG_DIRECTORY, IdentityPeopleAdapter, NestSystemClock],
    },
    {
      provide: ListMembersUseCase,
      useFactory: (dir: OrgDirectoryPort) => new ListMembersUseCase(dir),
      inject: [ORG_DIRECTORY],
    },
    {
      provide: UpdateMemberRoleUseCase,
      useFactory: (dir: OrgDirectoryPort) => new UpdateMemberRoleUseCase(dir),
      inject: [ORG_DIRECTORY],
    },
    {
      provide: RemoveMemberUseCase,
      useFactory: (dir: OrgDirectoryPort) => new RemoveMemberUseCase(dir),
      inject: [ORG_DIRECTORY],
    },
    {
      provide: ListDepartmentsUseCase,
      useFactory: (dir: OrgDirectoryPort) => new ListDepartmentsUseCase(dir),
      inject: [ORG_DIRECTORY],
    },
    {
      provide: CreateDepartmentUseCase,
      useFactory: (dir: OrgDirectoryPort) => new CreateDepartmentUseCase(dir),
      inject: [ORG_DIRECTORY],
    },
    {
      provide: UpdateDepartmentUseCase,
      useFactory: (dir: OrgDirectoryPort) => new UpdateDepartmentUseCase(dir),
      inject: [ORG_DIRECTORY],
    },
    {
      provide: DeleteDepartmentUseCase,
      useFactory: (dir: OrgDirectoryPort) => new DeleteDepartmentUseCase(dir),
      inject: [ORG_DIRECTORY],
    },
    {
      provide: ListTeamsUseCase,
      useFactory: (dir: OrgDirectoryPort) => new ListTeamsUseCase(dir),
      inject: [ORG_DIRECTORY],
    },
    {
      provide: CreateTeamUseCase,
      useFactory: (dir: OrgDirectoryPort) => new CreateTeamUseCase(dir),
      inject: [ORG_DIRECTORY],
    },
    {
      provide: UpdateTeamUseCase,
      useFactory: (dir: OrgDirectoryPort) => new UpdateTeamUseCase(dir),
      inject: [ORG_DIRECTORY],
    },
    {
      provide: DeleteTeamUseCase,
      useFactory: (dir: OrgDirectoryPort) => new DeleteTeamUseCase(dir),
      inject: [ORG_DIRECTORY],
    },
    {
      provide: GetProfileUseCase,
      useFactory: (dir: OrgDirectoryPort) => new GetProfileUseCase(dir),
      inject: [ORG_DIRECTORY],
    },
    {
      provide: UpdateProfileUseCase,
      useFactory: (dir: OrgDirectoryPort) => new UpdateProfileUseCase(dir),
      inject: [ORG_DIRECTORY],
    },
    {
      provide: RequestAvatarUploadUseCase,
      useFactory: (dir: OrgDirectoryPort, storage: ObjectStoragePort) =>
        new RequestAvatarUploadUseCase(dir, storage),
      inject: [ORG_DIRECTORY, OBJECT_STORAGE],
    },
    {
      provide: RequestLogoUploadUseCase,
      useFactory: (dir: OrgDirectoryPort, storage: ObjectStoragePort) => new RequestLogoUploadUseCase(dir, storage),
      inject: [ORG_DIRECTORY, OBJECT_STORAGE],
    },
    {
      provide: UpdateOrgSettingsUseCase,
      useFactory: (dir: OrgDirectoryPort, audit: IdentityOrgAuditAdapter, clock: NestSystemClock) =>
        new UpdateOrgSettingsUseCase(dir, audit, clock),
      inject: [ORG_DIRECTORY, IdentityOrgAuditAdapter, NestSystemClock],
    },
  ],
  exports: [ORG_DIRECTORY],
})
export class OrgModule {}
