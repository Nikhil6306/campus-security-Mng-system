import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.department.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: { faculties: { where: { isActive: true }, orderBy: { name: 'asc' } } },
    });
    if (!department) throw new NotFoundException(`Department with ID ${id} not found`);
    return department;
  }

  async getFacultyByDepartment(idOrCode: string) {
    const department = await this.prisma.department.findFirst({
      where: { OR: [{ id: idOrCode }, { code: idOrCode }] },
    });
    if (!department) {
      return [];
    }
    return this.prisma.faculty.findMany({
      where: { departmentId: department.id, isActive: true },
      orderBy: { name: 'asc' },
    });
  }
}
