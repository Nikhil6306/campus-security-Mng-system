import { AppRoleName } from '@prisma/client';

export const ADMIN_ROLES = [
  AppRoleName.SUPER_ADMIN,
  AppRoleName.ADMIN,
  AppRoleName.SECURITY_ADMIN,
] as const;
