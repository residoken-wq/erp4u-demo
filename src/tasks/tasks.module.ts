import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule'; // Import Cron
import { Task } from './task.entity';
import { TaskTimeLog } from './task-time-log.entity';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, TaskTimeLog]),
    ScheduleModule.forRoot(), // Kích hoạt Cron Job
    NotificationsModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService]
})
export class TasksModule { }