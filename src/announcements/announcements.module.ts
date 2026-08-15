import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';
import { Announcement } from './announcement.entity';
import { AnnouncementRead } from './announcement-read.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([Announcement, AnnouncementRead])
    ],
    controllers: [AnnouncementsController],
    providers: [AnnouncementsService],
    exports: [AnnouncementsService]
})
export class AnnouncementsModule { }
