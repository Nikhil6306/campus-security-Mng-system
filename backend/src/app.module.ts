import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';

import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { RealtimeModule } from './realtime/realtime.module';
import { QueueModule } from './queues/queue.module';
import { UploadsModule } from './uploads/uploads.module';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { VisitorsModule } from './visitors/visitors.module';
import { VisitorRequestsModule } from './visitor-requests/visitor-requests.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { CampusesModule } from './campuses/campuses.module';
import { BuildingsModule } from './buildings/buildings.module';
import { GatesModule } from './gates/gates.module';
import { EntriesModule } from './entries/entries.module';
import { ExitsModule } from './exits/exits.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { FacultyModule } from './faculty/faculty.module';
import { DepartmentsModule } from './departments/departments.module';
import { QrPassesModule } from './qr-passes/qr-passes.module';
import { IncidentsModule } from './incidents/incidents.module';
import { GuardsManagementModule } from './guards-management/guards-management.module';
import { ShiftsModule } from './shifts/shifts.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { ReportsModule } from './reports/reports.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    PrismaModule,
    RedisModule,
    RealtimeModule,
    QueueModule,
    UploadsModule,
    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    VisitorsModule,
    VisitorRequestsModule,
    AppointmentsModule,
    CampusesModule,
    BuildingsModule,
    GatesModule,
    EntriesModule,
    ExitsModule,
    VehiclesModule,
    FacultyModule,
    DepartmentsModule,
    QrPassesModule,
    IncidentsModule,
    GuardsManagementModule,
    ShiftsModule,
    NotificationsModule,
    AuditLogsModule,
    ReportsModule,
    HealthModule,
  ],
})
export class AppModule {}
