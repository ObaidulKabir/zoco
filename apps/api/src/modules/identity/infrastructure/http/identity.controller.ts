import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { ListUsersUseCase } from '../../application/list-users.usecase';
import { AuthGuard } from './auth.guard';

@Controller('v1/identity')
export class IdentityController {
  constructor(@Inject(ListUsersUseCase) private readonly listUsers: ListUsersUseCase) {}

  @Get('users')
  @UseGuards(AuthGuard)
  async users() {
    const data = await this.listUsers.execute();
    return { success: true, data: data.map((u) => u.toPublic()) };
  }
}
