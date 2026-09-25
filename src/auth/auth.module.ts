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
import { GroupPermission } from '../users/entities/group-permission.entity';
import { User } from '../users/entities/user.entity';
import { SystemConfig } from '../system/system-config.entity';
import { RbacAccessLog } from './entities/rbac-access-log.entity';

@Module({
  imports: [
    forwardRef(() => UsersModule),
    PassportModule,
    JwtModule.register({
      secret: 'ERP4U_SECRET_KEY',
      signOptions: { expiresIn: '1d' }, // Token hết hạn sau 1 ngày
    }),
    TypeOrmModule.forFeature([GroupPermission, User, SystemConfig, RbacAccessLog]),
  ],
  providers: [
    AuthService,
    JwtStrategy,
    PermissionsGuard,
    SuperAdminGuard,
    RbacModeService,
    PermissionCacheService,
    RbacAccessLogService,
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
    PermissionsGuard,
    SuperAdminGuard,
    RbacModeService,
    PermissionCacheService,
    RbacAccessLogService,
    TypeOrmModule,
  ],
})
export class AuthModule {}