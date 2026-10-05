import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FacultyService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(search?: string, departmentId?: string) {
    const where: any = { isActive: true };
    if (departmentId) where.departmentId = departmentId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { designation: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.faculty.findMany({
      where,
      include: { department: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const faculty = await this.prisma.faculty.findUnique({
      where: { id },
      include: { department: true },
    });
    if (!faculty) throw new NotFoundException(`Faculty member with ID ${id} not found`);
    return faculty;
  }
}
