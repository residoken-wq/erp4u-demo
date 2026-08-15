import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PurchasingService } from './purchasing.service';
import { PurchasingController } from './purchasing.controller';

// Entities
import { PurchaseOrder } from './entities/purchase-order.entity';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity';
import { GoodsReceipt } from '../inventory/entities/goods-receipt.entity';
import { ProductionFulfillmentOrder } from '../planning/pfo.entity';

// External Modules (Service cần gọi đến)
import { InventoryModule } from '../inventory/inventory.module';
import { ProductsModule } from '../products/products.module';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { PlanningModule } from '../planning/planning.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PurchaseOrder,
      PurchaseOrderItem,
      GoodsReceipt, // <--- Đảm bảo đã đăng ký
      ProductionFulfillmentOrder
    ]),
    forwardRef(() => InventoryModule),
    ProductsModule,

    SuppliersModule,
    PlanningModule
  ],
  controllers: [PurchasingController],
  providers: [PurchasingService],
  exports: [PurchasingService]
})
export class PurchasingModule { }