import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { FacultyService } from './faculty.service';

@ApiTags('Faculty')
@Controller('faculty')
export class FacultyController {
  constructor(private readonly facultyService: FacultyService) {}

  @Get()
  @ApiOperation({ summary: 'Get all faculty members with search and department filter' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'departmentId', required: false })
  async findAll(@Query('search') search?: string, @Query('departmentId') departmentId?: string) {
    return this.facultyService.findAll(search, departmentId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get faculty details by ID' })
  async findOne(@Param('id') id: string) {
    return this.facultyService.findOne(id);
  }
}
