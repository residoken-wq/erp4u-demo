import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { BlogsService } from './blogs.service';

@Controller('blogs')
export class BlogsController {
    constructor(private readonly service: BlogsService) { }

    // --- Categories (must be BEFORE :id route) ---
    @Get('categories')
    getCategories() {
        return this.service.getCategories();
    }

    @Post('categories')
    saveCategories(@Body() body: { categories: string[] }) {
        return this.service.saveCategories(body.categories);
    }

    // --- CMS APIs (require auth in production) ---
    @Get()
    findAll() {
        return this.service.findAll();
    }

    @Get(':id')
    findOne(@Param('id') id: number) {
        return this.service.findOne(Number(id));
    }

    @Post()
    create(@Body() body: any) {
        return this.service.create(body);
    }

    @Put(':id')
    update(@Param('id') id: number, @Body() body: any) {
        return this.service.update(Number(id), body);
    }

    @Post(':id/publish')
    publish(@Param('id') id: number) {
        return this.service.publish(Number(id));
    }

    @Post(':id/unpublish')
    unpublish(@Param('id') id: number) {
        return this.service.unpublish(Number(id));
    }

    @Delete(':id')
    remove(@Param('id') id: number) {
        return this.service.remove(Number(id));
    }
}
