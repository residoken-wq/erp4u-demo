import { Injectable, Logger } from '@nestjs/common';
import { SalesService } from '../sales/sales.service';
import { FinanceService } from '../finance/finance.service';
import { InventoryService } from '../inventory/inventory.service';

@Injectable()
export class AiProactiveService {
    private readonly logger = new Logger(AiProactiveService.name);

    constructor(
        private salesService: SalesService,
        private financeService: FinanceService,
        private inventoryService: InventoryService
    ) {}

    async generateDailyInsights() {
        this.logger.log('Generating proactive AI insights...');
        const insights = [];

        // 1. Unpaid orders this month
        const thisMonth = new Date().getMonth() + 1;
        const unpaidOrders = await this.salesService.findOrdersByFilters({ month: thisMonth, paymentStatus: 'UNPAID' });
        if (unpaidOrders && unpaidOrders.length > 0) {
            insights.push({
                type: 'WARNING',
                title: 'Đơn hàng chưa thanh toán',
                message: `Có ${unpaidOrders.length} đơn hàng trong tháng này chưa được thanh toán.`,
                actionUrl: '/sales/orders?payment_status=UNPAID'
            });
        }

        // 2. Low stock check
        // Assuming inventoryService has a method to check low stock, if not we will just skip or mock
        // const lowStock = await this.inventoryService.getLowStockItems();
        // if (lowStock.length > 0) ...
        
        return insights;
    }
}
