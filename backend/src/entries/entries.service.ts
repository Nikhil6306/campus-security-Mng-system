import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { VisitorStatus } from '@prisma/client';

@Injectable()
export class EntriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  async createEntry(dto: { visitorRequestId: string; gateId?: string; gateName?: string; note?: string }, actorUserId?: string) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Fetch visitor request
      const request = await tx.visitorRequest.findFirst({
        where: {
          OR: [
            { id: dto.visitorRequestId },
            { customCode: dto.visitorRequestId },
            { passToken: dto.visitorRequestId },
          ],
        },
      });

      if (!request) {
        throw new NotFoundException('Visitor request not found');
      }

      if (request.status === VisitorStatus.CHECKED_IN) {
        throw new BadRequestException('Visitor is already currently checked in on campus.');
      }

      // 2. Fetch or fallback gate
      let gate = await tx.gate.findFirst({
        where: { OR: [{ id: dto.gateId }, { name: dto.gateName || 'Main Gate' }] },
      });

      if (!gate) {
        gate = await tx.gate.create({
          data: { name: dto.gateName || 'Main Gate', code: 'GATE-MAIN' },
        });
      }

      // 3. Create gate entry record
      const entry = await tx.gateEntry.create({
        data: {
          gateId: gate.id,
          visitorRequestId: request.id,
          note: dto.note,
        },
      });

      // 4. Update request status
      const updatedRequest = await tx.visitorRequest.update({
        where: { id: request.id },
        data: { status: VisitorStatus.CHECKED_IN },
      });

      // 5. Audit Log
      await tx.auditLog.create({
        data: {
          actorUserId,
          action: 'GATE_ENTRY',
          entityType: 'GateEntry',
          entityId: entry.id,
          metadata: { gateName: gate.name, visitorName: request.fullName },
        },
      });

      // 6. Broadcast Realtime socket event
      this.realtimeGateway.emitVisitorCheckedIn({ entry, request: updatedRequest });

      return { success: true, message: 'Visitor checked in successfully.', entry, request: updatedRequest };
    });
  }

  async findAll(query: { page?: number; limit?: number }) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 25)));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.gateEntry.findMany({
        skip,
        take: limit,
        orderBy: { entryTime: 'desc' },
        include: { gate: true, request: { include: { visitor: true } } },
      }),
      this.prisma.gateEntry.count(),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
