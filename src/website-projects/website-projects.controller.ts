import { Perm } from '../auth/permissions.decorator';
import { Public } from '../auth/public.decorator';
import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { WebsiteProjectsService } from './website-projects.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('website-projects')
export class WebsiteProjectsController {
    constructor(private readonly service: WebsiteProjectsService) { }

    @Public()
    @Get()
    findAll(@Query() query: any) {
        return this.service.findAll(query);
    }

    @Perm('CMS', 'view')
    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.service.findOne(id);
    }

    @UseGuards(JwtAuthGuard)
    @Perm('CMS', 'create')
    @Post()
    create(@Body() body: any) {
        return this.service.create(body);
    }

    @UseGuards(JwtAuthGuard)
    @Perm('CMS', 'update')
    @Put(':id')
    update(@Param('id') id: number, @Body() body: any) {
        return this.service.update(id, body);
    }

    @UseGuards(JwtAuthGuard)
    @Perm('CMS', 'delete')
    @Delete(':id')
    remove(@Param('id') id: number) {
        return this.service.remove(id);
    }
}
