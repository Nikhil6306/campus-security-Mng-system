import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { VisitorRequestsService } from './visitor-requests.service';
import { CreateVisitorRequestDto, ApproveRejectRequestDto } from './dto/visitor-request.dto';
import { VisitorStatus } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ADMIN_ROLES } from '../common/auth-roles';
import { GetUser } from '../common/decorators/get-user.decorator';

@ApiTags('Visitor Requests')
@Controller('visitor-requests')
export class VisitorRequestsController {
  constructor(private readonly visitorRequestsService: VisitorRequestsService) {}

  @Post()
  @ApiOperation({ summary: 'Submit a new campus visit request (Public flow Step 2)' })
  async create(@Body() dto: CreateVisitorRequestDto) {
    return this.visitorRequestsService.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get list of visitor requests with pagination and filters' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false, enum: VisitorStatus })
  @ApiQuery({ name: 'search', required: false })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: VisitorStatus,
    @Query('search') search?: string,
  ) {
    return this.visitorRequestsService.findAll({ page, limit, status, search });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get visitor request by ID, booking code, or pass token' })
  async findOne(@Param('id') id: string) {
    return this.visitorRequestsService.findOne(id);
  }

  @Post(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approve a pending visitor request' })
  async approve(
    @Param('id') id: string,
    @Body() dto: ApproveRejectRequestDto,
    @GetUser('userId') actorUserId: string,
  ) {
    return this.visitorRequestsService.approve(id, dto, actorUserId);
  }

  @Post(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reject a pending visitor request' })
  async reject(
    @Param('id') id: string,
    @Body() dto: ApproveRejectRequestDto,
    @GetUser('userId') actorUserId: string,
  ) {
    return this.visitorRequestsService.reject(id, dto, actorUserId);
  }
}
