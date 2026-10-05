import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DepartmentsService } from './departments.service';

@ApiTags('Departments')
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all active academic departments' })
  async findAll() {
    return this.departmentsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get department details by ID' })
  async findOne(@Param('id') id: string) {
    return this.departmentsService.findOne(id);
  }

  @Get(':id/faculty')
  @ApiOperation({ summary: 'Get faculty members belonging to a department' })
  async getFaculty(@Param('id') id: string) {
    return this.departmentsService.getFacultyByDepartment(id);
  }
}
