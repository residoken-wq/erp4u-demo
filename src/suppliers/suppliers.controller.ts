import { AnyPerm, AuthOnly } from '../auth/permissions.decorator';
import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';

@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly s: SuppliersService) { }

  // --- CRUD NHÀ CUNG CẤP ---

  @AnyPerm(['INVENTORY', 'create'], ['PURCHASE', 'create'])
  @Post()
  async create(@Body() b: any) {
    return await this.s.create(b); // Dùng await
  }

  @AuthOnly()
  @Get()
  async findAll() {
    return await this.s.findAll(); // Dùng await
  }

  @AnyPerm(['INVENTORY', 'view'], ['PURCHASE', 'view'])
  @Get(':id')
  async findOne(@Param('id') id: number) {
    return await this.s.findOne(id); // Dùng await
  }

  // --- MỚI: LẤY LỊCH SỬ GIAO DỊCH ---
  @AnyPerm(['INVENTORY', 'view'], ['PURCHASE', 'view'])
  @Get(':id/transactions')
  async getTransactions(@Param('id') id: number) {
    return await this.s.getTransactions(id);
  }
  // ----------------------------------

  @AnyPerm(['INVENTORY', 'update'], ['PURCHASE', 'update'])
  @Put(':id')
  async update(@Param('id') id: number, @Body() b: any) {
    return await this.s.update(id, b); // Dùng await
  }

  @AnyPerm(['INVENTORY', 'delete'], ['PURCHASE', 'delete'])
  @Delete(':id')
  async remove(@Param('id') id: number) {
    return await this.s.remove(id); // Dùng await
  }

  // --- QUẢN LÝ BẢNG GIÁ NPL ---

  @AnyPerm(['INVENTORY', 'create'], ['PURCHASE', 'create'])
  @Post(':id/material-price')
  async addPrice(@Param('id') id: number, @Body() b: any) {
    return await this.s.addMaterialPrice(id, b); // Dùng await
  }

  @AnyPerm(['INVENTORY', 'delete'], ['PURCHASE', 'delete'])
  @Delete('material-price/:id')
  async removePrice(@Param('id') id: number) {
    return await this.s.deleteMaterialPrice(id); // Dùng await
  }

  // --- QUẢN LÝ BẢNG GIÁ CHUNG (ManufacturersPage.tsx) ---
  @AnyPerm(['INVENTORY', 'create'], ['PURCHASE', 'create'])
  @Post('price')
  async addSupplierPrice(@Body() b: any) {
    return await this.s.addSupplierPrice(b); // Dùng await
  }

  @AnyPerm(['INVENTORY', 'view'], ['PURCHASE', 'view'])
  @Post('check-price')
  async checkPrice(@Body() b: any) {
    return await this.s.checkPrice(b.supplierId, b.processId); // Dùng await
  }
}