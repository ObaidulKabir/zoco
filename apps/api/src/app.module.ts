import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { HealthController } from './health.controller';
import { IdentityModule } from './modules/identity/identity.module';
import { AuthExceptionFilter } from './modules/identity/infrastructure/http/auth-exception.filter';
import { OrgModule } from './modules/org/org.module';

@Module({
  imports: [IdentityModule, OrgModule],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: AuthExceptionFilter }],
})
export class AppModule {}
