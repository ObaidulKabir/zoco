import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { HealthController } from './health.controller';
import { IdentityModule } from './modules/identity/identity.module';
import { AuthExceptionFilter } from './modules/identity/infrastructure/http/auth-exception.filter';
import { OrgModule } from './modules/org/org.module';
import { MessengerModule } from './modules/messenger/messenger.module';
import { ChannelsModule } from './modules/channels/channels.module';
import { MediaModule } from './modules/media/media.module';
import { B2bModule } from './modules/b2b/b2b.module';
import { requestIdMiddleware } from './request-id';

@Module({
  imports: [
    IdentityModule,
    OrgModule,
    MessengerModule,
    ChannelsModule.register(),
    MediaModule.register(),
    B2bModule.register(),
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: AuthExceptionFilter }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(requestIdMiddleware).forRoutes('*');
  }
}
