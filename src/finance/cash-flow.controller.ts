import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CashFlowService } from './cash-flow.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('finance/cash-flow')
@UseGuards(JwtAuthGuard)
export class CashFlowController {
    constructor(private readonly cashFlowService: CashFlowService) { }

    /**
     * GET /finance/cash-flow/summary
     * Lấy tổng quan dòng tiền: Quỹ hiện tại, Thu/Chi hôm nay, Dự báo 7 ngày
     */
    @Get('summary')
    async getSummary() {
        return this.cashFlowService.getCashFlowSummary();
    }

    /**
     * GET /finance/cash-flow/chart?days=30
     * Lấy dữ liệu biểu đồ dòng tiền theo ngày
     */
    @Get('chart')
    async getChart(@Query('days') days?: string) {
        const numDays = days ? parseInt(days, 10) : 30;
        return this.cashFlowService.getCashFlowChart(numDays);
    }

    /**
     * GET /finance/cash-flow/receivables
     * Lấy danh sách công nợ phải thu từ khách hàng
     */
    @Get('receivables')
    async getReceivables() {
        return this.cashFlowService.getReceivables();
    }

    /**
     * GET /finance/cash-flow/payables
     * Lấy danh sách công nợ phải trả cho NCC
     */
    @Get('payables')
    async getPayables() {
        return this.cashFlowService.getPayables();
    }

    /**
     * GET /finance/cash-flow/alerts
     * Lấy danh sách cảnh báo tài chính
     */
    @Get('alerts')
    async getAlerts() {
        return this.cashFlowService.getAlerts();
    }
}
