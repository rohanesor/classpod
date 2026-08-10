import { Inject, Injectable } from '@nestjs/common';
import { IStorageProvider, StorageResult } from './interfaces/storage-provider.interface';
import * as fs from 'fs';

export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';

@Injectable()
export class StorageService {
  constructor(
    @Inject(STORAGE_PROVIDER)
    private readonly provider: IStorageProvider
  ) {}

  async upload(
    filename: string,
    buffer: Buffer,
    mimeType: string,
    pathPrefix?: string
  ): Promise<StorageResult> {
    return this.provider.upload(filename, buffer, mimeType, pathPrefix);
  }

  getUrl(storagePath: string): string {
    return this.provider.getUrl(storagePath);
  }

  async delete(storagePath: string): Promise<void> {
    return this.provider.delete(storagePath);
  }

  // Exposed specifically for LocalStorageProvider download controller utility
  getReadStream(storagePath: string): fs.ReadStream {
    if ('getLocalReadStream' in this.provider) {
      return (this.provider as any).getLocalReadStream(storagePath);
    }
    throw new Error('Streaming not supported by current storage provider');
  }

  getFilePath(storagePath: string): string {
    if ('getLocalFilePath' in this.provider) {
      return (this.provider as any).getLocalFilePath(storagePath);
    }
    throw new Error('Local file path retrieval not supported by current storage provider');
  }

  fileExists(storagePath: string): boolean {
    if ('fileExists' in this.provider) {
      return (this.provider as any).fileExists(storagePath);
    }
    const path = this.getFilePath(storagePath);
    return fs.existsSync(path);
  }
}
