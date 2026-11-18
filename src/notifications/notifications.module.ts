import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './notification.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';

import { AuthModule } from '../auth/auth.module'; // <--- IMPORT

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification]),
    AuthModule // <--- IMPORT AUTH MODULE
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule { }