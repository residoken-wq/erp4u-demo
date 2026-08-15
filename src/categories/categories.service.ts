import { Injectable, BadRequestException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './category.entity';
import { ProductsService } from '../products/products.service';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category) private repo: Repository<Category>,
    @Inject(forwardRef(() => ProductsService)) private productsService: ProductsService,
  ) {}

  async findAll() { return this.repo.find({ order: { id: 'ASC' } }); }
  async findOne(id: number) { return this.repo.findOne({ where: { id } }); }

  async create(data: any) {
      const existing = await this.repo.findOne({ where: { code: data.code } });
      if (existing) throw new BadRequestException('Mã danh mục đã tồn tại');
      return this.repo.save(data);
  }

  async update(id: number, data: any) {
      const category = await this.findOne(id);
      if (!category) throw new NotFoundException('Danh mục không tồn tại');
      
      const oldMargin = Number(category.profit_margin);
      const newMargin = Number(data.profit_margin);

      await this.repo.update(id, data);
      
      // Nếu Margin thay đổi -> Cập nhật giá bán của tất cả sản phẩm trong danh mục
      if (oldMargin !== newMargin) {
          await this.productsService.updatePricesByCategory(id, newMargin);
      }

      return this.findOne(id);
  }

  async remove(id: number) { return this.repo.delete(id); }
}