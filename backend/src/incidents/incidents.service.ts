import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { IncidentSeverity, IncidentStatus } from '@prisma/client';

@Injectable()
export class IncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  async create(dto: { title: string; description: string; location: string; severity?: IncidentSeverity; category?: string }, actorUserId?: string) {
    const incident = await this.prisma.securityIncident.create({
      data: {
        title: dto.title,
        description: dto.description,
        location: dto.location,
        severity: dto.severity || IncidentSeverity.MEDIUM,
        category: dto.category || 'Security',
        reportedById: actorUserId,
        status: IncidentStatus.OPEN,
      },
      include: { reportedBy: true, assignedTo: true, comments: true },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        action: 'INCIDENT_CREATED',
        entityType: 'SecurityIncident',
        entityId: incident.id,
        metadata: { title: incident.title, severity: incident.severity },
      },
    });

    this.realtimeGateway.emitIncidentCreated(incident);
    return incident;
  }

  async findAll(query: { page?: number; limit?: number; status?: IncidentStatus; severity?: IncidentSeverity }) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 25)));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.severity) where.severity = query.severity;

    const [items, total] = await Promise.all([
      this.prisma.securityIncident.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { reportedBy: true, assignedTo: true, comments: { include: { author: true } } },
      }),
      this.prisma.securityIncident.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const incident = await this.prisma.securityIncident.findUnique({
      where: { id },
      include: { reportedBy: true, assignedTo: true, comments: { include: { author: true } } },
    });
    if (!incident) throw new NotFoundException('Security incident not found');
    return incident;
  }

  async updateStatus(id: string, dto: { status: IncidentStatus; assignedToId?: string }, actorUserId?: string) {
    const data: any = { status: dto.status };
    if (dto.assignedToId) data.assignedToId = dto.assignedToId;
    if (dto.status === IncidentStatus.RESOLVED) data.resolvedAt = new Date();

    const incident = await this.prisma.securityIncident.update({
      where: { id },
      data,
      include: { reportedBy: true, assignedTo: true },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        action: 'INCIDENT_UPDATED',
        entityType: 'SecurityIncident',
        entityId: incident.id,
        metadata: { status: dto.status },
      },
    });

    this.realtimeGateway.emitIncidentUpdated(incident);
    return incident;
  }

  async addComment(id: string, comment: string, authorId: string) {
    const incident = await this.prisma.securityIncident.findUnique({ where: { id } });
    if (!incident) throw new NotFoundException('Security incident not found');

    return this.prisma.incidentComment.create({
      data: {
        incidentId: id,
        authorId,
        comment,
      },
      include: { author: true },
    });
  }
}
