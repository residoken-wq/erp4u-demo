import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { MaterialsModule } from '../materials/materials.module';
import { ProductsModule } from '../products/products.module';
import { SalesModule } from '../sales/sales.module';
import { AuthModule } from '../auth/auth.module';
// Entities
import { Product } from '../products/product.entity';
import { BOM } from '../bom/bom.entity';
import { ProductComponent } from '../products/product-component.entity';
import { Customer } from '../customers/customer.entity';
import { Supplier } from '../suppliers/supplier.entity';
import { SystemConfig } from '../system/system-config.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product, BOM, ProductComponent,
      Customer, Supplier, SystemConfig
    ]),
    MaterialsModule,
    ProductsModule,
    SalesModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [UploadController],
  providers: [UploadService],
})
export class UploadModule { }
