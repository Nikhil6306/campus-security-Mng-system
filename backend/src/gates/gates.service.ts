import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GatesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.gate.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const gate = await this.prisma.gate.findUnique({ where: { id } });
    if (!gate) throw new NotFoundException(`Gate with ID ${id} not found`);
    return gate;
  }
}
