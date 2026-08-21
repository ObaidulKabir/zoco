import { Module, type DynamicModule, type Provider } from '@nestjs/common';
import { SystemClock } from '@zoqo/shared';
import { CHANNEL_STORE } from './channels.tokens';
import { InMemoryChannelStore } from './infrastructure/persistence/in-memory-channel-store';
import { CreateChannelUseCase } from './application/create-channel.usecase';
import { JoinChannelUseCase, LeaveChannelUseCase } from './application/join-channel.usecase';
import { InviteChannelMemberUseCase } from './application/invite-channel-member.usecase';
import { SendChannelMessageUseCase } from './application/send-channel-message.usecase';
import { ListChannelsUseCase } from './application/list-channels.usecase';
import { GetChannelMessagesUseCase, GetThreadMessagesUseCase } from './application/get-channel-messages.usecase';
import { ArchiveChannelUseCase, CreateSharedChannelUseCase, AcceptSharedChannelUseCase } from './application/archive-channel.usecase';
import { ChannelController } from './infrastructure/http/channel.controller';
import { REALTIME_NOTIFIER } from '../messenger/messenger.tokens';
import { InMemoryRealtimeNotifier } from '../messenger/infrastructure/realtime/in-memory-realtime-notifier';

import { IdentityModule } from '../identity/identity.module';
import { OrgModule } from '../org/org.module';

const clockProvider: Provider = {
  provide: 'CLOCK',
  useValue: new SystemClock(),
};

@Module({})
export class ChannelsModule {
  static register(options: { storeProvider?: Provider; notifierProvider?: Provider } = {}): DynamicModule {
    const store = options.storeProvider || {
      provide: CHANNEL_STORE,
      useClass: InMemoryChannelStore,
    };

    const notifier = options.notifierProvider || {
      provide: REALTIME_NOTIFIER,
      useClass: InMemoryRealtimeNotifier,
    };

    const useCases: Provider[] = [
      {
        provide: CreateChannelUseCase,
        useFactory: (s, c) => new CreateChannelUseCase(s, c),
        inject: [CHANNEL_STORE, 'CLOCK'],
      },
      {
        provide: JoinChannelUseCase,
        useFactory: (s, c) => new JoinChannelUseCase(s, c),
        inject: [CHANNEL_STORE, 'CLOCK'],
      },
      {
        provide: LeaveChannelUseCase,
        useFactory: (s) => new LeaveChannelUseCase(s),
        inject: [CHANNEL_STORE],
      },
      {
        provide: InviteChannelMemberUseCase,
        useFactory: (s, c) => new InviteChannelMemberUseCase(s, c),
        inject: [CHANNEL_STORE, 'CLOCK'],
      },
      {
        provide: SendChannelMessageUseCase,
        useFactory: (s, n, c) => new SendChannelMessageUseCase(s, n, c),
        inject: [CHANNEL_STORE, REALTIME_NOTIFIER, 'CLOCK'],
      },
      {
        provide: ListChannelsUseCase,
        useFactory: (s) => new ListChannelsUseCase(s),
        inject: [CHANNEL_STORE],
      },
      {
        provide: GetChannelMessagesUseCase,
        useFactory: (s) => new GetChannelMessagesUseCase(s),
        inject: [CHANNEL_STORE],
      },
      {
        provide: GetThreadMessagesUseCase,
        useFactory: (s) => new GetThreadMessagesUseCase(s),
        inject: [CHANNEL_STORE],
      },
      {
        provide: ArchiveChannelUseCase,
        useFactory: (s, c) => new ArchiveChannelUseCase(s, c),
        inject: [CHANNEL_STORE, 'CLOCK'],
      },
      {
        provide: CreateSharedChannelUseCase,
        useFactory: (s, c) => new CreateSharedChannelUseCase(s, c),
        inject: [CHANNEL_STORE, 'CLOCK'],
      },
      {
        provide: AcceptSharedChannelUseCase,
        useFactory: (s, c) => new AcceptSharedChannelUseCase(s, c),
        inject: [CHANNEL_STORE, 'CLOCK'],
      },
    ];

    return {
      module: ChannelsModule,
      imports: [IdentityModule, OrgModule],
      controllers: [ChannelController],
      providers: [clockProvider, store, notifier, ...useCases],
      exports: [store, ...useCases],
    };
  }
}
