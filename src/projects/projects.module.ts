import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from './entities/project.entity';
import { Milestone } from './entities/milestone.entity';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { SalesOrder } from '../sales/sales-order.entity';
import { Task } from '../tasks/task.entity';
import { Transaction } from '../finance/transaction.entity';
import { PurchaseOrder } from '../purchasing/entities/purchase-order.entity';
import { SystemConfig } from '../system/system-config.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([Project, Milestone, SalesOrder, Task, Transaction, PurchaseOrder, SystemConfig])
    ],
    controllers: [ProjectsController],
    providers: [ProjectsService],
    exports: [ProjectsService]
})
export class ProjectsModule { }
