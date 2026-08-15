import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Discussion } from './entities/discussion.entity';
import { DiscussionComment } from './entities/discussion-comment.entity';
import { DiscussionsController } from './discussions.controller';
import { DiscussionsService } from './discussions.service';
import { Notification } from '../notifications/notification.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([Discussion, DiscussionComment, Notification])
    ],
    controllers: [DiscussionsController],
    providers: [DiscussionsService],
    exports: [DiscussionsService]
})
export class DiscussionsModule { }
