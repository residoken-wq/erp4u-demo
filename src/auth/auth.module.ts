import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { PermissionsGuard } from './permissions.guard';
import { GroupPermission } from '../users/entities/group-permission.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    forwardRef(() => UsersModule),
    PassportModule,
    JwtModule.register({
      secret: 'ERP4U_SECRET_KEY',
      signOptions: { expiresIn: '1d' }, // Token hết hạn sau 1 ngày
    }),
    TypeOrmModule.forFeature([GroupPermission, User]), // Cho PermissionsGuard query DB
  ],
  providers: [AuthService, JwtStrategy, PermissionsGuard],
  controllers: [AuthController],
  exports: [AuthService, JwtStrategy, PassportModule, PermissionsGuard, TypeOrmModule], // Export để module khác dùng Guard
})
export class AuthModule { }