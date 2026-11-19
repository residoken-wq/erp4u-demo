import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import {
  normalizeProviderOverride,
  ProviderOverride,
} from '../utils/provider-override.util';
import { FILE_STORAGE, FileStorage } from './file-storage.interface';
import {
  LOCAL_STORAGE_OPTIONS,
  LocalFileStorage,
  LocalFileStorageOptions,
} from './local-file-storage.service';

export interface StorageModuleOptions extends LocalFileStorageOptions {
  fileStorage?: ProviderOverride<FileStorage>;
}

const DEFAULT_STORAGE_PROVIDERS: Provider[] = [
  LocalFileStorage,
  {
    provide: FILE_STORAGE,
    useExisting: LocalFileStorage,
  },
];

@Global()
@Module({
  providers: DEFAULT_STORAGE_PROVIDERS,
  exports: [FILE_STORAGE, LocalFileStorage],
})
export class StorageModule {
  static forRoot(options: StorageModuleOptions = {}): DynamicModule {
    const storageProvider: Provider = options.fileStorage
      ? normalizeProviderOverride(FILE_STORAGE, options.fileStorage)
      : {
          provide: FILE_STORAGE,
          useExisting: LocalFileStorage,
        };

    const providers: Provider[] = [
      {
        provide: LOCAL_STORAGE_OPTIONS,
        useValue: {
          baseDir: options.baseDir,
          publicPrefix: options.publicPrefix,
        },
      },
      LocalFileStorage,
      storageProvider,
    ];

    return {
      module: StorageModule,
      global: true,
      providers,
      exports: [FILE_STORAGE, LocalFileStorage],
    };
  }
}
