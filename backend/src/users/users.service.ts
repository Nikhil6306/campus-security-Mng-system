import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        refId: true,
        gate: true,
        isActive: true,
        createdAt: true,
        userRoles: { select: { role: { select: { id: true, name: true } } } },
      },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        refId: true,
        gate: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
        userRoles: { select: { role: { select: { id: true, name: true } } } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
