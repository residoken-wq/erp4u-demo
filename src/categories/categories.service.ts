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
      const oldSize = category.size;
      const newSize = data.size;

      await this.repo.update(id, data);
      
      // Nếu Margin thay đổi -> Cập nhật giá bán của tất cả sản phẩm trong danh mục
      if (oldMargin !== newMargin) {
          await this.productsService.updatePricesByCategory(id, newMargin);
      }

      // Nếu Kích thước thay đổi -> KHÔNG cập nhật tự động nữa, người dùng sẽ tự bấm nút đồng bộ
      // if (newSize !== undefined && oldSize !== newSize) {
      //     await this.productsService.updateSizesByCategory(id, newSize);
      // }

      return this.findOne(id);
  }

  async syncSize(id: number) {
      const category = await this.findOne(id);
      if (!category) throw new NotFoundException('Danh mục không tồn tại');
      if (!category.size) throw new BadRequestException('Danh mục này chưa được cấu hình kích thước');
      
      const updatedCount = await this.productsService.updateSizesByCategory(id, category.size);
      return { message: `Đã đồng bộ kích thước cho ${updatedCount} sản phẩm trống` };
  }

  async remove(id: number) { return this.repo.delete(id); }
}