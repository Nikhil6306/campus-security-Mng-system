import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { GatesService } from './gates.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ADMIN_ROLES } from '../common/auth-roles';

@ApiTags('Gates')
@Controller('gates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
@ApiBearerAuth()
export class GatesController {
  constructor(private readonly gatesService: GatesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all campus entry/exit security gates' })
  async findAll() {
    return this.gatesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get gate by ID' })
  async findOne(@Param('id') id: string) {
    return this.gatesService.findOne(id);
  }
}
