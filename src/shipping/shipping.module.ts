import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShippingController } from './shipping.controller';
import { GhtkService } from './carriers/ghtk.service';
import { LalamoveService } from './carriers/lalamove.service';
import { SystemConfig } from '../system/system-config.entity';
import { SalesDelivery } from '../sales/sales-delivery.entity';
import { SalesOrder } from '../sales/sales-order.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([SystemConfig, SalesDelivery, SalesOrder]),
    ],
    controllers: [ShippingController],
    providers: [GhtkService, LalamoveService],
    exports: [GhtkService, LalamoveService],
})
export class ShippingModule {}
