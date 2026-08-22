import { Global, Module, type DynamicModule, type Provider } from '@nestjs/common';
import { SystemClock } from '@zoqo/shared';
import { B2B_STORE } from './b2b.tokens';
import { InMemoryB2bStore } from './infrastructure/persistence/in-memory-b2b-store';
import { SendConnectionRequestUseCase } from './application/send-connection-request.usecase';
import { AcceptConnectionRequestUseCase } from './application/accept-connection-request.usecase';
import { RejectConnectionRequestUseCase } from './application/reject-connection-request.usecase';
import { BlockConnectionRequestUseCase } from './application/block-connection-request.usecase';
import { DisconnectB2bUseCase } from './application/disconnect-b2b.usecase';
import { ListB2bConnectionsUseCase } from './application/list-b2b-connections.usecase';
import { CheckB2bConnectionUseCase } from './application/check-b2b-connection.usecase';
import { B2bController } from './infrastructure/http/b2b.controller';
import { AUDIT } from '../identity/identity.tokens';
import { REALTIME_NOTIFIER } from '../messenger/messenger.tokens';

const clockProvider: Provider = {
  provide: 'CLOCK',
  useValue: new SystemClock(),
};

@Global()
@Module({})
export class B2bModule {
  static register(options: { storeProvider?: Provider } = {}): DynamicModule {
    const store = options.storeProvider || {
      provide: B2B_STORE,
      useClass: InMemoryB2bStore,
    };

    const useCases: Provider[] = [
      {
        provide: SendConnectionRequestUseCase,
        useFactory: (s, c, a, n) => new SendConnectionRequestUseCase(s, c, a, n),
        inject: [B2B_STORE, 'CLOCK', { token: AUDIT, optional: true }, { token: REALTIME_NOTIFIER, optional: true }],
      },
      {
        provide: AcceptConnectionRequestUseCase,
        useFactory: (s, c, a) => new AcceptConnectionRequestUseCase(s, c, a),
        inject: [B2B_STORE, 'CLOCK', { token: AUDIT, optional: true }],
      },
      {
        provide: RejectConnectionRequestUseCase,
        useFactory: (s, c, a) => new RejectConnectionRequestUseCase(s, c, a),
        inject: [B2B_STORE, 'CLOCK', { token: AUDIT, optional: true }],
      },
      {
        provide: BlockConnectionRequestUseCase,
        useFactory: (s, c, a) => new BlockConnectionRequestUseCase(s, c, a),
        inject: [B2B_STORE, 'CLOCK', { token: AUDIT, optional: true }],
      },
      {
        provide: DisconnectB2bUseCase,
        useFactory: (s, c, a) => new DisconnectB2bUseCase(s, c, a),
        inject: [B2B_STORE, 'CLOCK', { token: AUDIT, optional: true }],
      },
      {
        provide: ListB2bConnectionsUseCase,
        useFactory: (s) => new ListB2bConnectionsUseCase(s),
        inject: [B2B_STORE],
      },
      {
        provide: CheckB2bConnectionUseCase,
        useFactory: (s) => new CheckB2bConnectionUseCase(s),
        inject: [B2B_STORE],
      },
    ];

    return {
      global: true,
      module: B2bModule,
      controllers: [B2bController],
      providers: [clockProvider, store, ...useCases],
      exports: [store, ...useCases],
    };
  }
}
