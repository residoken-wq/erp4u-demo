import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Supplier } from './supplier.entity';
import { SupplierContact } from './supplier-contact.entity';
import { SupplierMaterial } from './supplier-material.entity';
import { SuppliersService } from './suppliers.service';
import { SuppliersController } from './suppliers.controller';
import { ProductRouting } from '../products/product-routing.entity';
import { Material } from '../materials/material.entity';
import { Process } from '../processes/process.entity'; // <-- MỚI: Thêm Process
import { PurchaseOrder } from '../purchasing/entities/purchase-order.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
        Supplier, SupplierContact, SupplierMaterial, 
        ProductRouting, Material,
        Process, PurchaseOrder
    ])
  ],
  controllers: [SuppliersController],
  providers: [SuppliersService],
  exports: [SuppliersService],
})
export class SuppliersModule {}