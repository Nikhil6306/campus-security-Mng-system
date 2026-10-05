import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { QrPassesService } from './qr-passes.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';

@ApiTags('QR Passes')
@Controller('qr-passes')
export class QrPassesController {
  constructor(private readonly qrPassesService: QrPassesService) {}

  @Post('verify')
  @ApiOperation({ summary: 'Verify QR pass on server side for gate check-in scanner' })
  async verify(@Body('token') token: string) {
    return this.qrPassesService.verifyPass(token);
  }

  @Post('generate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate a new QR pass for an approved visit request' })
  async generate(@Body('visitorRequestId') visitorRequestId: string) {
    return this.qrPassesService.generatePass(visitorRequestId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get QR pass details by pass ID' })
  async findOne(@Param('id') id: string) {
    return this.qrPassesService.findOne(id);
  }

  @Post(':id/revoke')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke a QR pass' })
  async revoke(@Param('id') id: string, @GetUser('userId') actorUserId: string) {
    return this.qrPassesService.revoke(id, actorUserId);
  }
}
