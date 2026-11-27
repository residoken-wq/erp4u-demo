import { AuthOnly } from '../auth/permissions.decorator';
import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    Req,
    UseGuards,
    UsePipes,
    ValidationPipe,
} from '@nestjs/common';
import { DiscussionsService } from './discussions.service';
import { RequiresPackage } from '../common/packages/requires-package.decorator';
import { PackageKey } from '../common/packages/package.registry';
import { CreateDiscussionDto } from './dto/create-discussion.dto';
import { UpdateDiscussionDto } from './dto/update-discussion.dto';
import { AddDiscussionCommentDto } from './dto/add-comment.dto';
import { UpdateDiscussionCommentDto } from './dto/update-comment.dto';
import { PinDiscussionDto } from './dto/pin-discussion.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('discussions')
@RequiresPackage(PackageKey.PROJECTS)
@UseGuards(JwtAuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class DiscussionsController {
    constructor(private readonly service: DiscussionsService) { }

    @AuthOnly()
    @Get()
    findAll(
        @Req() req: any,
        @Query('page') page?: number,
        @Query('limit') limit?: number,
        @Query('q') q?: string,
        @Query('group_id') groupId?: number,
    ) {
        return this.service.findAll(req.user, {
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
            q,
            group_id: groupId ? Number(groupId) : undefined,
        });
    }

    @AuthOnly()
    @Get(':id')
    findOne(@Param('id') id: number, @Req() req: any) {
        return this.service.findOne(Number(id), req.user);
    }

    @AuthOnly()
    @Post()
    create(@Body() body: CreateDiscussionDto, @Req() req: any) {
        return this.service.create(body, req.user);
    }

    @AuthOnly()
    @Put(':id')
    update(@Param('id') id: number, @Body() body: UpdateDiscussionDto, @Req() req: any) {
        return this.service.update(Number(id), body, req.user);
    }

    @AuthOnly()
    @Delete(':id')
    remove(@Param('id') id: number, @Req() req: any) {
        return this.service.remove(Number(id), req.user);
    }

    @AuthOnly()
    @Put(':id/pin')
    pin(@Param('id') id: number, @Body() body: PinDiscussionDto, @Req() req: any) {
        return this.service.pin(Number(id), body.pinned, req.user);
    }

    // Comments
    @AuthOnly()
    @Post(':id/comments')
    addComment(@Param('id') id: number, @Body() body: AddDiscussionCommentDto, @Req() req: any) {
        return this.service.addComment(Number(id), body, req.user);
    }

    @AuthOnly()
    @Put('comments/:commentId')
    updateComment(@Param('commentId') commentId: number, @Body() body: UpdateDiscussionCommentDto, @Req() req: any) {
        return this.service.updateComment(Number(commentId), body, req.user);
    }

    @AuthOnly()
    @Delete('comments/:commentId')
    removeComment(@Param('commentId') commentId: number, @Req() req: any) {
        return this.service.removeComment(Number(commentId), req.user);
    }
}
