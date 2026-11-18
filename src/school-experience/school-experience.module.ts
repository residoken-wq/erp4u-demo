import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchoolExperienceRevision } from './entities/school-experience-revision.entity';
import { SchoolExperienceService } from './school-experience.service';
import { SchoolExperienceController } from './school-experience.controller';

@Module({
    imports: [TypeOrmModule.forFeature([SchoolExperienceRevision])],
    controllers: [SchoolExperienceController],
    providers: [SchoolExperienceService],
    exports: [SchoolExperienceService],
})
export class SchoolExperienceModule {}
