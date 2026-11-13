import { Module } from '@nestjs/common';
import { ControlesController } from './controles.controller.js';
import { ControlesService } from './controles.service.js';

@Module({
  controllers: [ControlesController],
  providers: [ControlesService],
  exports: [ControlesService],
})
export class ControlesModule {}
