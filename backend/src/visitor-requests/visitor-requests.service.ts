import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { QueueService } from '../queues/queue.service';
import { CreateVisitorRequestDto, ApproveRejectRequestDto } from './dto/visitor-request.dto';
import { VisitorStatus, QrPassStatus } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class VisitorRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly queueService: QueueService,
  ) {}

  async create(dto: CreateVisitorRequestDto) {
    // 1. Find or create visitor profile
    let visitor = await this.prisma.visitorProfile.findUnique({
      where: { mobile: dto.mobile.trim() },
    });

    if (!visitor) {
      visitor = await this.prisma.visitorProfile.create({
        data: {
          fullName: dto.fullName.trim(),
          mobile: dto.mobile.trim(),
          email: dto.email,
          idType: dto.idType,
          idNumber: dto.idNumber,
          organization: dto.organization,
          address: dto.address,
          photoUrl: dto.photoUrl,
          visitorType: dto.visitorType || 'Guest',
        },
      });
    }

    if (visitor.blacklisted) {
      throw new BadRequestException('Security Alert: This visitor profile is blacklisted from campus entry.');
    }

    // 2. Generate unique booking custom code
    const year = new Date().getFullYear();
    const count = await this.prisma.visitorRequest.count();
    const customCode = `DSVV-VIS-${year}-${(count + 1).toString().padStart(6, '0')}`;
    const passToken = crypto.randomBytes(16).toString('hex');

    // 3. Create request transaction
    const request = await this.prisma.visitorRequest.create({
      data: {
        customCode,
        visitorId: visitor.id,
        fullName: dto.fullName.trim(),
        mobile: dto.mobile.trim(),
        email: dto.email,
        organization: dto.organization,
        address: dto.address,
        visitorType: dto.visitorType || 'Guest',
        idType: dto.idType,
        idNumber: dto.idNumber,
        photoUrl: dto.photoUrl,
        purpose: dto.purpose,
        purposeDetail: dto.purposeDetail,
        hostId: dto.hostId,
        hostName: dto.hostName,
        departmentId: dto.departmentId,
        departmentName: dto.departmentName,
        visitDate: new Date(dto.visitDate),
        visitTime: dto.visitTime,
        expectedDuration: dto.expectedDuration || '30 minutes',
        numberOfVisitors: dto.numberOfVisitors || 1,
        vehicleRequired: dto.vehicleRequired || false,
        vehicleNumber: dto.vehicleNumber,
        notes: dto.notes,
        status: VisitorStatus.PENDING,
        passToken,
      },
      include: {
        visitor: true,
        host: true,
        department: true,
      },
    });

    // 4. Update visitor total visits counter
    await this.prisma.visitorProfile.update({
      where: { id: visitor.id },
      data: { totalVisits: { increment: 1 } },
    });

    // 5. Trigger Realtime event & Queue notification
    this.realtimeGateway.emitVisitorCreated(request);
    await this.queueService.addJob('notifications', 'visitor.created', { requestId: request.id });

    return request;
  }

  async findAll(query: { page?: number; limit?: number; status?: VisitorStatus; search?: string }) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 25)));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { mobile: { contains: query.search, mode: 'insensitive' } },
        { customCode: { contains: query.search, mode: 'insensitive' } },
        { hostName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.visitorRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { visitor: true, host: true, department: true, qrPasses: true },
      }),
      this.prisma.visitorRequest.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(idOrCode: string) {
    const request = await this.prisma.visitorRequest.findFirst({
      where: {
        OR: [{ id: idOrCode }, { customCode: idOrCode }, { passToken: idOrCode }],
      },
      include: { visitor: true, host: true, department: true, qrPasses: true, gateEntries: true, gateExits: true },
    });
    if (!request) throw new NotFoundException(`Visitor request ${idOrCode} not found`);
    return request;
  }

  async approve(id: string, dto: ApproveRejectRequestDto, actorUserId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.visitorRequest.findUnique({ where: { id } });
      if (!request) throw new NotFoundException('Visitor request not found');

      const updated = await tx.visitorRequest.update({
        where: { id },
        data: {
          status: VisitorStatus.APPROVED,
        },
      });

      // Create approval log
      await tx.visitorApproval.create({
        data: {
          visitorRequestId: id,
          approvedById: actorUserId,
          status: 'APPROVED',
          remarks: dto.reason,
        },
      });

      // Generate active QR pass
      const passId = `QR-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const expiresAt = new Date(request.visitDate);
      expiresAt.setHours(23, 59, 59, 999);

      await tx.qrPass.create({
        data: {
          passId,
          visitorRequestId: id,
          expiresAt,
          status: QrPassStatus.ACTIVE,
        },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          actorUserId,
          action: 'VISITOR_APPROVED',
          entityType: 'VisitorRequest',
          entityId: id,
          metadata: { reason: dto.reason, passId },
        },
      });

      this.realtimeGateway.emitVisitorApproved(updated);
      await this.queueService.addJob('emails', 'visitor.approved', { requestId: id, passId });

      return updated;
    });
  }

  async reject(id: string, dto: ApproveRejectRequestDto, actorUserId?: string) {
    const updated = await this.prisma.visitorRequest.update({
      where: { id },
      data: {
        status: VisitorStatus.REJECTED,
        rejectionReason: dto.reason,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        action: 'VISITOR_REJECTED',
        entityType: 'VisitorRequest',
        entityId: id,
        metadata: { reason: dto.reason },
      },
    });

    this.realtimeGateway.emitVisitorRejected(updated);
    await this.queueService.addJob('emails', 'visitor.rejected', { requestId: id, reason: dto.reason });

    return updated;
  }
}
