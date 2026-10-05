import { Module } from '@nestjs/common';
import { VisitorRequestsService } from './visitor-requests.service';
import { VisitorRequestsController } from './visitor-requests.controller';

@Module({
  controllers: [VisitorRequestsController],
  providers: [VisitorRequestsService],
  exports: [VisitorRequestsService],
})
export class VisitorRequestsModule {}
