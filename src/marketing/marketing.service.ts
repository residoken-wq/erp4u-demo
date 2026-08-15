import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { MarketingCampaign, CampaignStatus, CampaignType } from './entities/marketing-campaign.entity';
import { CustomerSegment, SegmentType } from './entities/customer-segment.entity';
import { AutomationWorkflow, WorkflowStatus } from './entities/automation-workflow.entity';
import { Customer, CustomerType } from '../customers/customer.entity';
import { SalesOrder } from '../sales/sales-order.entity';

@Injectable()
export class MarketingService {
    private readonly logger = new Logger(MarketingService.name);

    constructor(
        @InjectRepository(MarketingCampaign)
        private campaignRepo: Repository<MarketingCampaign>,
        @InjectRepository(CustomerSegment)
        private segmentRepo: Repository<CustomerSegment>,
        @InjectRepository(AutomationWorkflow)
        private workflowRepo: Repository<AutomationWorkflow>,
        @InjectRepository(Customer)
        private customerRepo: Repository<Customer>,
        @InjectRepository(SalesOrder)
        private salesOrderRepo: Repository<SalesOrder>,
    ) { }

    // ===================== CAMPAIGNS =====================

    async findAllCampaigns(): Promise<MarketingCampaign[]> {
        return this.campaignRepo.find({
            order: { created_at: 'DESC' },
            relations: ['created_by'],
        });
    }

    async findCampaignById(id: number): Promise<MarketingCampaign> {
        const campaign = await this.campaignRepo.findOne({
            where: { id },
            relations: ['created_by'],
        });
        if (!campaign) {
            throw new NotFoundException(`Campaign #${id} not found`);
        }
        return campaign;
    }

    async createCampaign(data: Partial<MarketingCampaign>): Promise<MarketingCampaign> {
        const campaign = this.campaignRepo.create(data);
        return this.campaignRepo.save(campaign);
    }

    async updateCampaign(id: number, data: Partial<MarketingCampaign>): Promise<MarketingCampaign> {
        await this.campaignRepo.update(id, data);
        return this.findCampaignById(id);
    }

    async deleteCampaign(id: number): Promise<void> {
        await this.campaignRepo.delete(id);
    }

    async updateCampaignStatus(id: number, status: CampaignStatus): Promise<MarketingCampaign> {
        const updates: Partial<MarketingCampaign> = { status };

        if (status === CampaignStatus.RUNNING) {
            updates.started_at = new Date();
        } else if (status === CampaignStatus.COMPLETED) {
            updates.completed_at = new Date();
        }

        await this.campaignRepo.update(id, updates);
        return this.findCampaignById(id);
    }

    // ===================== SEGMENTS =====================

    async findAllSegments(): Promise<CustomerSegment[]> {
        return this.segmentRepo.find({
            order: { created_at: 'DESC' },
        });
    }

    async findSegmentById(id: number): Promise<CustomerSegment> {
        const segment = await this.segmentRepo.findOne({ where: { id } });
        if (!segment) {
            throw new NotFoundException(`Segment #${id} not found`);
        }
        return segment;
    }

    async createSegment(data: Partial<CustomerSegment>): Promise<CustomerSegment> {
        const segment = this.segmentRepo.create(data);
        const saved = await this.segmentRepo.save(segment);

        // Calculate customer count
        if (segment.type === SegmentType.DYNAMIC) {
            await this.calculateSegmentCustomers(saved.id);
        }

        return this.findSegmentById(saved.id);
    }

    async updateSegment(id: number, data: Partial<CustomerSegment>): Promise<CustomerSegment> {
        await this.segmentRepo.update(id, data);
        return this.findSegmentById(id);
    }

    async deleteSegment(id: number): Promise<void> {
        await this.segmentRepo.delete(id);
    }

    async calculateSegmentCustomers(segmentId: number): Promise<number[]> {
        const segment = await this.findSegmentById(segmentId);

        if (segment.type === SegmentType.STATIC) {
            return segment.customer_ids || [];
        }

        // Build dynamic query based on criteria
        const qb = this.customerRepo.createQueryBuilder('c');
        const criteria = segment.criteria;

        // RFM Analysis
        if (criteria.rfm) {
            // This would need more complex subqueries for proper RFM
            if (criteria.rfm.recency_days?.max) {
                qb.andWhere(`c.created_at > NOW() - INTERVAL '${criteria.rfm.recency_days.max} days'`);
            }
        }

        // Customer type filter
        if (criteria.attributes?.type?.length) {
            qb.andWhere('c.type IN (:...types)', { types: criteria.attributes.type });
        }

        // Lead status filter
        if (criteria.attributes?.lead_status?.length) {
            qb.andWhere('c.lead_status IN (:...statuses)', { statuses: criteria.attributes.lead_status });
        }

        const customers = await qb.select('c.id').getMany();
        const customerIds = customers.map(c => c.id);

        // Update segment with customer count
        await this.segmentRepo.update(segmentId, {
            customer_count: customerIds.length,
            last_calculated_at: new Date(),
        });

        this.logger.log(`Calculated segment ${segmentId}: ${customerIds.length} customers`);
        return customerIds;
    }

    async getSegmentCustomers(segmentId: number): Promise<Customer[]> {
        const segment = await this.findSegmentById(segmentId);

        if (segment.type === SegmentType.STATIC && segment.customer_ids?.length) {
            return this.customerRepo.find({
                where: { id: In(segment.customer_ids) },
            });
        }

        const customerIds = await this.calculateSegmentCustomers(segmentId);
        if (!customerIds.length) return [];

        return this.customerRepo.find({
            where: { id: In(customerIds) },
        });
    }

    // ===================== WORKFLOWS =====================

    async findAllWorkflows(): Promise<AutomationWorkflow[]> {
        return this.workflowRepo.find({
            order: { created_at: 'DESC' },
        });
    }

    async findWorkflowById(id: number): Promise<AutomationWorkflow> {
        const workflow = await this.workflowRepo.findOne({ where: { id } });
        if (!workflow) {
            throw new NotFoundException(`Workflow #${id} not found`);
        }
        return workflow;
    }

    async createWorkflow(data: Partial<AutomationWorkflow>): Promise<AutomationWorkflow> {
        const workflow = this.workflowRepo.create(data);
        return this.workflowRepo.save(workflow);
    }

    async updateWorkflow(id: number, data: Partial<AutomationWorkflow>): Promise<AutomationWorkflow> {
        await this.workflowRepo.update(id, data);
        return this.findWorkflowById(id);
    }

    async deleteWorkflow(id: number): Promise<void> {
        await this.workflowRepo.delete(id);
    }

    async updateWorkflowStatus(id: number, status: WorkflowStatus): Promise<AutomationWorkflow> {
        await this.workflowRepo.update(id, { status });
        return this.findWorkflowById(id);
    }

    // ===================== ANALYTICS =====================

    async getDashboardStats(): Promise<{
        total_campaigns: number;
        active_campaigns: number;
        total_segments: number;
        total_workflows: number;
        active_workflows: number;
    }> {
        const [
            totalCampaigns,
            activeCampaigns,
            totalSegments,
            totalWorkflows,
            activeWorkflows,
        ] = await Promise.all([
            this.campaignRepo.count(),
            this.campaignRepo.count({ where: { status: CampaignStatus.RUNNING } }),
            this.segmentRepo.count(),
            this.workflowRepo.count(),
            this.workflowRepo.count({ where: { status: WorkflowStatus.ACTIVE } }),
        ]);

        return {
            total_campaigns: totalCampaigns,
            active_campaigns: activeCampaigns,
            total_segments: totalSegments,
            total_workflows: totalWorkflows,
            active_workflows: activeWorkflows,
        };
    }
}
