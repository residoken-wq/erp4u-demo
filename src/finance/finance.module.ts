import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './transaction.entity';
import { TransactionCategory } from './transaction-category.entity';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';
import { CashFlowService } from './cash-flow.service';
import { CashFlowController } from './cash-flow.controller';
import { SalesModule } from '../sales/sales.module';
import { SalesOrder } from '../sales/sales-order.entity';
import { PurchasingModule } from '../purchasing/purchasing.module';
import { PurchaseOrder } from '../purchasing/entities/purchase-order.entity';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { SystemModule } from '../system/system.module';
import { AuthModule } from '../auth/auth.module';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, TransactionCategory, SalesOrder, PurchaseOrder]),
    forwardRef(() => SalesModule),
    forwardRef(() => PurchasingModule),
    forwardRef(() => SuppliersModule),
    forwardRef(() => SystemModule), // For CashFlowService to access config
    forwardRef(() => ProductsModule),
    AuthModule,
  ],
  controllers: [FinanceController, CashFlowController],
  providers: [FinanceService, CashFlowService],
  exports: [FinanceService, CashFlowService],
})
export class FinanceModule { }