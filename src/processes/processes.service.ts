import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Process } from './process.entity';

@Injectable()
export class ProcessesService {
  constructor(@InjectRepository(Process) private repo: Repository<Process>) {}

  async findAll() { 
      return this.repo.find({ order: { id: 'ASC' } }); 
  }

  async create(data: any) { 
      const existing = await this.repo.findOne({ where: { code: data.code } });
      if (existing) throw new BadRequestException('Mã công đoạn đã tồn tại');
      return this.repo.save(data); 
  }

  async update(id: number, data: any) {
      const process = await this.repo.findOne({ where: { id } });
      if (!process) throw new NotFoundException('Công đoạn không tồn tại');
      await this.repo.update(id, data);
      return this.repo.findOne({ where: { id } });
  }

  async remove(id: number) {
      const process = await this.repo.findOne({ where: { id } });
      if (!process) throw new NotFoundException('Công đoạn không tồn tại');
      // TODO: Kiểm tra xem công đoạn đã được dùng trong Bảng giá hay Routing chưa trước khi xóa
      return this.repo.remove(process);
  }
  
  // Seed data mẫu (Giữ lại để khởi tạo lần đầu nếu cần)
  async seed() {
      const count = await this.repo.count();
      if(count === 0) {
          await this.repo.save([
              { code: 'P_CAT', name: 'Gia công Cắt', unit: 'Bàn', standard_cost: 50000 },
              { code: 'P_MAY', name: 'Gia công May', unit: 'Cái', standard_cost: 15000 },
              { code: 'P_UI', name: 'Gia công Ủi/Đóng gói', unit: 'Cái', standard_cost: 2000 },
          ]);
      }
      return { message: 'Seeded' };
  }
}