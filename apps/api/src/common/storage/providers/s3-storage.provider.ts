import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { IStorageProvider, StorageResult } from '../interfaces/storage-provider.interface';

@Injectable()
export class S3StorageProvider implements IStorageProvider {
  private readonly logger = new Logger(S3StorageProvider.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly region: string;
  private readonly publicUrlPrefix: string;

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    this.bucket = this.configService.get<string>('AWS_S3_BUCKET', 'classpod-storage');
    const endpoint = this.configService.get<string>('AWS_S3_ENDPOINT');

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID', ''),
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY', ''),
      },
      endpoint: endpoint || undefined,
      forcePathStyle: !!endpoint, // Useful for MinIO / LocalStack testing
    });

    this.publicUrlPrefix = this.configService.get<string>(
      'AWS_S3_PUBLIC_URL',
      `https://${this.bucket}.s3.${this.region}.amazonaws.com`
    );
  }

  async upload(
    filename: string,
    buffer: Buffer,
    mimeType: string,
    pathPrefix = ''
  ): Promise<StorageResult> {
    const key = pathPrefix ? `${pathPrefix}/${filename}`.replace(/\/+/g, '/') : filename;

    this.logger.log(`Uploading ${key} (${buffer.length} bytes) to S3 bucket ${this.bucket}...`);

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      })
    );

    const url = `${this.publicUrlPrefix}/${key}`;
    return {
      storagePath: key,
      url,
      sizeBytes: buffer.length,
    };
  }

  getUrl(storagePath: string): string {
    return `${this.publicUrlPrefix}/${storagePath}`;
  }

  async delete(storagePath: string): Promise<void> {
    this.logger.log(`Deleting ${storagePath} from S3 bucket ${this.bucket}...`);
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: storagePath,
      })
    );
  }
}
