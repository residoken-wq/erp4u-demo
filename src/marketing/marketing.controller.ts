import { Perm } from '../auth/permissions.decorator';
import { Controller, Get, Post, Put, Delete, Body, Param, Query, ParseIntPipe } from '@nestjs/common';
import { MarketingService } from './marketing.service';
import { MarketingCampaign, CampaignStatus } from './entities/marketing-campaign.entity';
import { CustomerSegment } from './entities/customer-segment.entity';
import { AutomationWorkflow, WorkflowStatus } from './entities/automation-workflow.entity';

@Controller('marketing')
export class MarketingController {
    constructor(private readonly marketingService: MarketingService) { }

    // ===================== DASHBOARD =====================

    @Perm('MARKETING', 'view')
    @Get('dashboard')
    async getDashboard() {
        return this.marketingService.getDashboardStats();
    }

    // ===================== CAMPAIGNS =====================

    @Perm('MARKETING', 'view')
    @Get('campaigns')
    async getAllCampaigns(): Promise<MarketingCampaign[]> {
        return this.marketingService.findAllCampaigns();
    }

    @Perm('MARKETING', 'view')
    @Get('campaigns/:id')
    async getCampaign(@Param('id', ParseIntPipe) id: number): Promise<MarketingCampaign> {
        return this.marketingService.findCampaignById(id);
    }

    @Perm('MARKETING', 'create')
    @Post('campaigns')
    async createCampaign(@Body() data: Partial<MarketingCampaign>): Promise<MarketingCampaign> {
        return this.marketingService.createCampaign(data);
    }

    @Perm('MARKETING', 'update')
    @Put('campaigns/:id')
    async updateCampaign(
        @Param('id', ParseIntPipe) id: number,
        @Body() data: Partial<MarketingCampaign>,
    ): Promise<MarketingCampaign> {
        return this.marketingService.updateCampaign(id, data);
    }

    @Perm('MARKETING', 'update')
    @Put('campaigns/:id/status')
    async updateCampaignStatus(
        @Param('id', ParseIntPipe) id: number,
        @Body('status') status: CampaignStatus,
    ): Promise<MarketingCampaign> {
        return this.marketingService.updateCampaignStatus(id, status);
    }

    @Perm('MARKETING', 'delete')
    @Delete('campaigns/:id')
    async deleteCampaign(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
        await this.marketingService.deleteCampaign(id);
        return { message: 'Campaign deleted successfully' };
    }

    // ===================== SEGMENTS =====================

    @Perm('MARKETING', 'view')
    @Get('segments')
    async getAllSegments(): Promise<CustomerSegment[]> {
        return this.marketingService.findAllSegments();
    }

    @Perm('MARKETING', 'view')
    @Get('segments/:id')
    async getSegment(@Param('id', ParseIntPipe) id: number): Promise<CustomerSegment> {
        return this.marketingService.findSegmentById(id);
    }

    @Perm('MARKETING', 'view')
    @Get('segments/:id/customers')
    async getSegmentCustomers(@Param('id', ParseIntPipe) id: number) {
        return this.marketingService.getSegmentCustomers(id);
    }

    @Perm('MARKETING', 'view')
    @Post('segments/:id/calculate')
    async calculateSegment(@Param('id', ParseIntPipe) id: number) {
        const customerIds = await this.marketingService.calculateSegmentCustomers(id);
        return { customer_ids: customerIds, count: customerIds.length };
    }

    @Perm('MARKETING', 'create')
    @Post('segments')
    async createSegment(@Body() data: Partial<CustomerSegment>): Promise<CustomerSegment> {
        return this.marketingService.createSegment(data);
    }

    @Perm('MARKETING', 'update')
    @Put('segments/:id')
    async updateSegment(
        @Param('id', ParseIntPipe) id: number,
        @Body() data: Partial<CustomerSegment>,
    ): Promise<CustomerSegment> {
        return this.marketingService.updateSegment(id, data);
    }

    @Perm('MARKETING', 'delete')
    @Delete('segments/:id')
    async deleteSegment(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
        await this.marketingService.deleteSegment(id);
        return { message: 'Segment deleted successfully' };
    }

    // ===================== WORKFLOWS =====================

    @Perm('MARKETING', 'view')
    @Get('workflows')
    async getAllWorkflows(): Promise<AutomationWorkflow[]> {
        return this.marketingService.findAllWorkflows();
    }

    @Perm('MARKETING', 'view')
    @Get('workflows/:id')
    async getWorkflow(@Param('id', ParseIntPipe) id: number): Promise<AutomationWorkflow> {
        return this.marketingService.findWorkflowById(id);
    }

    @Perm('MARKETING', 'create')
    @Post('workflows')
    async createWorkflow(@Body() data: Partial<AutomationWorkflow>): Promise<AutomationWorkflow> {
        return this.marketingService.createWorkflow(data);
    }

    @Perm('MARKETING', 'update')
    @Put('workflows/:id')
    async updateWorkflow(
        @Param('id', ParseIntPipe) id: number,
        @Body() data: Partial<AutomationWorkflow>,
    ): Promise<AutomationWorkflow> {
        return this.marketingService.updateWorkflow(id, data);
    }

    @Perm('MARKETING', 'update')
    @Put('workflows/:id/status')
    async updateWorkflowStatus(
        @Param('id', ParseIntPipe) id: number,
        @Body('status') status: WorkflowStatus,
    ): Promise<AutomationWorkflow> {
        return this.marketingService.updateWorkflowStatus(id, status);
    }

    @Perm('MARKETING', 'delete')
    @Delete('workflows/:id')
    async deleteWorkflow(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
        await this.marketingService.deleteWorkflow(id);
        return { message: 'Workflow deleted successfully' };
    }
}
