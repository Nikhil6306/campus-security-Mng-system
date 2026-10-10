import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RefreshTokenDto } from './dto/auth.dto';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      if (hash.startsWith('$argon2')) return await argon2.verify(hash, password);

      // Older builds could persist SHA-256 hashes if Argon2 failed to load.
      // Accept them only long enough to upgrade the hash during this login.
      if (!/^[a-f\d]{64}$/i.test(hash)) return false;
      const expected = Buffer.from(hash, 'hex');
      const actual = crypto.createHash('sha256').update(password).digest();
      return crypto.timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });

    const isMatch = user
      ? await this.verifyPassword(dto.password, user.passwordHash)
      : false;
    if (!user || !user.isActive || !isMatch) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (!user.passwordHash.startsWith('$argon2')) {
      const passwordHash = await this.hashPassword(dto.password);
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const roles = user.userRoles.map((ur) => ur.role.name);
    const permissions = Array.from(
      new Set(
        user.userRoles.flatMap((ur) =>
          ur.role.rolePermissions.map((rp) => rp.permission.action),
        ),
      ),
    );

    const tokens = await this.generateTokens(user.id, user.email, roles, permissions);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        refId: user.refId,
        gate: user.gate,
        roles,
        permissions,
      },
      tokens,
    };
  }

  async refreshToken(dto: RefreshTokenDto) {
    const tokenHash = this.hashToken(dto.refreshToken);
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { userRoles: { include: { role: true } } } } },
    });

    if (
      !storedToken ||
      storedToken.isRevoked ||
      storedToken.expiresAt < new Date() ||
      !storedToken.user.isActive
    ) {
      throw new UnauthorizedException('Refresh token is invalid, revoked, or expired.');
    }

    // Refresh token rotation: revoke old token
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { isRevoked: true },
    });

    const roles = storedToken.user.userRoles.map((ur) => ur.role.name);
    const newTokens = await this.generateTokens(storedToken.userId, storedToken.user.email, roles, []);
    await this.saveRefreshToken(storedToken.userId, newTokens.refreshToken);

    return newTokens;
  }

  async logout(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash },
      data: { isRevoked: true },
    }).catch(() => null);
    return { message: 'Logged out successfully' };
  }

  async logoutAll(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId },
      data: { isRevoked: true },
    });
    return { message: 'All sessions logged out successfully' };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: { include: { role: true } },
        visitorProfile: true,
        facultyProfile: true,
        guardProfile: true,
      },
    });
    if (!user) throw new UnauthorizedException('User profile not found');
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      refId: user.refId,
      gate: user.gate,
      roles: user.userRoles.map((ur) => ur.role.name),
      visitorProfile: user.visitorProfile,
      facultyProfile: user.facultyProfile,
      guardProfile: user.guardProfile,
    };
  }

  private async generateTokens(userId: string, email: string, roles: string[], permissions: string[]) {
    const payload = { sub: userId, email, roles, permissions };
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: '15m',
    });

    const refreshToken = crypto.randomBytes(40).toString('hex');
    return { accessToken, refreshToken };
  }

  private async saveRefreshToken(userId: string, refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });
  }
}
