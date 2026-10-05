import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { GuardsManagementService } from './guards-management.service';

@ApiTags('Security Guards')
@Controller('guards')
export class GuardsManagementController {
  constructor(private readonly guardsService: GuardsManagementService) {}

  @Get()
  @ApiOperation({ summary: 'Get all security guards' })
  async findAll() {
    return this.guardsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get guard profile by ID' })
  async findOne(@Param('id') id: string) {
    return this.guardsService.findOne(id);
  }
}
