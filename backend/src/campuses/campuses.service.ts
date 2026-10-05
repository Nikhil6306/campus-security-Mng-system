import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CampusesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.campus.findMany({
      include: { buildings: { include: { gates: true } } },
    });
  }
}
