import { Perm } from '../auth/permissions.decorator';
import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { BlogsService } from './blogs.service';

@Controller('blogs')
export class BlogsController {
    constructor(private readonly service: BlogsService) { }

    // --- Categories (must be BEFORE :id route) ---
    @Perm('CMS', 'view')
    @Get('categories')
    getCategories() {
        return this.service.getCategories();
    }

    @Perm('CMS', 'create')
    @Post('categories')
    saveCategories(@Body() body: { categories: string[] }) {
        return this.service.saveCategories(body.categories);
    }

    // --- CMS APIs (require auth in production) ---
    @Perm('CMS', 'view')
    @Get()
    findAll() {
        return this.service.findAll();
    }

    @Perm('CMS', 'view')
    @Get(':id')
    findOne(@Param('id') id: number) {
        return this.service.findOne(Number(id));
    }

    @Perm('CMS', 'create')
    @Post()
    create(@Body() body: any) {
        return this.service.create(body);
    }

    @Perm('CMS', 'update')
    @Put(':id')
    update(@Param('id') id: number, @Body() body: any) {
        return this.service.update(Number(id), body);
    }

    @Perm('CMS', 'create')
    @Post(':id/publish')
    publish(@Param('id') id: number) {
        return this.service.publish(Number(id));
    }

    @Perm('CMS', 'create')
    @Post(':id/unpublish')
    unpublish(@Param('id') id: number) {
        return this.service.unpublish(Number(id));
    }

    @Perm('CMS', 'delete')
    @Delete(':id')
    remove(@Param('id') id: number) {
        return this.service.remove(Number(id));
    }
}
