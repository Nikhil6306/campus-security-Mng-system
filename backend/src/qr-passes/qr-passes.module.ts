import { Module } from '@nestjs/common';
import { QrPassesService } from './qr-passes.service';
import { QrPassesController } from './qr-passes.controller';

@Module({
  controllers: [QrPassesController],
  providers: [QrPassesService],
  exports: [QrPassesService],
})
export class QrPassesModule {}
