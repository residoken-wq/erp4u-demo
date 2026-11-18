import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from './category.entity';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [
      TypeOrmModule.forFeature([Category]),
      forwardRef(() => ProductsModule) // Tránh vòng lặp dependency
  ],
  controllers: [CategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}