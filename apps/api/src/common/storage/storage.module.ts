import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { S3StorageProvider } from './providers/s3-storage.provider';
import { STORAGE_PROVIDER, StorageService } from './storage.service';

@Module({
  providers: [
    LocalStorageProvider,
    S3StorageProvider,
    {
      provide: STORAGE_PROVIDER,
      inject: [ConfigService, LocalStorageProvider, S3StorageProvider],
      useFactory: (
        configService: ConfigService,
        localProvider: LocalStorageProvider,
        s3Provider: S3StorageProvider
      ) => {
        const driver = configService.get<string>('STORAGE_DRIVER', 'local');
        return driver === 's3' ? s3Provider : localProvider;
      },
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
