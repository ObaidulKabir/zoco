import { Controller, Get, Inject } from '@nestjs/common';
import { ListOrgsUseCase } from '../../application/list-orgs.usecase';

@Controller('v1/orgs')
export class OrgController {
  constructor(@Inject(ListOrgsUseCase) private readonly listOrgs: ListOrgsUseCase) {}

  @Get()
  async list() {
    const data = await this.listOrgs.execute();
    return { success: true, data };
  }
}
