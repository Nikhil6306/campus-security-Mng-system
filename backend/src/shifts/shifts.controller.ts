import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ShiftsService } from './shifts.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Guard Shifts')
@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Post('start')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start a guard duty shift at a gate' })
  async startShift(@Body() dto: { guardId: string; gateId: string }) {
    return this.shiftsService.startShift(dto);
  }

  @Post(':id/end')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'End an active guard duty shift' })
  async endShift(@Param('id') id: string) {
    return this.shiftsService.endShift(id);
  }

  @Get()
  @ApiOperation({ summary: 'Get guard duty shift history' })
  async findAll() {
    return this.shiftsService.findAll();
  }
}
