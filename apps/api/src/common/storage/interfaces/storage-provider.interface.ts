export interface IStorageProvider {
  upload(
    filename: string,
    buffer: Buffer,
    mimeType: string,
    pathPrefix?: string
  ): Promise<StorageResult>;
  getUrl(storagePath: string): string;
  delete(storagePath: string): Promise<void>;
}

export interface StorageResult {
  storagePath: string;
  url: string;
  sizeBytes: number;
}
