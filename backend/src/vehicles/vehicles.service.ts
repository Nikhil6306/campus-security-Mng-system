import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VehicleStatus, VehicleType } from '@prisma/client';

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  async createEntry(dto: { vehicleNumber: string; vehicleType: VehicleType; ownerName: string; gateName?: string }) {
    const formattedNumber = dto.vehicleNumber.trim().toUpperCase();

    // Check duplicate active inside vehicle
    const existingActive = await this.prisma.vehicle.findFirst({
      where: { vehicleNumber: formattedNumber, status: VehicleStatus.INSIDE },
    });

    if (existingActive) {
      throw new BadRequestException(`Vehicle ${formattedNumber} is already inside campus.`);
    }

    const vehicle = await this.prisma.vehicle.create({
      data: {
        vehicleNumber: formattedNumber,
        vehicleType: dto.vehicleType || VehicleType.CAR,
        ownerName: dto.ownerName,
        status: VehicleStatus.INSIDE,
        entries: {
          create: {
            gateName: dto.gateName || 'Main Gate',
            status: 'INSIDE',
          },
        },
      },
      include: { entries: true },
    });

    return vehicle;
  }

  async markExit(vehicleIdOrNumber: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: {
        OR: [{ id: vehicleIdOrNumber }, { vehicleNumber: vehicleIdOrNumber.toUpperCase() }],
        status: VehicleStatus.INSIDE,
      },
    });

    if (!vehicle) {
      throw new NotFoundException('Active inside vehicle record not found');
    }

    const updated = await this.prisma.vehicle.update({
      where: { id: vehicle.id },
      data: {
        status: VehicleStatus.EXITED,
      },
    });

    await this.prisma.vehicleEntry.updateMany({
      where: { vehicleId: vehicle.id, status: 'INSIDE' },
      data: { exitTime: new Date(), status: 'EXITED' },
    });

    return updated;
  }

  async findAll(query: { page?: number; limit?: number; status?: VehicleStatus }) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 25)));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) where.status = query.status;

    const [items, total] = await Promise.all([
      this.prisma.vehicle.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { entries: true },
      }),
      this.prisma.vehicle.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
