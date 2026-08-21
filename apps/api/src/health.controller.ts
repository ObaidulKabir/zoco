import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('platform')
@Controller()
export class HealthController {
  @Get('health')
  @ApiOperation({ summary: 'Liveness probe', description: 'Answers as long as the process is up.' })
  @ApiResponse({ status: 200, description: 'Process is alive.' })
  health() {
    return { status: 'ok' };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe', description: 'Answers when the API is willing to take traffic.' })
  @ApiResponse({ status: 200, description: 'Ready for traffic.' })
  ready() {
    return { status: 'ready' };
  }
}
