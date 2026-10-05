import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BuildingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.building.findMany({
      include: { campus: true, gates: true },
    });
  }
}
