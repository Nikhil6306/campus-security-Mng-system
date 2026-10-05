import { Controller, Post, Get, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { VehiclesService } from './vehicles.service';
import { VehicleStatus, VehicleType } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Vehicles')
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post('entry')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register a vehicle entry at gate' })
  async createEntry(@Body() dto: { vehicleNumber: string; vehicleType: VehicleType; ownerName: string; gateName?: string }) {
    return this.vehiclesService.createEntry(dto);
  }

  @Post(':id/exit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register a vehicle exit at gate' })
  async markExit(@Param('id') id: string) {
    return this.vehiclesService.markExit(id);
  }

  @Get()
  @ApiOperation({ summary: 'Get list of vehicles inside/exited campus' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false, enum: VehicleStatus })
  async findAll(@Query('page') page?: number, @Query('limit') limit?: number, @Query('status') status?: VehicleStatus) {
    return this.vehiclesService.findAll({ page, limit, status });
  }
}
