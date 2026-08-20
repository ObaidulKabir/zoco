import { Module } from '@nestjs/common';
import { ListOrgsUseCase } from './application/list-orgs.usecase';
import { OrgController } from './infrastructure/http/org.controller';
import { InMemoryOrgStore } from './infrastructure/persistence/in-memory-org-store';

@Module({
  controllers: [OrgController],
  providers: [
    InMemoryOrgStore,
    {
      provide: ListOrgsUseCase,
      useFactory: (store: InMemoryOrgStore) => new ListOrgsUseCase(store),
      inject: [InMemoryOrgStore],
    },
  ],
})
export class OrgModule {}
