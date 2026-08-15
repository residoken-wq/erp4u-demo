import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlogPost } from './blog-post.entity';
import { BlogsController } from './blogs.controller';
import { BlogsService } from './blogs.service';
import { SystemModule } from '../system/system.module';

@Module({
    imports: [TypeOrmModule.forFeature([BlogPost]), SystemModule],
    controllers: [BlogsController],
    providers: [BlogsService],
    exports: [BlogsService]
})
export class BlogsModule { }
