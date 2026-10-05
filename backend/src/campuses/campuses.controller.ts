import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CampusesService } from './campuses.service';

@ApiTags('Campuses')
@Controller('campuses')
export class CampusesController {
  constructor(private readonly campusesService: CampusesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all university campus locations and buildings' })
  async findAll() {
    return this.campusesService.findAll();
  }
}
