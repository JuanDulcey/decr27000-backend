import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service.js';
import { InitDbService } from './init-db.service.js';

@Global()
@Module({
  providers: [DatabaseService, InitDbService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
