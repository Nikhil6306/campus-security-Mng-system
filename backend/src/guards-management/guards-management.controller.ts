import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { GuardsManagementService } from './guards-management.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ADMIN_ROLES } from '../common/auth-roles';

@ApiTags('Security Guards')
@Controller('guards')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
@ApiBearerAuth()
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
