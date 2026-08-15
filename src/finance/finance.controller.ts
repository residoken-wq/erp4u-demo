import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/permissions.decorator';

@Controller('finance')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FinanceController {
  constructor(private readonly s: FinanceService) { }

  @Get('summary') @RequirePermission('FINANCE', 'can_view') getSummary() { return this.s.getSummary(); }
  @Get('categories') @RequirePermission('FINANCE', 'can_view') getCategories() { return this.s.getCategories(); }
  @Post('categories') @RequirePermission('FINANCE', 'can_create') createCategory(@Body() b: any) { return this.s.createCategory(b); }
  @Put('categories/:id') @RequirePermission('FINANCE', 'can_update') updateCategory(@Param('id') id: number, @Body() b: any) { return this.s.updateCategory(id, b); }
  @Delete('categories/:id') @RequirePermission('FINANCE', 'can_delete') deleteCategory(@Param('id') id: number) { return this.s.deleteCategory(id); }

  @Get('transactions') @RequirePermission('FINANCE', 'can_view') getTransactions(@Query('month') month: string) { return this.s.getAllTransactions(month); }
  @Post('transactions') @RequirePermission('FINANCE', 'can_create') createTransaction(@Body() b: any) { return this.s.createTransaction(b); }
  @Put('transactions/:id') @RequirePermission('FINANCE', 'can_update') updateTransaction(@Param('id') id: number, @Body() b: any) { return this.s.updateTransaction(id, b); }
  @Delete('transactions/:id') @RequirePermission('FINANCE', 'can_delete') deleteTransaction(@Param('id') id: number) { return this.s.deleteTransaction(id); }

  // --- MỚI: BÁO CÁO TÀI CHÍNH ---
  @Get('report')
  getReport(@Query('month') month: string, @Query('year') year: string) {
    return this.s.getFinancialReport(month, year);
  }
  
  @Get('so-profit')
  @RequirePermission('FINANCE', 'can_view')
  getSOProfit(@Query('month') month: string) {
    return this.s.getSOProfitList(month);
  }
  // -----------------------------

  // --- MỚI: API LỊCH SỬ THANH TOÁN CỦA 1 ĐƠN HÀNG ---
  @Get('history/:refCode')
  getHistory(@Param('refCode') refCode: string) {
    return this.s.getTransactionsByRef(refCode);
  }
  // --------------------------------------------------

  @Post('payment') createPayment(@Body() b: any) { return this.s.createPayment(b); }

  @Post('payment/po')
  createPOPayment(@Body() b: any) {
    // b includes: amount, poCode, note, date, vatCode, vatUrl
    return this.s.createPOPayment(b);
  }

  @Post('payment/bulk-po')
  createBulkPOPayment(@Body() b: any) {
    return this.s.createBulkPoPayment(b);
  }

  // --- FIX DATA ENDPOINT ---
  @Post('payment/fix-mapping')
  fixMapping() {
    return this.s.mapOldTransactions();
  }
}