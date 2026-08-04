import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { IStorageProvider, StorageResult } from '../interfaces/storage-provider.interface';

@Injectable()
export class LocalStorageProvider implements IStorageProvider {
  private readonly storageRoot: string;

  constructor() {
    // Root directory for storing files (d:/ai/projects/classpod/storage)
    this.storageRoot = path.resolve(process.cwd(), 'storage');
    if (!fs.existsSync(this.storageRoot)) {
      fs.mkdirSync(this.storageRoot, { recursive: true });
    }
  }

  async upload(
    filename: string,
    buffer: Buffer,
    mimeType: string,
    pathPrefix = ''
  ): Promise<StorageResult> {
    const targetDir = path.join(this.storageRoot, pathPrefix);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const relativePath = path.join(pathPrefix, filename).replace(/\\/g, '/');
    const absolutePath = path.join(this.storageRoot, relativePath);

    fs.writeFileSync(absolutePath, buffer);

    const sizeBytes = buffer.length;
    // URL will point to our secure download controller endpoint
    const url = `/api/automation/artifacts/download?path=${encodeURIComponent(relativePath)}`;

    return {
      storagePath: relativePath,
      url,
      sizeBytes,
    };
  }

  getUrl(storagePath: string): string {
    return `/api/automation/artifacts/download?path=${encodeURIComponent(storagePath)}`;
  }

  async delete(storagePath: string): Promise<void> {
    const absolutePath = path.join(this.storageRoot, storagePath);
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
  }

  // Helper to read a file for streaming in controller
  getLocalReadStream(storagePath: string): fs.ReadStream {
    const absolutePath = path.join(this.storageRoot, storagePath);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${storagePath}`);
    }
    return fs.createReadStream(absolutePath);
  }

  getLocalFilePath(storagePath: string): string {
    const absolutePath = path.join(this.storageRoot, storagePath);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${storagePath}`);
    }
    return absolutePath;
  }
}
