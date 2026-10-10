import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { VisitorsService } from './visitors.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ADMIN_ROLES } from '../common/auth-roles';

@ApiTags('Visitors')
@Controller('visitors')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
@ApiBearerAuth()
export class VisitorsController {
  constructor(private readonly visitorsService: VisitorsService) {}

  @Get()
  @ApiOperation({ summary: 'Get list of registered visitor profiles' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.visitorsService.findAll({ page, limit, search });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get visitor profile and visit history by ID' })
  async findOne(@Param('id') id: string) {
    return this.visitorsService.findOne(id);
  }
}
