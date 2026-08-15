import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductionService } from './production.service';
import { ProductionController } from './production.controller';

// Entities
import { ProductionOrder } from './entities/production-order.entity';
import { WorkOrder } from './work-order.entity';
import { WorkOrderStep } from './work-order-step.entity';
import { OutsourcingAssignment } from './entities/outsourcing-assignment.entity';

// External Modules
import { InventoryModule } from '../inventory/inventory.module';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
        ProductionOrder,
        WorkOrder,
        WorkOrderStep,
        OutsourcingAssignment
    ]),
    InventoryModule,
    ProductsModule
  ],
  controllers: [ProductionController],
  providers: [ProductionService],
  exports: [ProductionService]
})
export class ProductionModule {}