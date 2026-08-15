import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectsService } from './projects.service';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
    constructor(private readonly service: ProjectsService) { }

    @Get()
    findAll(@Req() req: any) {
        return this.service.findAll(req.user);
    }

    @Get(':id')
    findOne(@Param('id') id: number, @Req() req: any) {
        return this.service.findOne(id, req.user);
    }

    @Post()
    create(@Body() body: any, @Req() req: any) {
        return this.service.create(body, req.user);
    }

    @Put(':id')
    update(@Param('id') id: number, @Body() body: any) {
        return this.service.update(id, body);
    }

    @Delete(':id')
    remove(@Param('id') id: number) {
        return this.service.remove(id);
    }

    // --- SO PROJECT ---
    @Post('from-so/:soId')
    createFromSO(@Param('soId') soId: number) {
        return this.service.createSOProject(soId);
    }

    // --- COST SUMMARY ---
    @Get(':id/cost-summary')
    getCostSummary(@Param('id') id: number) {
        return this.service.getCostSummary(id);
    }

    // Milestones
    @Post(':id/milestones')
    addMilestone(@Param('id') id: number, @Body() body: any) {
        return this.service.addMilestone(id, body);
    }

    @Put('milestones/:milestoneId')
    updateMilestone(@Param('milestoneId') milestoneId: number, @Body() body: any) {
        return this.service.updateMilestone(milestoneId, body);
    }

    @Delete('milestones/:milestoneId')
    removeMilestone(@Param('milestoneId') milestoneId: number) {
        return this.service.removeMilestone(milestoneId);
    }
}
