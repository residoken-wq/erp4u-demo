import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockHistory } from './stock-history.entity';
import { InventoryStock } from './inventory-stock.entity';
import { GoodsReceipt } from './entities/goods-receipt.entity'; // <--- Import
import { GoodsReceiptItem } from './entities/goods-receipt-item.entity'; // <--- Import
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { Product } from '../products/product.entity';
import { Material } from '../materials/material.entity';
import { Supplier } from '../suppliers/supplier.entity';
import { PurchaseOrder } from '../purchasing/entities/purchase-order.entity';
import { PurchaseOrderItem } from '../purchasing/entities/purchase-order-item.entity';
import { SalesDelivery } from '../sales/sales-delivery.entity'; // <--- Import SalesDelivery
import { ShippingCarrier } from './entities/shipping-carrier.entity'; // <--- Import ShippingCarrier
import { ProductsModule } from '../products/products.module'; // <--- Import ProductsModule for Combos
import { SampleTransaction } from './samples/sample-transaction.entity';
import { SampleTransactionItem } from './samples/sample-transaction-item.entity';
import { InventorySamplesService } from './samples/inventory-samples.service';
import { InventorySamplesController } from './samples/inventory-samples.controller';
import { GoodsIssue } from './entities/goods-issue.entity';
import { GoodsIssueItem } from './entities/goods-issue-item.entity';
import { SupplierStock } from './entities/supplier-stock.entity';
import { SupplierTransaction } from './entities/supplier-transaction.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    // Đăng ký đủ 4 Entity mà Service cần dùng
    TypeOrmModule.forFeature([
      StockHistory,
      InventoryStock,
      Product,
      Material,
      GoodsReceipt, // <--- New
      GoodsReceiptItem, // <--- New
      Supplier,
      PurchaseOrder,
      PurchaseOrderItem,
      SalesDelivery, // <--- Register SalesDelivery
      ShippingCarrier, // <--- Register ShippingCarrier
      SampleTransaction,
      SampleTransactionItem,
      GoodsIssue,          // <--- MỚI: Phiếu xuất kho
      GoodsIssueItem,      // <--- MỚI: Chi tiết xuất kho
      SupplierStock,
      SupplierTransaction
    ]),
    ProductsModule, // <--- Register ProductsModule
    AuthModule,
    forwardRef(() => import('../finance/finance.module').then(m => m.FinanceModule)),
    forwardRef(() => import('../planning/planning.module').then(m => m.PlanningModule))
  ],
  controllers: [InventoryController, InventorySamplesController],
  providers: [InventoryService, InventorySamplesService],
  exports: [InventoryService, InventorySamplesService],
})
export class InventoryModule { }