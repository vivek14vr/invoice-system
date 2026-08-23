import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { GridFSBucket, MongoClient, ObjectId } from 'mongodb';
import { Readable } from 'node:stream';

@Injectable()
export class GridFsService implements OnModuleInit, OnModuleDestroy {
  private client?: MongoClient;
  private bucket?: GridFSBucket;

  async onModuleInit() {
    const uri = process.env.DATABASE_URL;
    if (!uri) throw new Error('DATABASE_URL is required for file storage');
    this.client = new MongoClient(uri);
    await this.client.connect();
    const databaseName = new URL(uri).pathname.replace(/^\//, '') || undefined;
    const database = this.client.db(databaseName);
    this.bucket = new GridFSBucket(database, { bucketName: 'expenseFiles' });
  }

  async onModuleDestroy() {
    await this.client?.close();
  }

  async uploadPdf(dataUrl: string, filename: string) {
    const match = dataUrl.match(
      /^data:application\/pdf;base64,([A-Za-z0-9+/=]+)$/,
    );
    if (!match) throw new Error('Only PDF files are allowed');
    const buffer = Buffer.from(match[1], 'base64');
    if (!buffer.length || buffer.length > 5 * 1024 * 1024) {
      throw new Error('PDF must be between 1 byte and 5 MB');
    }
    const bucket = this.requireBucket();
    const id = new ObjectId();
    const upload = bucket.openUploadStreamWithId(id, filename, {
      contentType: 'application/pdf',
      metadata: { purpose: 'expense-attachment' },
    });
    await new Promise<void>((resolve, reject) => {
      upload.once('finish', () => resolve());
      upload.once('error', reject);
      Readable.from(buffer).pipe(upload);
    });
    return { id: id.toString(), size: buffer.length };
  }

  openDownload(id: string) {
    return this.requireBucket().openDownloadStream(new ObjectId(id));
  }

  async delete(id?: string | null) {
    if (id) await this.requireBucket().delete(new ObjectId(id));
  }

  private requireBucket() {
    if (!this.bucket) throw new Error('File storage is not ready');
    return this.bucket;
  }
}
