import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VisitorStatus, IncidentStatus, VehicleStatus } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardSummary() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [
      totalVisitors,
      todayVisitors,
      pendingRequests,
      approvedVisits,
      currentlyInside,
      todayEntries,
      todayExits,
      activeIncidents,
      activeVehicles,
      activeGuards,
      activeGates,
    ] = await Promise.all([
      this.prisma.visitorProfile.count(),
      this.prisma.visitorRequest.count({
        where: { createdAt: { gte: todayStart, lte: todayEnd } },
      }),
      this.prisma.visitorRequest.count({ where: { status: VisitorStatus.PENDING } }),
      this.prisma.visitorRequest.count({ where: { status: VisitorStatus.APPROVED } }),
      this.prisma.visitorRequest.count({ where: { status: VisitorStatus.CHECKED_IN } }),
      this.prisma.gateEntry.count({
        where: { entryTime: { gte: todayStart, lte: todayEnd } },
      }),
      this.prisma.gateExit.count({
        where: { exitTime: { gte: todayStart, lte: todayEnd } },
      }),
      this.prisma.securityIncident.count({
        where: { status: { in: [IncidentStatus.OPEN, IncidentStatus.INVESTIGATING] } },
      }),
      this.prisma.vehicle.count({ where: { status: VehicleStatus.INSIDE } }),
      this.prisma.securityGuard.count({ where: { status: 'ACTIVE' } }),
      this.prisma.gate.count({ where: { isActive: true } }),
    ]);

    return {
      totalVisitors,
      todayVisitors,
      pendingRequests,
      approvedVisits,
      currentlyInside,
      todayEntries,
      todayExits,
      activeIncidents,
      activeVehicles,
      activeGuards,
      activeGates,
    };
  }
}
