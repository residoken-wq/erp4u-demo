import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { RbacController } from './rbac.controller';
import { UsersModule } from '../users/users.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { PermissionsGuard } from './permissions.guard';
import { SuperAdminGuard } from './super-admin.guard';
import { RbacGuard } from './rbac.guard';
import { RbacModeService } from './rbac-mode.service';
import { RbacAccessLogService } from './rbac-access-log.service';
import { PermissionCacheService } from './permission-cache.service';
import { RbacSeedService } from './rbac-seed.service';
import { GroupPermission } from '../users/entities/group-permission.entity';
import { User } from '../users/entities/user.entity';
import { UserGroup } from '../users/entities/user-group.entity';
import { SystemConfig } from '../system/system-config.entity';
import { RbacAccessLog } from './entities/rbac-access-log.entity';
import { ActivityLog } from '../system/entities/activity-log.entity';
import { getJwtSecret } from '../common/security/secrets';

@Module({
  imports: [
    forwardRef(() => UsersModule),
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: getJwtSecret(),
        signOptions: { expiresIn: '1d' }, // Token hết hạn sau 1 ngày
      }),
    }),
    TypeOrmModule.forFeature([
      GroupPermission,
      User,
      UserGroup,
      SystemConfig,
      RbacAccessLog,
      ActivityLog,
    ]),
  ],
  providers: [
    AuthService,
    JwtStrategy,
    PermissionsGuard,
    SuperAdminGuard,
    RbacModeService,
    PermissionCacheService,
    RbacAccessLogService,
    RbacSeedService,
    {
      provide: APP_GUARD,
      useClass: RbacGuard,
    },
  ],
  controllers: [AuthController, RbacController],
  exports: [
    AuthService,
    JwtStrategy,
    PassportModule,
    JwtModule,
    PermissionsGuard,
    SuperAdminGuard,
    RbacModeService,
    PermissionCacheService,
    RbacAccessLogService,
    RbacSeedService,
    TypeOrmModule,
  ],
})
export class AuthModule {}
