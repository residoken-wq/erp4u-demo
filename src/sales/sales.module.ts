import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectsModule } from '../projects/projects.module';
import { SalesOrder } from './sales-order.entity';
import { SalesOrderItem } from './sales-order-item.entity';
import { ProductSample } from './product-sample.entity';
import { SalesDelivery } from './sales-delivery.entity';
import { SalesDeliveryItem } from './sales-delivery-item.entity';
import { SalesComment } from './sales-comment.entity';
import { SalesChecklist } from './sales-checklist.entity';
import { SalesChecklistItem } from './sales-checklist-item.entity';
import { Transaction } from '../finance/transaction.entity';


// Price List Entities
import { PriceList } from './pricelist/price-list.entity';
import { PriceListRule } from './pricelist/price-list-rule.entity';

// User Entity
import { User } from '../users/entities/user.entity';

import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { ProductsModule } from '../products/products.module';
import { InventoryModule } from '../inventory/inventory.module';
import { CustomersModule } from '../customers/customers.module';
import { FinanceModule } from '../finance/finance.module';
import { SystemModule } from '../system/system.module';
import { SalesOrderVersion } from './sales-order-version.entity';
import { SalesTarget } from './sales-target.entity';
import { Promotion } from './promotion.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { Customer } from '../customers/customer.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SalesOrder,
      SalesOrderVersion,
      SalesOrderItem,
      ProductSample,
      SalesDelivery,
      SalesDeliveryItem,
      SalesComment,
      SalesChecklist,
      SalesChecklistItem,
      Transaction,
      PriceList,
      PriceListRule,
      User,
      SalesTarget,
      Customer,
      Promotion
    ]),
    ProductsModule,
    InventoryModule,
    CustomersModule,
    SystemModule,
    NotificationsModule,
    ProjectsModule,
    forwardRef(() => FinanceModule),
    AuthModule
  ],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule { }