import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class ShiftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  async startShift(dto: { guardId: string; gateId: string }) {
    const shift = await this.prisma.guardShift.create({
      data: {
        guardId: dto.guardId,
        gateId: dto.gateId,
        startTime: new Date(),
        status: 'ACTIVE',
      },
      include: { guard: true, gate: true },
    });

    this.realtimeGateway.emitShiftStarted(shift);
    return shift;
  }

  async endShift(shiftId: string) {
    const shift = await this.prisma.guardShift.update({
      where: { id: shiftId },
      data: {
        endTime: new Date(),
        status: 'COMPLETED',
      },
      include: { guard: true, gate: true },
    });

    this.realtimeGateway.emitShiftEnded(shift);
    return shift;
  }

  async findAll() {
    return this.prisma.guardShift.findMany({
      orderBy: { startTime: 'desc' },
      take: 50,
      include: { guard: true, gate: true },
    });
  }
}
