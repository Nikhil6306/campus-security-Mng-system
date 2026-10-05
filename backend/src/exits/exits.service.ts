import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { VisitorStatus, QrPassStatus } from '@prisma/client';

@Injectable()
export class ExitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  async createExit(dto: { visitorRequestId: string; gateId?: string; gateName?: string; note?: string }, actorUserId?: string) {
    return this.prisma.$transaction(async (tx) => {
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

      if (request.status === VisitorStatus.CHECKED_OUT) {
        throw new BadRequestException('Visitor is already checked out of campus.');
      }

      let gate = await tx.gate.findFirst({
        where: { OR: [{ id: dto.gateId }, { name: dto.gateName || 'Main Gate' }] },
      });

      if (!gate) {
        gate = await tx.gate.create({
          data: { name: dto.gateName || 'Main Gate', code: 'GATE-MAIN' },
        });
      }

      const exit = await tx.gateExit.create({
        data: {
          gateId: gate.id,
          visitorRequestId: request.id,
          note: dto.note,
        },
      });

      const updatedRequest = await tx.visitorRequest.update({
        where: { id: request.id },
        data: { status: VisitorStatus.CHECKED_OUT },
      });

      // Mark QR pass as USED
      await tx.qrPass.updateMany({
        where: { visitorRequestId: request.id },
        data: { status: QrPassStatus.USED },
      }).catch(() => null);

      await tx.auditLog.create({
        data: {
          actorUserId,
          action: 'GATE_EXIT',
          entityType: 'GateExit',
          entityId: exit.id,
          metadata: { gateName: gate.name, visitorName: request.fullName },
        },
      });

      this.realtimeGateway.emitVisitorCheckedOut({ exit, request: updatedRequest });

      return { success: true, message: 'Visitor checked out successfully.', exit, request: updatedRequest };
    });
  }

  async findAll(query: { page?: number; limit?: number }) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 25)));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.gateExit.findMany({
        skip,
        take: limit,
        orderBy: { exitTime: 'desc' },
        include: { gate: true, request: { include: { visitor: true } } },
      }),
      this.prisma.gateExit.count(),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
