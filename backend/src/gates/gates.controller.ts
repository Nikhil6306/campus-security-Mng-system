import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { GatesService } from './gates.service';

@ApiTags('Gates')
@Controller('gates')
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
