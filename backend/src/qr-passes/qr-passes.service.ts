import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QrPassStatus, VisitorStatus } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class QrPassesService {
  constructor(private readonly prisma: PrismaService) {}

  async generatePass(visitorRequestId: string) {
    const request = await this.prisma.visitorRequest.findUnique({
      where: { id: visitorRequestId },
    });
    if (!request) throw new NotFoundException('Visitor request not found');

    const passId = `QR-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const expiresAt = new Date(request.visitDate);
    expiresAt.setHours(23, 59, 59, 999);

    return this.prisma.qrPass.create({
      data: {
        passId,
        visitorRequestId,
        expiresAt,
        status: QrPassStatus.ACTIVE,
      },
      include: { request: { include: { visitor: true, host: true } } },
    });
  }

  async verifyPass(passIdOrToken: string) {
    // Check both passId and passToken
    const qrPass = await this.prisma.qrPass.findFirst({
      where: {
        OR: [
          { passId: passIdOrToken },
          { request: { passToken: passIdOrToken } },
          { request: { customCode: passIdOrToken } },
        ],
      },
      include: {
        request: {
          include: {
            visitor: true,
            host: true,
            department: true,
          },
        },
      },
    });

    if (!qrPass) {
      // Try finding by request customCode directly if no QrPass table entry
      const request = await this.prisma.visitorRequest.findFirst({
        where: {
          OR: [{ customCode: passIdOrToken }, { passToken: passIdOrToken }],
        },
        include: { visitor: true, host: true, department: true },
      });

      if (!request) {
        return { isValid: false, message: 'Invalid or unrecognized QR pass.' };
      }

      if (request.status === VisitorStatus.REJECTED || request.status === VisitorStatus.CANCELLED) {
        return { isValid: false, message: `Pass rejected or cancelled (${request.status}).` };
      }

      return {
        isValid: true,
        passId: request.passToken || passIdOrToken,
        status: request.status,
        request,
      };
    }

    if (qrPass.status === QrPassStatus.REVOKED) {
      return { isValid: false, message: 'Pass has been revoked by security administration.' };
    }

    if (qrPass.status === QrPassStatus.EXPIRED || new Date() > qrPass.expiresAt) {
      return { isValid: false, message: 'Pass has expired.' };
    }

    return {
      isValid: true,
      passId: qrPass.passId,
      status: qrPass.status,
      request: qrPass.request,
    };
  }

  async findOne(passId: string) {
    const pass = await this.prisma.qrPass.findFirst({
      where: { OR: [{ id: passId }, { passId }] },
      include: { request: { include: { visitor: true, host: true } } },
    });
    if (!pass) throw new NotFoundException('QR pass not found');
    return pass;
  }

  async revoke(passId: string, actorUserId?: string) {
    const pass = await this.prisma.qrPass.update({
      where: { passId },
      data: {
        status: QrPassStatus.REVOKED,
        revokedAt: new Date(),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        action: 'QR_REVOKED',
        entityType: 'QrPass',
        entityId: pass.id,
        metadata: { passId },
      },
    });

    return pass;
  }
}
