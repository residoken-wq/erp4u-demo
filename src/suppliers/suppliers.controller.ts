import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';

@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly s: SuppliersService) { }

  // --- CRUD NHÀ CUNG CẤP ---

  @Post()
  async create(@Body() b: any) {
    return await this.s.create(b); // Dùng await
  }

  @Get()
  async findAll() {
    return await this.s.findAll(); // Dùng await
  }

  @Get(':id')
  async findOne(@Param('id') id: number) {
    return await this.s.findOne(id); // Dùng await
  }

  // --- MỚI: LẤY LỊCH SỬ GIAO DỊCH ---
  @Get(':id/transactions')
  async getTransactions(@Param('id') id: number) {
    return await this.s.getTransactions(id);
  }
  // ----------------------------------

  @Put(':id')
  async update(@Param('id') id: number, @Body() b: any) {
    return await this.s.update(id, b); // Dùng await
  }

  @Delete(':id')
  async remove(@Param('id') id: number) {
    return await this.s.remove(id); // Dùng await
  }

  // --- QUẢN LÝ BẢNG GIÁ NPL ---

  @Post(':id/material-price')
  async addPrice(@Param('id') id: number, @Body() b: any) {
    return await this.s.addMaterialPrice(id, b); // Dùng await
  }

  @Delete('material-price/:id')
  async removePrice(@Param('id') id: number) {
    return await this.s.deleteMaterialPrice(id); // Dùng await
  }

  // --- QUẢN LÝ BẢNG GIÁ CHUNG (ManufacturersPage.tsx) ---
  @Post('price')
  async addSupplierPrice(@Body() b: any) {
    return await this.s.addSupplierPrice(b); // Dùng await
  }

  @Post('check-price')
  async checkPrice(@Body() b: any) {
    return await this.s.checkPrice(b.supplierId, b.processId); // Dùng await
  }
}