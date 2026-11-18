import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiMessage } from './ai-message.entity';
import { AiFeedback } from './ai-feedback.entity';
import { AiLearnedExample } from './ai-learned-example.entity';
import { AiLearningService } from './ai-learning.service';
import { AiKnowledgeService } from './ai-knowledge.service';
import { AiAnalyticsService } from './ai-analytics.service';
import { AiProactiveService } from './ai-proactive.service';
import { ProductsModule } from '../products/products.module';
import { FinanceModule } from '../finance/finance.module';
import { SalesModule } from '../sales/sales.module';
import { CustomersModule } from '../customers/customers.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PlanningModule } from '../planning/planning.module';
import { TasksModule } from '../tasks/tasks.module';
import { UsersModule } from '../users/users.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([AiMessage, AiFeedback, AiLearnedExample]),
        ProductsModule,
        FinanceModule,
        SalesModule,
        CustomersModule,
        InventoryModule,
        PlanningModule,
        TasksModule,
        UsersModule
    ],
    controllers: [AiController],
    providers: [AiService, AiLearningService, AiKnowledgeService, AiAnalyticsService, AiProactiveService],
    exports: [AiService, AiLearningService, AiKnowledgeService, AiAnalyticsService, AiProactiveService]
})
export class AiModule { }

