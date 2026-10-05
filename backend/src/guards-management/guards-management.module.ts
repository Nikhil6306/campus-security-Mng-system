import { Module } from '@nestjs/common';
import { GuardsManagementService } from './guards-management.service';
import { GuardsManagementController } from './guards-management.controller';

@Module({
  controllers: [GuardsManagementController],
  providers: [GuardsManagementService],
  exports: [GuardsManagementService],
})
export class GuardsManagementModule {}
