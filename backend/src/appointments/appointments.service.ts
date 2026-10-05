import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.appointment.findMany({
      include: { request: true, faculty: true },
      orderBy: { scheduledDate: 'desc' },
    });
  }
}
