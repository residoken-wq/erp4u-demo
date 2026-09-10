import {
    Controller,
    Get,
    Put,
    Post,
    Body,
    Param,
    UseGuards,
    Req,
} from '@nestjs/common';
import { SchoolExperienceService } from './school-experience.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';

@Controller('school-experience')
export class SchoolExperienceController {
    constructor(private readonly service: SchoolExperienceService) {}

    /**
     * Public endpoint: Get currently published configuration
     */
    @Public()
    @Get('public')
    getPublicConfig() {
        return this.service.getPublishedConfig();
    }

    /**
     * Admin: Get current draft configuration
     */
    @UseGuards(JwtAuthGuard)
    @Get('draft')
    getDraft() {
        return this.service.getDraftConfig();
    }

    /**
     * Admin: Save working draft
     */
    @UseGuards(JwtAuthGuard)
    @Put('draft')
    saveDraft(@Body() body: any, @Req() req: any) {
        const author = req?.user?.username || req?.user?.email || 'Admin';
        return this.service.saveDraft(body, author);
    }

    /**
     * Admin: Atomically publish the draft
     */
    @UseGuards(JwtAuthGuard)
    @Post('publish')
    publishDraft(@Body() body: { changelog?: string }, @Req() req: any) {
        const author = req?.user?.username || req?.user?.email || 'Admin';
        return this.service.publishDraft(author, body?.changelog);
    }

    /**
     * Admin: List publication revision history
     */
    @UseGuards(JwtAuthGuard)
    @Get('revisions')
    getRevisions() {
        return this.service.getRevisions();
    }

    /**
     * Admin: Rollback to a specific revision
     */
    @UseGuards(JwtAuthGuard)
    @Post('rollback/:id')
    rollback(@Param('id') id: string, @Req() req: any) {
        const author = req?.user?.username || req?.user?.email || 'Admin';
        return this.service.rollbackToRevision(parseInt(id, 10), author);
    }
}
