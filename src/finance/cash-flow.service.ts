import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan, MoreThan, Not, In } from 'typeorm';
import { Transaction } from './transaction.entity';
import { SalesOrder, PaymentStatus, SalesOrderStatus } from '../sales/sales-order.entity';
import { PurchaseOrder, POStatus } from '../purchasing/entities/purchase-order.entity';
import { SystemService } from '../system/system.service';

export interface CashFlowSummary {
    currentBalance: number;
    todayIncome: number;
    todayExpense: number;
    forecast7Days: number;
    receivablesTotal: number;
    payablesTotal: number;
}

export interface CashFlowChartPoint {
    date: string;
    income: number;
    expense: number;
    balance: number;
}

export interface Receivable {
    customer_id: number;
    customer_name: string;
    total_amount: number;
    paid_amount: number;
    remaining: number;
    overdue_count: number;
    orders: { order_code: string; amount: number; remaining: number; delivery_date: Date }[];
}

export interface Payable {
    supplier_id: number;
    supplier_name: string;
    total_amount: number;
    paid_amount: number;
    remaining: number;
    upcoming_count: number; // POs due within 7 days
    orders: { po_code: string; amount: number; remaining: number }[];
}

export interface CashFlowAlert {
    id: string;
    type: 'LOW_BALANCE' | 'OVERDUE_RECEIVABLE' | 'UPCOMING_PAYABLE' | 'NEGATIVE_FORECAST';
    severity: 'warning' | 'error' | 'info';
    title: string;
    description: string;
    link?: string;
}

@Injectable()
export class CashFlowService {
    constructor(
        @InjectRepository(Transaction) private transRepo: Repository<Transaction>,
        @InjectRepository(SalesOrder) private salesRepo: Repository<SalesOrder>,
        @InjectRepository(PurchaseOrder) private poRepo: Repository<PurchaseOrder>,
        @Inject(forwardRef(() => SystemService)) private systemService: SystemService,
    ) { }

    // --- Lấy ngưỡng cảnh báo từ Settings ---
    private async getThreshold(): Promise<number> {
        try {
            const value = await this.systemService.getValue('CASH_FLOW_THRESHOLD');
            return value ? Number(value) : 50000000; // Default 50M
        } catch (e) {
            return 50000000;
        }
    }

    // --- SUMMARY: Quick Stats ---
    async getCashFlowSummary(): Promise<CashFlowSummary> {
        const today = new Date().toISOString().split('T')[0];

        // 1. Tổng Thu/Chi tất cả thời gian
        const totalRaw = await this.transRepo.createQueryBuilder('t')
            .select("SUM(CASE WHEN t.type = 'INCOME' THEN t.amount ELSE 0 END)", 'totalIncome')
            .addSelect("SUM(CASE WHEN t.type = 'EXPENSE' THEN t.amount ELSE 0 END)", 'totalExpense')
            .getRawOne();
        const totalIncome = Number(totalRaw?.totalIncome || 0);
        const totalExpense = Number(totalRaw?.totalExpense || 0);
        const currentBalance = totalIncome - totalExpense;

        // 2. Thu/Chi hôm nay
        const todayRaw = await this.transRepo.createQueryBuilder('t')
            .select("SUM(CASE WHEN t.type = 'INCOME' THEN t.amount ELSE 0 END)", 'todayIncome')
            .addSelect("SUM(CASE WHEN t.type = 'EXPENSE' THEN t.amount ELSE 0 END)", 'todayExpense')
            .where('t.date = :today', { today })
            .getRawOne();
        const todayIncome = Number(todayRaw?.todayIncome || 0);
        const todayExpense = Number(todayRaw?.todayExpense || 0);

        // 3. Dự báo 7 ngày (SO sắp đến hạn - PO sắp đến hạn)
        const next7Days = new Date();
        next7Days.setDate(next7Days.getDate() + 7);
        const next7Str = next7Days.toISOString().split('T')[0];

        const expectedIncomeRaw = await this.salesRepo.createQueryBuilder('so')
            .select('SUM(so.total_amount - COALESCE(so.paid_amount, 0))', 'expectedIncome')
            .where('so.payment_status IN (:...statuses)', { statuses: [PaymentStatus.UNPAID, PaymentStatus.PARTIAL_PAID] })
            .andWhere('so.status NOT IN (:...cancelled)', { cancelled: [SalesOrderStatus.CANCELLED, SalesOrderStatus.QUOTATION] })
            .andWhere('so.delivery_date BETWEEN :start AND :end', { start: today, end: next7Str })
            .getRawOne();
        const expectedIncome = Number(expectedIncomeRaw?.expectedIncome || 0);

        const expectedExpenseRaw = await this.poRepo.createQueryBuilder('po')
            .select('SUM(po.total_amount - COALESCE(po.paid_amount, 0))', 'expectedExpense')
            .where('po.status IN (:...statuses)', { statuses: [POStatus.CONFIRMED, POStatus.ORDERED, POStatus.DELIVERED] })
            .getRawOne();
        const expectedExpense = Number(expectedExpenseRaw?.expectedExpense || 0);

        const forecast7Days = expectedIncome - expectedExpense;

        // 4. Tổng công nợ phải thu/trả
        const receivablesRaw = await this.salesRepo.createQueryBuilder('so')
            .select('SUM(so.total_amount - COALESCE(so.paid_amount, 0))', 'receivablesTotal')
            .where('so.payment_status IN (:...statuses)', { statuses: [PaymentStatus.UNPAID, PaymentStatus.PARTIAL_PAID] })
            .andWhere('so.status NOT IN (:...cancelled)', { cancelled: [SalesOrderStatus.CANCELLED, SalesOrderStatus.QUOTATION] })
            .getRawOne();
        const receivablesTotal = Number(receivablesRaw?.receivablesTotal || 0);

        const payablesRaw = await this.poRepo.createQueryBuilder('po')
            .select('SUM(po.total_amount - COALESCE(po.paid_amount, 0))', 'payablesTotal')
            .where('po.status NOT IN (:...cancelled)', { cancelled: [POStatus.CANCELLED, POStatus.DRAFT] })
            .getRawOne();
        const payablesTotal = Number(payablesRaw?.payablesTotal || 0);

        return {
            currentBalance,
            todayIncome,
            todayExpense,
            forecast7Days,
            receivablesTotal,
            payablesTotal
        };
    }

    // --- CHART: Dữ liệu 30 ngày gần nhất ---
    async getCashFlowChart(days: number = 30): Promise<CashFlowChartPoint[]> {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];

        const transactions = await this.transRepo.find({
            where: { date: Between(startStr, endStr) },
            order: { date: 'ASC' }
        });

        // Group by date
        const dataMap = new Map<string, { income: number; expense: number }>();

        // Initialize all dates
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            dataMap.set(d.toISOString().split('T')[0], { income: 0, expense: 0 });
        }

        // Aggregate transactions
        transactions.forEach(t => {
            const dateKey = t.date;
            const existing = dataMap.get(dateKey) || { income: 0, expense: 0 };
            if (t.type === 'INCOME') existing.income += Number(t.amount);
            else existing.expense += Number(t.amount);
            dataMap.set(dateKey, existing);
        });

        // Calculate running balance
        let runningBalance = 0;
        const result: CashFlowChartPoint[] = [];

        // Get initial balance (before start date)
        const beforeTransRaw = await this.transRepo.createQueryBuilder('t')
            .select("SUM(CASE WHEN t.type = 'INCOME' THEN t.amount ELSE -t.amount END)", 'balance')
            .where('t.date < :startDate', { startDate: startStr })
            .getRawOne();
        runningBalance = Number(beforeTransRaw?.balance || 0);

        // Build chart data
        dataMap.forEach((value, date) => {
            runningBalance += value.income - value.expense;
            result.push({
                date,
                income: value.income,
                expense: value.expense,
                balance: runningBalance
            });
        });

        return result;
    }

    // --- RECEIVABLES: Công nợ phải thu ---
    async getReceivables(): Promise<Receivable[]> {
        const today = new Date().toISOString().split('T')[0];

        const orders = await this.salesRepo.find({
            where: {
                payment_status: In([PaymentStatus.UNPAID, PaymentStatus.PARTIAL_PAID]),
                status: Not(In([SalesOrderStatus.CANCELLED, SalesOrderStatus.QUOTATION]))
            },
            relations: ['customer']
        });

        // Group by customer
        const customerMap = new Map<number, Receivable>();

        orders.forEach(o => {
            const custId = o.customer_id || 0;
            const custName = o.customer?.name || o.customer_name || 'Khách lẻ';
            const remaining = Number(o.total_amount) - Number(o.paid_amount);
            const isOverdue = o.delivery_date && new Date(o.delivery_date) < new Date(today);

            if (!customerMap.has(custId)) {
                customerMap.set(custId, {
                    customer_id: custId,
                    customer_name: custName,
                    total_amount: 0,
                    paid_amount: 0,
                    remaining: 0,
                    overdue_count: 0,
                    orders: []
                });
            }

            const cust = customerMap.get(custId)!;
            cust.total_amount += Number(o.total_amount);
            cust.paid_amount += Number(o.paid_amount);
            cust.remaining += remaining;
            if (isOverdue) cust.overdue_count++;
            cust.orders.push({
                order_code: o.order_code,
                amount: Number(o.total_amount),
                remaining,
                delivery_date: o.delivery_date
            });
        });

        return Array.from(customerMap.values()).sort((a, b) => b.remaining - a.remaining);
    }

    // --- PAYABLES: Công nợ phải trả ---
    async getPayables(): Promise<Payable[]> {
        const today = new Date();
        const next7Days = new Date();
        next7Days.setDate(next7Days.getDate() + 7);

        const pos = await this.poRepo.find({
            where: { status: Not(In([POStatus.CANCELLED, POStatus.DRAFT, POStatus.COMPLETED])) },
            relations: ['supplier']
        });

        // Group by supplier
        const supplierMap = new Map<number, Payable>();

        pos.forEach(p => {
            const suppId = p.supplier_id || 0;
            const suppName = p.supplier?.name || 'NCC không xác định';
            const remaining = Number(p.total_amount) - Number(p.paid_amount);

            if (remaining <= 0) return; // Skip fully paid

            if (!supplierMap.has(suppId)) {
                supplierMap.set(suppId, {
                    supplier_id: suppId,
                    supplier_name: suppName,
                    total_amount: 0,
                    paid_amount: 0,
                    remaining: 0,
                    upcoming_count: 0,
                    orders: []
                });
            }

            const supp = supplierMap.get(suppId)!;
            supp.total_amount += Number(p.total_amount);
            supp.paid_amount += Number(p.paid_amount);
            supp.remaining += remaining;
            // Check if created recently (within 7 days - as proxy for due date)
            if (p.created_at && new Date(p.created_at) >= new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)) {
                supp.upcoming_count++;
            }
            supp.orders.push({
                po_code: p.po_code,
                amount: Number(p.total_amount),
                remaining
            });
        });

        return Array.from(supplierMap.values()).sort((a, b) => b.remaining - a.remaining);
    }

    // --- ALERTS: Cảnh báo thông minh ---
    async getAlerts(): Promise<CashFlowAlert[]> {
        const alerts: CashFlowAlert[] = [];
        const threshold = await this.getThreshold();
        const summary = await this.getCashFlowSummary();
        const today = new Date().toISOString().split('T')[0];

        // 1. Quỹ dưới ngưỡng
        if (summary.currentBalance < threshold) {
            alerts.push({
                id: 'low-balance',
                type: 'LOW_BALANCE',
                severity: summary.currentBalance < threshold / 2 ? 'error' : 'warning',
                title: 'Quỹ tiền mặt thấp',
                description: `Số dư hiện tại: ${summary.currentBalance.toLocaleString()}đ (dưới ngưỡng ${threshold.toLocaleString()}đ)`,
                link: '/finance'
            });
        }

        // 2. Dự báo âm trong 7 ngày
        if (summary.currentBalance + summary.forecast7Days < 0) {
            alerts.push({
                id: 'negative-forecast',
                type: 'NEGATIVE_FORECAST',
                severity: 'error',
                title: 'Dự báo âm quỹ',
                description: `Quỹ có thể âm trong 7 ngày tới. Cần thu hồi công nợ khẩn cấp.`,
                link: '/finance'
            });
        }

        // 3. Công nợ khách hàng quá hạn
        const receivables = await this.getReceivables();
        const overdueCustomers = receivables.filter(r => r.overdue_count > 0);
        if (overdueCustomers.length > 0) {
            const totalOverdue = overdueCustomers.reduce((s, r) => s + r.remaining, 0);
            alerts.push({
                id: 'overdue-receivable',
                type: 'OVERDUE_RECEIVABLE',
                severity: 'warning',
                title: `${overdueCustomers.length} khách hàng nợ quá hạn`,
                description: `Tổng nợ quá hạn: ${totalOverdue.toLocaleString()}đ`,
                link: '/finance?tab=receivables'
            });
        }

        // 4. PO sắp đến hạn thanh toán (NCC có công nợ lớn)
        const payables = await this.getPayables();
        const urgentPayables = payables.filter(p => p.upcoming_count > 0 && p.remaining > 10000000);
        if (urgentPayables.length > 0) {
            alerts.push({
                id: 'upcoming-payable',
                type: 'UPCOMING_PAYABLE',
                severity: 'info',
                title: `${urgentPayables.length} NCC cần thanh toán`,
                description: `Có PO gần đây cần thanh toán để đảm bảo tiến độ.`,
                link: '/finance?tab=payables'
            });
        }

        return alerts;
    }
}
