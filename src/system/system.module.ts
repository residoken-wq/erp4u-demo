import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemController } from './system.controller';
import { SystemService } from './system.service';
import { SystemConfig } from './system-config.entity';
import { ApiToken } from './entities/api-token.entity';
import { ActivityLog } from './entities/activity-log.entity';
import { ContractTemplate } from './contract-template.entity';
import { EmailTemplate } from './email-template.entity';
import { EmailService } from '../common/services/email.service';

import { ActivitySubscriber } from './subscribers/activity.subscriber';
import { UserContextService } from '../common/services/user-context.service';
import { AuthModule } from '../auth/auth.module';

import { DashboardController } from './dashboard.controller';
import { SalesOrder } from '../sales/sales-order.entity';
import { InventoryStock } from '../inventory/inventory-stock.entity';
import { GoodsReceipt } from '../inventory/entities/goods-receipt.entity';
import { PurchaseOrder } from '../purchasing/entities/purchase-order.entity';
import { ProductionFulfillmentOrder } from '../planning/pfo.entity';
import { Customer } from '../customers/customer.entity';
import { Product } from '../products/product.entity';
import { Material } from '../materials/material.entity';
import { AgentApiController } from './agent-api.controller';
import { AgentApiService } from './agent-api.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            SystemConfig,
            ApiToken,
            ActivityLog,
            ContractTemplate,
            EmailTemplate,
            SalesOrder,
            InventoryStock,
            GoodsReceipt,
            PurchaseOrder,
            ProductionFulfillmentOrder,
            Customer,
            Product,
            Material
        ]),
        AuthModule
    ],
    controllers: [SystemController, DashboardController, AgentApiController],
    providers: [SystemService, ActivitySubscriber, UserContextService, EmailService, AgentApiService],
    exports: [SystemService, UserContextService, AgentApiService]
})
export class SystemModule { }
