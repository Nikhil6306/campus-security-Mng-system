import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ExitsService } from './exits.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';

@ApiTags('Exits')
@Controller('exits')
export class ExitsController {
  constructor(private readonly exitsService: ExitsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register a gate exit check-out for a visitor' })
  async create(
    @Body() dto: { visitorRequestId: string; gateId?: string; gateName?: string; note?: string },
    @GetUser('userId') actorUserId: string,
  ) {
    return this.exitsService.createExit(dto, actorUserId);
  }

  @Get()
  @ApiOperation({ summary: 'Get history of gate check-out exits' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async findAll(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.exitsService.findAll({ page, limit });
  }
}
