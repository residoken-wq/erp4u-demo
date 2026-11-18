import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebProject } from './entities/web-project.entity';
import { WebsiteProjectsService } from './website-projects.service';
import { WebsiteProjectsController } from './website-projects.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([WebProject]),
        AuthModule
    ],
    controllers: [WebsiteProjectsController],
    providers: [WebsiteProjectsService],
    exports: [WebsiteProjectsService]
})
export class WebsiteProjectsModule { }
