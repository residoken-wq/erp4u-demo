import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Project, ProjectStatus, ProjectType } from './entities/project.entity';
import { Milestone } from './entities/milestone.entity';
import { SalesOrder } from '../sales/sales-order.entity';
import { Task, TaskStatus, TaskPriority } from '../tasks/task.entity';
import { Transaction } from '../finance/transaction.entity';
import { PurchaseOrder } from '../purchasing/entities/purchase-order.entity';
import { SystemConfig } from '../system/system-config.entity';
import { DEFAULT_SO_PROJECT_TEMPLATE } from '../system/system.service';

@Injectable()
export class ProjectsService {
    constructor(
        @InjectRepository(Project) private repo: Repository<Project>,
        @InjectRepository(Milestone) private milestoneRepo: Repository<Milestone>,
        @InjectRepository(SalesOrder) private soRepo: Repository<SalesOrder>,
        @InjectRepository(Task) private taskRepo: Repository<Task>,
        @InjectRepository(Transaction) private transRepo: Repository<Transaction>,
        @InjectRepository(PurchaseOrder) private poRepo: Repository<PurchaseOrder>,
        @InjectRepository(SystemConfig) private configRepo: Repository<SystemConfig>,
    ) { }

    async findAll(user: any) {
        // Get all projects where user is manager, member, or assigned to a task
        const allProjects = await this.repo.find({
            relations: ['manager', 'members', 'sales_order', 'sales_order.customer', 'tasks'],
            order: { created_at: 'DESC' },
        });

        return allProjects.filter(p => {
            // Admin bypass
            if (Number(user?.groupId) === 1) return true;
            
            // Creator always sees the project
            if (p.created_by_id === Number(user.id)) return true;
            // Manager always sees the project
            if (p.manager_id === Number(user.id)) return true;
            // Members see the project
            if (p.members?.some(m => m.id === Number(user.id))) return true;
            // For SO_PROJECT: users assigned to any task see the project
            if (p.tasks?.some(t => t.assignee_id === Number(user.id))) return true;
            // For SO_PROJECT: owner of the SO should always see it
            if (p.sales_order?.assigned_to_id === Number(user.id)) return true;
            
            return false;
        });
    }

    async findOne(id: number, user?: any) {
        const project = await this.repo.findOne({
            where: { id },
            relations: ['manager', 'milestones', 'milestones.owner', 'milestones.tasks', 'milestones.tasks.assignee',
                'members', 'tasks', 'tasks.assignee',
                'sales_order', 'sales_order.customer', 'sales_order.items']
        });
        if (!project) throw new NotFoundException('Project not found');

        // Access check: manager, member, or task assignee
        if (user && Number(user.groupId) !== 1) { // Admin bypass
            const isCreator = project.created_by_id === Number(user.id);
            const isMember = project.members?.some(m => m.id === Number(user.id));
            const isManager = project.manager_id === Number(user.id);
            const isTaskAssignee = project.tasks?.some(t => t.assignee_id === Number(user.id));
            const isSOOwner = project.sales_order?.assigned_to_id === Number(user.id);

            if (!isCreator && !isMember && !isManager && !isTaskAssignee && !isSOOwner) {
                throw new NotFoundException('Project not found or access denied');
            }
        }

        // Sort milestones by sort_order
        if (project.milestones) {
            project.milestones.sort((a, b) => a.sort_order - b.sort_order);
        }

        return project;
    }

    async create(data: any, user?: any) {
        const { member_ids, ...rest } = data;
        const projectData: Partial<Project> = rest;
        
        if (user && user.id) {
            projectData.created_by_id = Number(user.id);
        }
        
        const project = this.repo.create(projectData);

        if (member_ids && member_ids.length > 0) {
            project.members = member_ids.map((id: number) => ({ id }));
        }

        return this.repo.save(project);
    }

    async update(id: number, data: any) {
        const { member_ids, ...rest } = data;
        const project = await this.repo.findOne({ where: { id } });

        if (member_ids) {
            project.members = member_ids.map((uid: number) => ({ id: uid }));
        }

        Object.assign(project, rest);
        await this.repo.save(project);
        return this.findOne(id);
    }

    async remove(id: number) {
        return this.repo.delete(id);
    }

    // ============================
    // SO PROJECT: Auto-create
    // ============================
    async createSOProject(salesOrderId: number) {
        // Check if project already exists for this SO
        const existing = await this.repo.findOne({ where: { sales_order_id: salesOrderId } });
        if (existing) return existing;

        const so = await this.soRepo.findOne({
            where: { id: salesOrderId },
            relations: ['customer', 'items']
        });
        if (!so) throw new NotFoundException('Sales Order not found');

        // Calculate total from SO
        let subtotal = 0;
        so.items?.forEach(item => {
            subtotal += Number(item.quantity || 0) * Number(item.unit_price || 0);
        });

        const project = this.repo.create({
            title: `[${so.order_code}] ${so.customer?.name || 'Đơn hàng'}`,
            description: `Dự án đơn hàng ${so.order_code} - Khách hàng: ${so.customer?.name || ''}`,
            project_type: ProjectType.SO_PROJECT,
            sales_order_id: salesOrderId,
            status: ProjectStatus.ACTIVE,
            manager_id: so.assigned_to_id || null,
            budget: Number(so.total_amount) || subtotal,
            start_date: new Date(),
        });

        const savedProject = await this.repo.save(project);

        // Fetch template from SystemConfig
        const config = await this.configRepo.findOne({ where: { key: 'SO_PROJECT_TEMPLATE' } });
        let templateMilestones = DEFAULT_SO_PROJECT_TEMPLATE;
        if (config && config.value) {
            try {
                templateMilestones = JSON.parse(config.value);
            } catch (e) {
                console.error('Failed to parse SO_PROJECT_TEMPLATE', e);
            }
        }

        // Create milestones + default tasks from template
        for (const tmpl of templateMilestones) {
            const ms = this.milestoneRepo.create({
                project_id: savedProject.id,
                title: tmpl.title,
                department: tmpl.department,
                sort_order: tmpl.sort_order,
                status: 'PLANNING',
                is_active: true,
            });
            const savedMs = await this.milestoneRepo.save(ms);

            // Create default tasks for this milestone
            for (const taskTitle of tmpl.tasks) {
                await this.taskRepo.save(this.taskRepo.create({
                    title: taskTitle,
                    project_id: savedProject.id,
                    milestone_id: savedMs.id,
                    department: tmpl.department,
                    status: TaskStatus.TODO,
                    priority: TaskPriority.MEDIUM,
                    reference_code: so.order_code,
                    reference_type: 'SALES',
                }));
            }
        }

        return this.findOne(savedProject.id);
    }

    // Cancel project when SO is cancelled
    async cancelSOProject(salesOrderId: number) {
        const project = await this.repo.findOne({ where: { sales_order_id: salesOrderId } });
        if (project) {
            project.status = ProjectStatus.CANCELLED;
            await this.repo.save(project);
        }
    }

    // ============================
    // COST SUMMARY
    // ============================
    async getCostSummary(projectId: number) {
        const project = await this.repo.findOne({
            where: { id: projectId },
            relations: ['milestones', 'sales_order']
        });
        if (!project) throw new NotFoundException('Project not found');

        // Get all tasks for project
        const tasks = await this.taskRepo.find({ where: { project_id: projectId }, relations: ['assignee'] });

        // Get Transactions directly mapped to project
        const transactions = await this.transRepo.find({
            where: { project_id: projectId }
        });

        // Get POs mapped to project
        const pos = await this.poRepo.find({
            where: { project_id: projectId }
        });

        // Get Transactions linked to POs
        const poCodes = pos.map(p => p.po_code).filter(c => !!c);
        let poTransactions: Transaction[] = [];
        if (poCodes.length > 0) {
            poTransactions = await this.transRepo.find({
                where: { reference_code: In(poCodes) } // PO payments
            });
        }

        // Apply dynamic actual_cost for tasks based on Transactions & POs
        for (const t of tasks) {
            let taskTransCost = 0;
            // 1. Direct transactions mapped to this task (only EXPENSE counts as cost, or we just sum amount if it's EXPENSE)
            const directTrans = transactions.filter(tr => tr.task_id === t.id && tr.type === 'EXPENSE');
            taskTransCost += directTrans.reduce((s, tr) => s + Number(tr.amount || 0), 0);

            // 2. Transactions mapped to a PO that is mapped to this task
            const taskPOs = pos.filter(p => p.task_id === t.id);
            const taskPOCodes = taskPOs.map(p => p.po_code);
            const poTrans = poTransactions.filter(tr => taskPOCodes.includes(tr.reference_code) && tr.type === 'EXPENSE');
            taskTransCost += poTrans.reduce((s, tr) => s + Number(tr.amount || 0), 0);

            // Update dynamically
            t.actual_cost = Number(t.actual_cost || 0) + taskTransCost;
        }

        // Project Root level explicit costs (Not tied to a specific task)
        const unassignedTrans = transactions.filter(tr => !tr.task_id && tr.type === 'EXPENSE');
        const rootTransCost = unassignedTrans.reduce((s, tr) => s + Number(tr.amount || 0), 0);
        
        const rootPOs = pos.filter(p => !p.task_id);
        const rootPOCodes = rootPOs.map(p => p.po_code);
        const rootPOTrans = poTransactions.filter(tr => rootPOCodes.includes(tr.reference_code) && tr.type === 'EXPENSE');
        const rootPOTransCost = rootPOTrans.reduce((s, tr) => s + Number(tr.amount || 0), 0);
        
        const extraRootActualCost = rootTransCost + rootPOTransCost;

        // Group by milestone
        const milestones = await this.milestoneRepo.find({ where: { project_id: projectId }, order: { sort_order: 'ASC' } });
        const byMilestone = milestones.map(ms => {
            const msTasks = tasks.filter(t => t.milestone_id === ms.id);
            return {
                milestone_id: ms.id,
                milestone_title: ms.title,
                department: ms.department,
                is_active: ms.is_active,
                task_count: msTasks.length,
                done_count: msTasks.filter(t => t.status === 'DONE').length,
                estimated_cost: msTasks.reduce((sum, t) => sum + Number(t.estimated_cost || 0), 0),
                actual_cost: msTasks.reduce((sum, t) => sum + Number(t.actual_cost || 0), 0),
            };
        });

        // Unassigned tasks (no milestone)
        const unassignedTasks = tasks.filter(t => !t.milestone_id);

        const totalEstimated = tasks.reduce((sum, t) => sum + Number(t.estimated_cost || 0), 0);
        const totalActual = tasks.reduce((sum, t) => sum + Number(t.actual_cost || 0), 0) + extraRootActualCost;

        return {
            project_id: projectId,
            project_type: project.project_type,
            budget: Number(project.budget) || 0,
            so_revenue: project.sales_order ? Number(project.sales_order.total_amount) || 0 : 0,
            total_estimated_cost: totalEstimated,
            total_actual_cost: totalActual,
            profit: project.sales_order ? (Number(project.sales_order.total_amount) || 0) - totalActual : null,
            by_milestone: byMilestone,
            unassigned_cost: {
                estimated: unassignedTasks.reduce((sum, t) => sum + Number(t.estimated_cost || 0), 0),
                actual: unassignedTasks.reduce((sum, t) => sum + Number(t.actual_cost || 0), 0) + extraRootActualCost,
            },
            total_tasks: tasks.length,
            done_tasks: tasks.filter(t => t.status === 'DONE').length,
        };
    }

    // Milestones
    async addMilestone(projectId: number, data: any) {
        const ms = this.milestoneRepo.create({
            project_id: projectId,
            ...data
        });
        await this.milestoneRepo.save(ms);
        return this.findOne(projectId);
    }

    async updateMilestone(id: number, data: any) {
        await this.milestoneRepo.update(id, data);
        const ms = await this.milestoneRepo.findOne({ where: { id } });
        return this.findOne(ms.project_id);
    }

    async removeMilestone(id: number) {
        const ms = await this.milestoneRepo.findOne({ where: { id } });
        if (ms) await this.milestoneRepo.delete(id);
        return { success: true };
    }
}
