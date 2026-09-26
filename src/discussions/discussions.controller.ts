import { AuthOnly } from '../auth/permissions.decorator';
import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { DiscussionsService } from './discussions.service';

@Controller('discussions')
export class DiscussionsController {
    constructor(private readonly service: DiscussionsService) { }

    @AuthOnly()
    @Get()
    findAll(@Query('group_id') groupId?: number) {
        return this.service.findAll(groupId);
    }

    @AuthOnly()
    @Get(':id')
    findOne(@Param('id') id: number) {
        return this.service.findOne(id);
    }

    @AuthOnly()
    @Post()
    create(@Body() body: any) {
        return this.service.create(body);
    }

    @AuthOnly()
    @Put(':id')
    update(@Param('id') id: number, @Body() body: any) {
        return this.service.update(id, body);
    }

    @AuthOnly()
    @Delete(':id')
    remove(@Param('id') id: number) {
        return this.service.remove(id);
    }

    // Comments
    @AuthOnly()
    @Post(':id/comments')
    addComment(@Param('id') id: number, @Body() body: any) {
        return this.service.addComment(id, body);
    }

    @AuthOnly()
    @Delete('comments/:commentId')
    removeComment(@Param('commentId') commentId: number) {
        return this.service.removeComment(commentId);
    }

    @AuthOnly()
    @Put(':id/review')
    review(@Param('id') id: number) {
        return this.service.review(id);
    }
}
