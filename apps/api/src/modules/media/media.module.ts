import { Module, type DynamicModule, type Provider } from '@nestjs/common';
import { SystemClock } from '@zoqo/shared';
import { MEDIA_STORE, STORAGE_ADAPTER, VIRUS_SCANNER } from './media.tokens';
import { InMemoryMediaStore } from './infrastructure/persistence/in-memory-media-store';
import { InMemoryStorageAdapter } from './infrastructure/storage/in-memory-storage.adapter';
import { InMemoryScannerAdapter } from './infrastructure/scanner/in-memory-scanner.adapter';
import { RequestUploadUrlUseCase } from './application/request-upload-url.usecase';
import { ScanAndConfirmUseCase, GetDownloadUrlUseCase } from './application/scan-and-confirm.usecase';
import { MediaController } from './infrastructure/http/media.controller';

import { IdentityModule } from '../identity/identity.module';
import { OrgModule } from '../org/org.module';

const clockProvider: Provider = {
  provide: 'CLOCK',
  useValue: new SystemClock(),
};

@Module({})
export class MediaModule {
  static register(
    options: {
      storeProvider?: Provider;
      storageProvider?: Provider;
      scannerProvider?: Provider;
    } = {},
  ): DynamicModule {
    const store = options.storeProvider || {
      provide: MEDIA_STORE,
      useClass: InMemoryMediaStore,
    };

    const storage = options.storageProvider || {
      provide: STORAGE_ADAPTER,
      useClass: InMemoryStorageAdapter,
    };

    const scanner = options.scannerProvider || {
      provide: VIRUS_SCANNER,
      useClass: InMemoryScannerAdapter,
    };

    const useCases: Provider[] = [
      {
        provide: RequestUploadUrlUseCase,
        useFactory: (s, st, c) => new RequestUploadUrlUseCase(s, st, c),
        inject: [MEDIA_STORE, STORAGE_ADAPTER, 'CLOCK'],
      },
      {
        provide: ScanAndConfirmUseCase,
        useFactory: (s, sc) => new ScanAndConfirmUseCase(s, sc),
        inject: [MEDIA_STORE, VIRUS_SCANNER],
      },
      {
        provide: GetDownloadUrlUseCase,
        useFactory: (s, st) => new GetDownloadUrlUseCase(s, st),
        inject: [MEDIA_STORE, STORAGE_ADAPTER],
      },
    ];

    return {
      module: MediaModule,
      imports: [IdentityModule, OrgModule],
      controllers: [MediaController],
      providers: [clockProvider, store, storage, scanner, ...useCases],
      exports: [store, storage, scanner, ...useCases],
    };
  }
}
