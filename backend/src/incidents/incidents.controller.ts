import { Controller, Post, Get, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { IncidentsService } from './incidents.service';
import { IncidentSeverity, IncidentStatus } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';

@ApiTags('Incidents')
@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Report a new security incident' })
  async create(
    @Body() dto: { title: string; description: string; location: string; severity?: IncidentSeverity; category?: string },
    @GetUser('userId') actorUserId: string,
  ) {
    return this.incidentsService.create(dto, actorUserId);
  }

  @Get()
  @ApiOperation({ summary: 'Get list of security incidents with filters' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false, enum: IncidentStatus })
  @ApiQuery({ name: 'severity', required: false, enum: IncidentSeverity })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: IncidentStatus,
    @Query('severity') severity?: IncidentSeverity,
  ) {
    return this.incidentsService.findAll({ page, limit, status, severity });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get incident details by ID' })
  async findOne(@Param('id') id: string) {
    return this.incidentsService.findOne(id);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update incident status or assigned officer' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: { status: IncidentStatus; assignedToId?: string },
    @GetUser('userId') actorUserId: string,
  ) {
    return this.incidentsService.updateStatus(id, dto, actorUserId);
  }

  @Post(':id/comments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a comment/update to an incident thread' })
  async addComment(
    @Param('id') id: string,
    @Body('comment') comment: string,
    @GetUser('userId') actorUserId: string,
  ) {
    return this.incidentsService.addComment(id, comment, actorUserId);
  }
}
