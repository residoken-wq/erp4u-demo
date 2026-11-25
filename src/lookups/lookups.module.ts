import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LookupsController } from './lookups.controller';
import { LookupsService } from './lookups.service';
import { User } from '../users/entities/user.entity';
import { Product } from '../products/product.entity';
import { Customer } from '../customers/customer.entity';
import { Supplier } from '../suppliers/supplier.entity';
import { Employee } from '../hr/entities/employee.entity';
import { Category } from '../categories/category.entity';
import { Material } from '../materials/material.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Product,
      Customer,
      Supplier,
      Employee,
      Category,
      Material,
    ]),
  ],
  controllers: [LookupsController],
  providers: [LookupsService],
  exports: [LookupsService],
})
export class LookupsModule {}
