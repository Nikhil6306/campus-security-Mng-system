import { PrismaClient, AppRoleName } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding DSVV Campus Security Enterprise Database...');

  // 1. Roles
  const roles: AppRoleName[] = [
    'SUPER_ADMIN',
    'ADMIN',
    'SECURITY_ADMIN',
    'SECURITY_OFFICER',
    'GATE_GUARD',
    'RECEPTION',
    'FACULTY',
    'STAFF',
    'STUDENT',
    'VISITOR',
  ];

  for (const roleName of roles) {
    await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName, description: `${roleName} system role` },
    });
  }

  // 2. Default Admin User
  const adminPasswordHash = crypto.createHash('sha256').update('Admin@123').digest('hex');
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@dsvv.ac.in' },
    update: {},
    create: {
      email: 'admin@dsvv.ac.in',
      passwordHash: adminPasswordHash,
      fullName: 'DSVV Campus Security Administrator',
      phone: '+919810012000',
    },
  });

  const superAdminRole = await prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } });
  if (superAdminRole) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: adminUser.id, roleId: superAdminRole.id } },
      update: {},
      create: { userId: adminUser.id, roleId: superAdminRole.id },
    });
  }

  // 3. Gates
  const sampleGates = [
    { name: 'Main Gate (Gate 1)', code: 'GATE-001', location: 'NH-58 Haridwar Road' },
    { name: 'Rear Gate (Gate 2)', code: 'GATE-002', location: 'Academic Block West' },
    { name: 'Hostel Gate 1', code: 'GATE-003', location: 'Boys Hostel Campus' },
  ];

  for (const g of sampleGates) {
    await prisma.gate.upsert({
      where: { name: g.name },
      update: {},
      create: { name: g.name, code: g.code, location: g.location },
    });
  }

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
