import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UserGroup } from './entities/user-group.entity';
import { GroupPermission } from './entities/group-permission.entity';
import { UsersController } from './users.controller'; // <--- Đảm bảo file này tồn tại cùng thư mục
import { UsersService } from './users.service';

import { AuthModule } from '../auth/auth.module'; // <--- IMPORT

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserGroup, GroupPermission]),
    forwardRef(() => AuthModule) // <--- Fix: Circular Dependency
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule { }