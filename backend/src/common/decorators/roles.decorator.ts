import { SetMetadata } from '@nestjs/common';
import { AppRoleName } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: AppRoleName[]) => SetMetadata(ROLES_KEY, roles);
