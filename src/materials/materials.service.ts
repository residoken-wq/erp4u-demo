import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Material } from './material.entity';

@Injectable()
export class MaterialsService {
  constructor(
    @InjectRepository(Material)
    public materialRepo: Repository<Material>,
  ) {}

  async findAll(): Promise<Material[]> {
    return this.materialRepo.find({ order: { id: 'DESC' } });
  }

  async findOneByCode(code: string) {
    return this.materialRepo.findOne({ where: { code } });
  }

  // --- CRUD ---
  async create(data: Partial<Material>) {
    return this.materialRepo.save(data);
  }

  async update(id: number, data: Partial<Material>) {
    await this.materialRepo.update(id, data);
    return this.materialRepo.findOne({ where: { id } });
  }

  async remove(id: number) {
    return this.materialRepo.delete(id);
  }

  // --- HAM BI THIEU (DA THEM LAI) ---
  async updatePriceAndStock(id: number, newPrice: number) {
     // Cap nhat gia von binh quan sau khi nhap hang
     return this.materialRepo.update(id, { cost_per_unit: newPrice });
  }
  // ----------------------------------
}
