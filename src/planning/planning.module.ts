import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlanningController } from './planning.controller';
import { PlanningService } from './planning.service';
import { GanttService } from './gantt.service';
import { PfoDemandService } from './pfo-demand.service';
import { PfoBomEngineService } from './pfo-bom-engine.service';
import { PfoSourcingService } from './pfo-sourcing.service';
import { PfoExecutionService } from './pfo-execution.service';
import { ProductionFulfillmentOrder } from './pfo.entity';
import { PfoMaterialRequirement } from './pfo-material-requirement.entity';
import { PfoMilestone } from './pfo-milestone.entity';
import { PfoQcRecord } from './pfo-qc-record.entity';
import { SalesOrder } from '../sales/sales-order.entity';
import { SalesOrderItem } from '../sales/sales-order-item.entity';
import { PurchaseOrder } from '../purchasing/entities/purchase-order.entity';
import { PurchaseOrderItem } from '../purchasing/entities/purchase-order-item.entity';
import { WorkOrder } from '../production/work-order.entity';
import { WorkOrderStep } from '../production/work-order-step.entity';
import { Product } from '../products/product.entity';
import { BOM } from '../bom/bom.entity';
import { ProductComponent } from '../products/product-component.entity';
import { ProductRouting } from '../products/product-routing.entity';
import { Material } from '../materials/material.entity';
import { ProductsModule } from '../products/products.module';
import { MaterialsModule } from '../materials/materials.module';
import { InventoryModule } from '../inventory/inventory.module';
import { SupplierStock } from '../inventory/entities/supplier-stock.entity';
import { GoodsIssue } from '../inventory/entities/goods-issue.entity';
import { GoodsIssueItem } from '../inventory/entities/goods-issue-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductionFulfillmentOrder, 
      PfoMaterialRequirement, 
      PfoMilestone, 
      PfoQcRecord, 
      SalesOrder, 
      SalesOrderItem, 
      PurchaseOrder, 
      PurchaseOrderItem, 
      WorkOrder, 
      WorkOrderStep, 
      SupplierStock,
      Product,
      BOM,
      ProductComponent,
      Material,
      ProductRouting,
      GoodsIssue,
      GoodsIssueItem
    ]),
    ProductsModule,
    MaterialsModule,
    forwardRef(() => InventoryModule)
  ],
  controllers: [PlanningController],
  providers: [
    PlanningService, 
    GanttService,
    PfoDemandService,
    PfoBomEngineService,
    PfoSourcingService,
    PfoExecutionService
  ],
  exports: [
    PlanningService,
    PfoDemandService,
    PfoBomEngineService,
    PfoSourcingService,
    PfoExecutionService
  ]
})
export class PlanningModule { }