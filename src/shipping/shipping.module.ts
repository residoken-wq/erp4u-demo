import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShippingController } from './shipping.controller';
import { GhtkService } from './carriers/ghtk.service';
import { LalamoveService } from './carriers/lalamove.service';
import { SystemConfig } from '../system/system-config.entity';
import { SalesDelivery } from '../sales/sales-delivery.entity';
import { SalesOrder } from '../sales/sales-order.entity';
import { Transaction } from '../finance/transaction.entity';
import { FinanceModule } from '../finance/finance.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([SystemConfig, SalesDelivery, SalesOrder, Transaction]),
        forwardRef(() => FinanceModule),
    ],
    controllers: [ShippingController],
    providers: [GhtkService, LalamoveService],
    exports: [GhtkService, LalamoveService],
})
export class ShippingModule {}
