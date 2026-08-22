import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { MaterialsModule } from '../materials/materials.module';
import { ProductsModule } from '../products/products.module';
import { SalesModule } from '../sales/sales.module';
// Entities
import { Product } from '../products/product.entity';
import { ProductWebsiteConfig } from '../products/entities/product-website-config.entity';
import { BOM } from '../bom/bom.entity';
import { ProductComponent } from '../products/product-component.entity';
import { Customer } from '../customers/customer.entity';
import { Supplier } from '../suppliers/supplier.entity';
import { BlogPost } from '../blogs/blog-post.entity';
import { WebProject } from '../website-projects/entities/web-project.entity';
import { SystemConfig } from '../system/system-config.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product, ProductWebsiteConfig, BOM, ProductComponent,
      Customer, Supplier, BlogPost, WebProject, SystemConfig
    ]),
    MaterialsModule,
    ProductsModule,
    SalesModule
  ],
  controllers: [UploadController],
  providers: [UploadService],
})
export class UploadModule { }
