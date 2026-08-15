import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, Not } from 'typeorm';
import { Transaction } from './transaction.entity';
import { TransactionCategory } from './transaction-category.entity';
import { PurchasingService } from '../purchasing/purchasing.service';
import { SuppliersService } from '../suppliers/suppliers.service';
import { SalesOrder, SalesOrderStatus, PaymentStatus } from '../sales/sales-order.entity';
import { ProductsService } from '../products/products.service';

@Injectable()
export class FinanceService {
    constructor(
        @InjectRepository(Transaction) private transRepo: Repository<Transaction>,
        @InjectRepository(TransactionCategory) private catRepo: Repository<TransactionCategory>,
        @InjectRepository(SalesOrder) private orderRepo: Repository<SalesOrder>,
        @Inject(forwardRef(() => PurchasingService)) private purchasingService: PurchasingService,
        @Inject(forwardRef(() => SuppliersService)) private suppliersService: SuppliersService,
        @Inject(forwardRef(() => ProductsService)) private productsService: ProductsService,
    ) { }

    // ... (Giữ nguyên các hàm Category) ...
    async getCategories() { return this.catRepo.find({ order: { type: 'ASC', name: 'ASC' } }); }
    async createCategory(data: any) { return this.catRepo.save(this.catRepo.create(data)); }
    async updateCategory(id: number, data: any) { await this.catRepo.update(id, data); return this.catRepo.findOne({ where: { id } }); }
    async deleteCategory(id: number) { return this.catRepo.delete(id); }

    async getAllTransactions(month?: string) {
        let where = {};
        if (month) {
            const [y, m] = month.split('-');
            const start = new Date(Number(y), Number(m) - 1, 1);
            const end = new Date(Number(y), Number(m), 0);
            where = { date: Between(start.toISOString().split('T')[0], end.toISOString().split('T')[0]) };
        }
        return this.transRepo.find({ where, relations: ['category'], order: { date: 'DESC', id: 'DESC' } });
    }

    // --- MỚI: LẤY LỊCH SỬ GIAO DỊCH THEO MÃ THAM CHIẾU (PO/SO) ---
    async getTransactionsByRef(refCode: string) {
        return this.transRepo.find({
            where: { reference_code: refCode },
            order: { date: 'DESC', created_at: 'DESC' }
        });
    }
    // -------------------------------------------------------------

    async createTransaction(data: any) {
        // Ensure supplier_id is passed if available
        const trans = this.transRepo.create(data);
        return this.transRepo.save(trans);
    }

    // Payment Sales (Thu tiền)
    async createPayment(data: any) {
        const trans = this.transRepo.create({
            date: data.date ? new Date(data.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            type: data.type || 'INCOME',
            amount: Number(data.amount),
            reference_code: data.refCode,
            reference_type: 'SALES',
            description: data.note,
            partner_name: data.customerName || data.partnerName, // Support both keys
            attachments: data.attachments || [], // <--- Save Attachments
            allocations: data.allocations || null, // Lưu JSON phân bổ
        });
        const savedTrans = await this.transRepo.save(trans);
        
        // Sync SO Payment Status
        if (data.refCode) {
            await this.syncSOPaymentStatus(data.refCode);
        }

        return savedTrans;
    }

    // --- CẬP NHẬT: THANH TOÁN PO (CHI TIỀN) ---
    async createPOPayment(data: any) {
        // Hỗ trợ truyền mảng poCode hoặc string
        const poCodes = Array.isArray(data.poCode) ? data.poCode : [data.poCode].filter(Boolean);
        
        let supplierId = data.supplier_id || null;
        let partnerName = data.partnerName || null;
        if (poCodes.length > 0) {
            const po = await this.purchasingService.getPOByCode(String(poCodes[0]));
            if (po) {
                if (!supplierId) supplierId = po.supplier_id;
                if (!partnerName && po.supplier) partnerName = po.supplier.name;
            }
        }

        const isSingle = poCodes.length === 1;
        const refCode = isSingle ? String(poCodes[0]) : (data.reference_code || `BULK-PO-${Date.now()}`);
        const allocations = data.allocations || (isSingle ? [{ poCode: String(poCodes[0]), amount: Number(data.amount) }] : null);

        return this.createBulkPoPayment({
            supplier_id: supplierId,
            po_ids: poCodes,
            reference_code: refCode,
            amount: data.amount,
            note: data.note,
            date: data.date,
            vatCode: data.vatCode,
            vatUrl: data.vatUrl,
            attachments: data.attachments || [],
            partnerName: partnerName,
            allocations: allocations,
        });
    }

    async createBulkPoPayment(data: any) {
        // data: { po_ids: any[], reference_code?: string, amount: number, note: string, date: Date, vatCode, vatUrl, attachments?: string[], partnerName, supplier_id, allocations: any[] }

        // 1. Create Transaction
        const trans = this.transRepo.create({
            date: data.date ? new Date(data.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            type: 'EXPENSE',
            amount: Number(data.amount),
            reference_code: data.reference_code || `BULK-PO-${Date.now()}`,
            reference_type: 'PURCHASE',
            description: data.note || `Thanh toán công nợ NCC`,
            partner_name: data.partnerName,
            supplier_id: data.supplier_id,
            vat_invoice_code: data.vatCode,
            vat_invoice_url: data.vatUrl,
            attachments: data.attachments || null,
            allocations: data.allocations || null,
        });
        const savedTrans = await this.transRepo.save(trans);

        // 2. Cập nhật paid_amount cho từng PO
        if (data.allocations && Array.isArray(data.allocations)) {
            for (const alloc of data.allocations) {
                // alloc có thể chứa po_id hoặc po_code
                if (alloc.po_id) {
                    await this.purchasingService.updatePaymentById(alloc.po_id, Number(alloc.amount));
                } else if (alloc.poCode) {
                    await this.purchasingService.updatePayment(alloc.poCode, Number(alloc.amount));
                }
            }
        } else if (data.po_ids && Array.isArray(data.po_ids) && data.po_ids.length === 1) {
            const singleRef = data.po_ids[0];
            if (typeof singleRef === 'number' || /^\d+$/.test(singleRef)) {
                await this.purchasingService.updatePaymentById(Number(singleRef), Number(data.amount));
            } else {
                await this.purchasingService.updatePayment(String(singleRef), Number(data.amount));
            }
        }

        return savedTrans;
    }
    // ------------------------------------------

    async deleteTransaction(id: number) { 
        const trans = await this.transRepo.findOne({ where: { id } });
        if (trans) {
            // Rollback PO paid_amount
            if (trans.type === 'EXPENSE' && trans.allocations && Array.isArray(trans.allocations)) {
                for (const alloc of trans.allocations) {
                    if (alloc.po_id) {
                        await this.purchasingService.updatePaymentById(alloc.po_id, -Number(alloc.amount));
                    } else if (alloc.poCode) {
                        await this.purchasingService.updatePayment(alloc.poCode, -Number(alloc.amount));
                    }
                }
            }
            
            // Delete
            await this.transRepo.delete(id);

            // Rollback SO payment_status nếu là Thu của SO
            if (trans.type === 'INCOME' && trans.reference_code) {
                await this.syncSOPaymentStatus(trans.reference_code);
            }
        }
        return { deleted: true };
    }

    // --- Helper Đồng bộ Payment Status cho SO ---
    async syncSOPaymentStatus(orderCode: string) {
        const order = await this.orderRepo.findOne({ where: { order_code: orderCode } });
        if (!order) return;

        const payments = await this.transRepo.find({ 
            where: { reference_code: orderCode, type: 'INCOME' }
        });
        const paid_amount = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        
        let payment_status = PaymentStatus.UNPAID;
        if (paid_amount >= Number(order.total_amount) && Number(order.total_amount) > 0) {
            payment_status = PaymentStatus.PAID;
        } else if (paid_amount > 0) {
            payment_status = PaymentStatus.PARTIAL_PAID;
        }

        if (order.payment_status !== payment_status) {
            order.payment_status = payment_status;
            await this.orderRepo.save(order);
        }
    }

    async updateTransaction(id: number, data: any) {
        await this.transRepo.update(id, data);
        return this.transRepo.findOne({ where: { id } });
    }

    async getFinancialReport(month?: string, year?: string) {
        let where: any = { is_accounting: true };

        if (month) {
            const [y, m] = month.split('-');
            const start = new Date(Number(y), Number(m) - 1, 1);
            const end = new Date(Number(y), Number(m), 0);
            where.date = Between(start.toISOString().split('T')[0], end.toISOString().split('T')[0]);
        } else if (year) {
            const start = new Date(Number(year), 0, 1);
            const end = new Date(Number(year), 11, 31);
            where.date = Between(start.toISOString().split('T')[0], end.toISOString().split('T')[0]);
        }

        const transactions = await this.transRepo.find({ where, order: { date: 'ASC' } });

        const income = transactions.filter(t => t.type === 'INCOME').reduce((s, t) => s + Number(t.amount), 0);
        const expense = transactions.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + Number(t.amount), 0);

        return {
            transactions,
            summary: { income, expense, profit: income - expense }
        };
    }

    async getSummary() {
        const all = await this.transRepo.find();
        const income = all.filter(t => t.type === 'INCOME').reduce((s, t) => s + Number(t.amount), 0);
        const expense = all.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + Number(t.amount), 0);
        return { income, expense, balance: income - expense };
    }

    // --- PHÂN TÍCH LỢI NHUẬN SO (NÂNG CẤP: trả thêm chi tiết transactions) ---
    async getSOProfitList(month?: string) {
        let whereCondition: any = { status: Not(In([SalesOrderStatus.QUOTATION, SalesOrderStatus.CANCELLED])) };
        if (month) {
            const [y, m] = month.split('-');
            const start = new Date(Number(y), Number(m) - 1, 1);
            const end = new Date(Number(y), Number(m), 0);
            whereCondition.order_date = Between(start.toISOString().split('T')[0], end.toISOString().split('T')[0]);
        }

        // Lấy danh sách SO (bỏ QUOTATION, CANCELLED) - load relation customer để fallback tên
        const sos = await this.orderRepo.find({
            where: whereCondition,
            relations: ['customer', 'items', 'items.product'],
            order: { order_date: 'DESC' }
        });

        // Lấy tất cả transaction kèm category
        const transactions = await this.transRepo.find({ relations: ['category'] });

        // Lấy Cost Breakdowns cho tất cả productIds
        const productIds = new Set<number>();
        sos.forEach(so => {
            so.items?.forEach((item: any) => {
                if (item.product?.id) productIds.add(item.product.id);
            });
        });
        const costBreakdowns = await this.productsService.getCostBreakdowns(Array.from(productIds));

        const results = sos.map(so => {
            let totalIncome = 0;
            let totalExpense = 0;
            const relatedTransactions: any[] = [];

            for (const t of transactions) {
                // Tính thu/chi cho SO này
                let allocatedAmount = 0;

                // 1. Kiểm tra allocations
                if (t.allocations && Array.isArray(t.allocations)) {
                    const alloc = t.allocations.find((a: any) => a.refCode === so.order_code);
                    if (alloc) {
                        allocatedAmount = Number(alloc.amount);
                    }
                } 
                // 2. Kiểm tra reference_code nếu chứa mã SO
                else if (t.reference_code && t.reference_code.includes(so.order_code)) {
                    const refs = t.reference_code.split(',').map(r => r.trim());
                    if (refs.includes(so.order_code)) {
                        allocatedAmount = Number(t.amount) / refs.length;
                    }
                }

                if (allocatedAmount > 0) {
                    if (t.type === 'INCOME') totalIncome += allocatedAmount;
                    if (t.type === 'EXPENSE') totalExpense += allocatedAmount;

                    // Phân loại expense group
                    const catName = (t.category?.name || '').toLowerCase();
                    let expenseGroup = 'OTHER';
                    if (catName.includes('npl') || catName.includes('nguyên') || catName.includes('vật liệu')) expenseGroup = 'NPL';
                    else if (catName.includes('gia công')) expenseGroup = 'ROUTING';
                    else if (catName.includes('vận chuyển') || catName.includes('logistic')) expenseGroup = 'LOGISTIC';

                    // Collect chi tiết transaction
                    relatedTransactions.push({
                        id: t.id,
                        date: t.date,
                        type: t.type,
                        amount: Number(t.amount),
                        allocated_amount: allocatedAmount,
                        description: t.description || '',
                        partner_name: t.partner_name || '',
                        reference_code: t.reference_code || '',
                        category_name: t.category?.name || '',
                        category_color: t.category?.color || '',
                        vat_invoice_code: t.vat_invoice_code || '',
                        vat_invoice_url: t.vat_invoice_url || '',
                        is_accounting: t.is_accounting || false,
                        accounting_note: t.accounting_note || '',
                        created_at: t.created_at,
                        expense_group: expenseGroup, // NPL, ROUTING, LOGISTIC, OTHER
                    });
                }
            }

            // Tính chi phí dự kiến từ BOM, Routing, Logistics và hàng có sẵn
            let expected_bom_cost = 0; // NPL
            let expected_routing_cost = 0; // Gia công
            let expected_logistic_cost = 0; // Vận chuyển
            let expected_stock_cost = 0; // Hàng có sẵn

            if (so.items && so.items.length > 0) {
                so.items.forEach((item: any) => {
                    const productId = item.product?.id;
                    const productCost = productId ? Number(item.product.cost_price || 0) : 0;
                    const bookedQty = Number(item.booked_quantity || 0);
                    const totalQty = Number(item.quantity || 0);
                    const productionQty = Math.max(0, totalQty - bookedQty);

                    expected_stock_cost += bookedQty * productCost;

                    if (productId && costBreakdowns[productId]) {
                        const bd = costBreakdowns[productId];
                        expected_bom_cost += productionQty * (bd.boms + bd.components);
                        expected_routing_cost += productionQty * bd.routings;
                        expected_logistic_cost += productionQty * bd.logistics;
                    } else {
                        expected_bom_cost += productionQty * productCost;
                    }
                });
            }

            const totalExpectedCost = expected_bom_cost + expected_routing_cost + expected_logistic_cost + expected_stock_cost;
            const expectedProfit = Number(so.total_amount) - totalExpectedCost;

            // Fix customer_name: fallback sang customer relation nếu customer_name null
            const customerName = so.customer_name || (so.customer ? so.customer.name : '') || '';

            const profit = totalIncome - totalExpense;

            return {
                id: so.id,
                order_code: so.order_code,
                customer_name: customerName,
                status: so.status,
                total_amount: Number(so.total_amount),
                real_income: totalIncome,
                real_expense: totalExpense,
                expected_bom_cost,
                expected_routing_cost,
                expected_logistic_cost,
                expected_stock_cost,
                expected_profit: expectedProfit,
                profit,
                // Margin = Lợi nhuận / Thực thu × 100 (đổi theo yêu cầu)
                margin: totalIncome > 0 ? (profit / totalIncome) * 100 : 0,
                // Chi tiết transactions phân loại Thu/Chi
                income_transactions: relatedTransactions.filter(t => t.type === 'INCOME'),
                expense_transactions: relatedTransactions.filter(t => t.type === 'EXPENSE'),
            };
        });

        return results;
    }
    // ------------------------------------

    // --- MỚI: HÀM MAPPING TRANSACTION CŨ VÀO SUPPLIER ---
    async mapOldTransactions() {
        // 1. Tìm các Transaction Purchase mà chưa có Supplier ID
        const transactions = await this.transRepo.find({
            where: [
                { reference_type: 'PURCHASE', supplier_id: null as any },
                { reference_type: 'BULK_PURCHASE', supplier_id: null as any },
                { type: 'EXPENSE', supplier_id: null as any } // Also check generic Expense if name matches
            ]
        });

        const updates = [];
        let allSuppliers = [];

        for (const t of transactions) {
            // Case 1: Ref Code is PO Code
            if (t.reference_code && t.reference_code.startsWith('PO-')) {
                const po = await this.purchasingService.getPOByCode(t.reference_code);
                if (po && po.supplier_id) {
                    t.supplier_id = po.supplier_id;
                    updates.push(this.transRepo.save(t));
                    continue; // Done
                }
            }

            // Case 2: Fuzzy match partner_name
            if (t.partner_name && !t.supplier_id) {
                if (allSuppliers.length === 0) {
                    allSuppliers = await this.suppliersService.findAll();
                }

                const normalize = (s: string) => s ? s.toLowerCase().trim() : '';
                const pName = normalize(t.partner_name);

                const match = allSuppliers.find(s => normalize(s.name) === pName || (s.legal_name && normalize(s.legal_name) === pName));

                if (match) {
                    t.supplier_id = match.id;
                    updates.push(this.transRepo.save(t));
                }
            }
        }

        await Promise.all(updates);
        return { total: transactions.length, mapped: updates.length };
    }
}