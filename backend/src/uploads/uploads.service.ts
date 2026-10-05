import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private s3Client: S3Client | null = null;
  private bucket: string;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>('s3.endpoint');
    const region = this.configService.get<string>('s3.region') || 'us-east-1';
    const accessKeyId = this.configService.get<string>('s3.accessKey');
    const secretAccessKey = this.configService.get<string>('s3.secretKey');
    this.bucket = this.configService.get<string>('s3.bucket') || 'dsvv-campus-security';

    if (accessKeyId && secretAccessKey) {
      try {
        this.s3Client = new S3Client({
          endpoint,
          region,
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
          forcePathStyle: true, // required for MinIO/R2
        });
      } catch (e: any) {
        this.logger.warn(`S3 Client initialization warning: ${e.message}`);
      }
    }
  }

  async upload(file: Express.Multer.File | { buffer: Buffer; originalname: string; mimetype: string }, keyPrefix = 'uploads'): Promise<string> {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(`Invalid file type ${file.mimetype}. Allowed types: JPG, PNG, WEBP, PDF`);
    }

    const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
    if (['exe', 'bat', 'sh', 'js', 'php'].includes(fileExtension || '')) {
      throw new BadRequestException('Executable file upload strictly prohibited.');
    }

    const key = `${keyPrefix}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;

    if (this.s3Client) {
      try {
        await this.s3Client.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype,
          }),
        );
        return `/api/v1/uploads/${key}`;
      } catch (e: any) {
        this.logger.warn(`S3 upload fallback to local reference due to: ${e.message}`);
      }
    }

    // Local / Dev Fallback: return data URI or mock path
    return `/api/v1/uploads/${key}`;
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    if (this.s3Client) {
      try {
        const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
        return await getSignedUrl(this.s3Client, command, { expiresIn });
      } catch (e: any) {
        this.logger.warn(`Failed to generate S3 presigned URL: ${e.message}`);
      }
    }
    return `/api/v1/uploads/${key}`;
  }

  async delete(key: string): Promise<void> {
    if (this.s3Client) {
      try {
        await this.s3Client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
      } catch (e: any) {
        this.logger.warn(`S3 delete object warning: ${e.message}`);
      }
    }
  }
}
