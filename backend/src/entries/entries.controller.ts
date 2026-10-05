import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { EntriesService } from './entries.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';

@ApiTags('Entries')
@Controller('entries')
export class EntriesController {
  constructor(private readonly entriesService: EntriesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register a gate entry check-in for a visitor' })
  async create(
    @Body() dto: { visitorRequestId: string; gateId?: string; gateName?: string; note?: string },
    @GetUser('userId') actorUserId: string,
  ) {
    return this.entriesService.createEntry(dto, actorUserId);
  }

  @Get()
  @ApiOperation({ summary: 'Get history of gate check-in entries' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async findAll(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.entriesService.findAll({ page, limit });
  }
}
