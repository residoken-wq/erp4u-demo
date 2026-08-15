import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { SalesOrder, SalesOrderStatus } from '../sales/sales-order.entity';
import { InventoryStock } from '../inventory/inventory-stock.entity';
import { GoodsReceipt, GoodsReceiptStatus } from '../inventory/entities/goods-receipt.entity';
import { PurchaseOrder, POStatus } from '../purchasing/entities/purchase-order.entity';

@Controller('system/dashboard')
export class DashboardController {
    constructor(
        @InjectRepository(SalesOrder) private orderRepo: Repository<SalesOrder>,
        @InjectRepository(InventoryStock) private stockRepo: Repository<InventoryStock>,
        @InjectRepository(GoodsReceipt) private receiptRepo: Repository<GoodsReceipt>,
        @InjectRepository(PurchaseOrder) private poRepo: Repository<PurchaseOrder>,
    ) { }

    @Get('stats')
    async getStats() {
        // 1. Sales Stats
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        const ordersToday = await this.orderRepo.count({
            where: {
                order_date: Between(today, new Date(today.getTime() + 86400000))
            }
        });

        const revenueMonth = await this.orderRepo.createQueryBuilder('order')
            .select('SUM(order.total_amount)', 'total')
            .where('order.order_date >= :start', { start: startOfMonth })
            .andWhere('order.status != :cancelled', { cancelled: SalesOrderStatus.CANCELLED })
            .getRawOne();

        const packingOrders = await this.orderRepo.count({ where: { status: SalesOrderStatus.IN_PRODUCTION } });

        // 2. Inventory Stats
        const lowStockItems = await this.stockRepo.count({
            where: { quantity: 0 } // Simple logic for now, ideally quantity < min_stock
        });

        const pendingReceipts = await this.receiptRepo.count({
            where: { status: GoodsReceiptStatus.DRAFT }
        });

        // 3. Purchasing Stats
        const pendingPO = await this.poRepo.count({
            where: { status: POStatus.SENT } // Adjust status key if needed
        });

        return {
            sales: {
                ordersToday,
                revenueMonth: Number(revenueMonth?.total || 0),
                packingOrders
            },
            inventory: {
                lowStockItems,
                pendingReceipts
            },
            purchasing: {
                pendingPO
            }
        };
    }
}
