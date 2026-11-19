import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service.js';

/** Bucket S3 de evidencias (opcional). */
@Global()
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
