import { Global, Module } from '@nestjs/common';
import { isPostgresEnabled } from '../../db/pool';
import { IdentityModule } from '../identity/identity.module';
import { OrgModule } from '../org/org.module';
import { NestSystemClock } from '../identity/infrastructure/clock/nest-system-clock';
import { GetOrCreateDmUseCase } from './application/get-or-create-dm.usecase';
import { SendDmUseCase } from './application/send-dm.usecase';
import { EditMessageUseCase } from './application/edit-message.usecase';
import { DeleteMessageUseCase } from './application/delete-message.usecase';
import { ReactMessageUseCase } from './application/react-message.usecase';
import { PinMessageUseCase } from './application/pin-message.usecase';
import { ListConversationsUseCase } from './application/list-conversations.usecase';
import { GetMessagesUseCase } from './application/get-messages.usecase';
import { MarkReadUseCase } from './application/mark-read.usecase';
import {
  RegisterPrekeyBundleUseCase,
  GetPrekeyBundleUseCase,
} from './application/prekey-bundle.usecases';
import type { MessengerStorePort } from './application/ports/messenger-store.port';
import type { RealtimeNotifierPort } from './application/ports/realtime-notifier.port';
import { InMemoryMessengerStore } from './infrastructure/persistence/in-memory-messenger-store';
import { PgMessengerStore } from './infrastructure/persistence/pg-messenger-store';
import { InMemoryRealtimeNotifier } from './infrastructure/realtime/in-memory-realtime-notifier';
import { MessengerController } from './infrastructure/http/messenger.controller';
import { ORG_DIRECTORY } from '../org/org.tokens';
import { CheckB2bConnectionUseCase } from '../b2b/application/check-b2b-connection.usecase';
import { MESSENGER_STORE, REALTIME_NOTIFIER } from './messenger.tokens';
import { OrgDirectoryPort } from '../org/application/ports/org-directory.port';

@Global()
@Module({
  imports: [IdentityModule, OrgModule],
  controllers: [MessengerController],
  providers: [
    NestSystemClock,
    {
      provide: MESSENGER_STORE,
      useFactory: (): MessengerStorePort =>
        isPostgresEnabled() ? new PgMessengerStore() : new InMemoryMessengerStore(),
    },
    {
      provide: REALTIME_NOTIFIER,
      useClass: InMemoryRealtimeNotifier,
    },
    {
      provide: GetOrCreateDmUseCase,
      useFactory: (
        store: MessengerStorePort,
        clock: NestSystemClock,
        orgs: OrgDirectoryPort,
        b2bChecker?: CheckB2bConnectionUseCase,
      ) =>
        new GetOrCreateDmUseCase(store, clock, {
          isMember: async (orgId, userId) => !!(await orgs.findMembership(orgId, userId)),
          findOrgsForUser: async (userId) => (await orgs.listOrgsForUser(userId)).map((o) => o.id),
          areOrgsConnected: async (orgAId, orgBId) =>
            b2bChecker ? await b2bChecker.areConnected(orgAId, orgBId) : false,
        }),
      inject: [MESSENGER_STORE, NestSystemClock, ORG_DIRECTORY, { token: CheckB2bConnectionUseCase, optional: true }],
    },
    {
      provide: SendDmUseCase,
      useFactory: (store: MessengerStorePort, notifier: RealtimeNotifierPort, clock: NestSystemClock) =>
        new SendDmUseCase(store, notifier, clock),
      inject: [MESSENGER_STORE, REALTIME_NOTIFIER, NestSystemClock],
    },
    {
      provide: EditMessageUseCase,
      useFactory: (store: MessengerStorePort, notifier: RealtimeNotifierPort, clock: NestSystemClock) =>
        new EditMessageUseCase(store, notifier, clock),
      inject: [MESSENGER_STORE, REALTIME_NOTIFIER, NestSystemClock],
    },
    {
      provide: DeleteMessageUseCase,
      useFactory: (store: MessengerStorePort, notifier: RealtimeNotifierPort, clock: NestSystemClock) =>
        new DeleteMessageUseCase(store, notifier, clock),
      inject: [MESSENGER_STORE, REALTIME_NOTIFIER, NestSystemClock],
    },
    {
      provide: ReactMessageUseCase,
      useFactory: (store: MessengerStorePort, notifier: RealtimeNotifierPort, clock: NestSystemClock) =>
        new ReactMessageUseCase(store, notifier, clock),
      inject: [MESSENGER_STORE, REALTIME_NOTIFIER, NestSystemClock],
    },
    {
      provide: PinMessageUseCase,
      useFactory: (store: MessengerStorePort, notifier: RealtimeNotifierPort, clock: NestSystemClock) =>
        new PinMessageUseCase(store, notifier, clock),
      inject: [MESSENGER_STORE, REALTIME_NOTIFIER, NestSystemClock],
    },
    {
      provide: ListConversationsUseCase,
      useFactory: (store: MessengerStorePort) => new ListConversationsUseCase(store),
      inject: [MESSENGER_STORE],
    },
    {
      provide: GetMessagesUseCase,
      useFactory: (store: MessengerStorePort) => new GetMessagesUseCase(store),
      inject: [MESSENGER_STORE],
    },
    {
      provide: MarkReadUseCase,
      useFactory: (store: MessengerStorePort, notifier: RealtimeNotifierPort, clock: NestSystemClock) =>
        new MarkReadUseCase(store, notifier, clock),
      inject: [MESSENGER_STORE, REALTIME_NOTIFIER, NestSystemClock],
    },
    {
      provide: RegisterPrekeyBundleUseCase,
      useFactory: (store: MessengerStorePort, clock: NestSystemClock) =>
        new RegisterPrekeyBundleUseCase(store, clock),
      inject: [MESSENGER_STORE, NestSystemClock],
    },
    {
      provide: GetPrekeyBundleUseCase,
      useFactory: (store: MessengerStorePort) => new GetPrekeyBundleUseCase(store),
      inject: [MESSENGER_STORE],
    },
  ],
  exports: [MESSENGER_STORE, REALTIME_NOTIFIER],
})
export class MessengerModule {}
