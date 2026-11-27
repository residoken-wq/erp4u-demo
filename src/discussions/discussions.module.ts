import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Discussion } from './entities/discussion.entity';
import { DiscussionComment } from './entities/discussion-comment.entity';
import { DiscussionRead } from './entities/discussion-read.entity';
import { User } from '../users/entities/user.entity';
import { DiscussionsController } from './discussions.controller';
import { DiscussionsService } from './discussions.service';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Discussion, DiscussionComment, DiscussionRead, User]),
        AuthModule,
        NotificationsModule,
    ],
    controllers: [DiscussionsController],
    providers: [DiscussionsService],
    exports: [DiscussionsService],
})
export class DiscussionsModule { }
