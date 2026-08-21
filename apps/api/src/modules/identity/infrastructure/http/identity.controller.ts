import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthedErrors } from '../../../../openapi/envelope';
import { ListUsersUseCase } from '../../application/list-users.usecase';
import { AuthGuard } from './auth.guard';
import { PublicUser } from './dto/auth.dto';

@ApiTags('identity')
@Controller('v1/identity')
export class IdentityController {
  constructor(@Inject(ListUsersUseCase) private readonly listUsers: ListUsersUseCase) {}

  @Get('users')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List registered users', description: 'Development aid; not tenant-scoped.' })
  @ApiResponse({ status: 200, description: 'All registered users.', type: [PublicUser] })
  @ApiAuthedErrors()
  async users() {
    const data = await this.listUsers.execute();
    return { success: true, data: data.map((u) => u.toPublic()) };
  }
}
