import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GuardsManagementService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.securityGuard.findMany({
      include: { assignedGate: true, shifts: { take: 5, orderBy: { startTime: 'desc' } } },
      orderBy: { fullName: 'asc' },
    });
  }

  async findOne(id: string) {
    const guard = await this.prisma.securityGuard.findUnique({
      where: { id },
      include: { assignedGate: true, shifts: { orderBy: { startTime: 'desc' } } },
    });
    if (!guard) throw new NotFoundException('Security guard profile not found');
    return guard;
  }
}
