import { Injectable, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import { StockHistory } from './stock-history.entity';
import { InventoryStock } from './inventory-stock.entity';
import { GoodsReceipt, GoodsReceiptStatus } from './entities/goods-receipt.entity';
import { GoodsReceiptItem } from './entities/goods-receipt-item.entity';
import { ShippingCarrier } from './entities/shipping-carrier.entity';
import { Product } from '../products/product.entity';
import { Material } from '../materials/material.entity';
import { Supplier } from '../suppliers/supplier.entity';
import { PurchaseOrder } from '../purchasing/entities/purchase-order.entity';
import { PurchaseOrderItem } from '../purchasing/entities/purchase-order-item.entity';
import { SalesDelivery } from '../sales/sales-delivery.entity';
import { SalesOrderItem, BookingStatus } from '../sales/sales-order-item.entity';
import { ProductsService } from '../products/products.service';
import { GoodsIssue, GoodsIssueStatus, GoodsIssueType } from './entities/goods-issue.entity';
import { GoodsIssueItem } from './entities/goods-issue-item.entity';
import { SupplierStock } from './entities/supplier-stock.entity';
import { SupplierTransaction, SupplierTransactionType } from './entities/supplier-transaction.entity';
import { FinanceService } from '../finance/finance.service';
import { PlanningService } from '../planning/planning.service';
import * as dayjs from 'dayjs';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(StockHistory) private historyRepo: Repository<StockHistory>,
    @InjectRepository(InventoryStock) private stockRepo: Repository<InventoryStock>,
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(Material) private materialRepo: Repository<Material>,
    @InjectRepository(GoodsReceipt) private receiptRepo: Repository<GoodsReceipt>,
    @InjectRepository(GoodsReceiptItem) private receiptItemRepo: Repository<GoodsReceiptItem>,
    @InjectRepository(ShippingCarrier) private carrierRepo: Repository<ShippingCarrier>,
    @InjectRepository(Supplier) private supplierRepo: Repository<Supplier>,
    @InjectRepository(PurchaseOrder) private poRepo: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseOrderItem) private poItemRepo: Repository<PurchaseOrderItem>,
    @InjectRepository(SalesDelivery) private deliveryRepo: Repository<SalesDelivery>,
    @InjectRepository(GoodsIssue) private goodsIssueRepo: Repository<GoodsIssue>,
    @InjectRepository(GoodsIssueItem) private giItemRepo: Repository<GoodsIssueItem>,
    @InjectRepository(SupplierStock) private supplierStockRepo: Repository<SupplierStock>,
    @InjectRepository(SupplierTransaction) private supplierTxRepo: Repository<SupplierTransaction>,
    private productsService: ProductsService,
    @Inject(forwardRef(() => FinanceService)) private financeService: FinanceService,
    @Inject(forwardRef(() => PlanningService)) private planningService: PlanningService,
  ) { }

  // --- SHIPPING CARRIER MANAGEMENT ---
  async getAllShippingCarriers() {
    return this.carrierRepo.find({ order: { name: 'ASC' } });
  }

  async createShippingCarrier(data: Partial<ShippingCarrier>) {
    const carrier = this.carrierRepo.create(data);
    return this.carrierRepo.save(carrier);
  }

  async updateShippingCarrier(id: number, data: Partial<ShippingCarrier>) {
    await this.carrierRepo.update(id, data);
    return this.carrierRepo.findOne({ where: { id } });
  }

  async deleteShippingCarrier(id: number) {
    await this.carrierRepo.delete(id);
    return { success: true, message: 'Đã xóa đơn vị vận chuyển' };
  }

  async getAllStocks() {
    const stocks = await this.stockRepo.find();
    
    for (const stock of stocks) {
      if (stock.warehouse_code === 'KHO_BTP' && stock.item_type === 'PRODUCT') {
        try {
          const pos = await this.stockRepo.manager.query(`
            SELECT semi_finished_products 
            FROM purchase_orders 
            WHERE type = 'OUTSOURCING' 
            AND semi_finished_products IS NOT NULL
            LIMIT 10
          `);
          
          for (const row of pos) {
            const list = typeof row.semi_finished_products === 'string' ? JSON.parse(row.semi_finished_products) : row.semi_finished_products;
            if (Array.isArray(list)) {
              const btp = list.find((b: any) => Number(b.product_id) === Number(stock.item_id));
              if (btp && btp.btp_name) {
                (stock as any).btp_name = btp.btp_name;
                break;
              }
            }
          }
        } catch (e) {}
      }
    }
    
    return stocks;
  }

  async getHistory() {
    return this.historyRepo.find({ order: { created_at: 'DESC' }, take: 100 });
  }

  async adjustStock(
    type: 'IMPORT' | 'EXPORT',
    itemType: 'PRODUCT' | 'MATERIAL',
    itemId: number,
    quantity: number,
    refCode: string,
    note: string,
    warehouse: string, // <--- Tham số mới
    updated_by: string = 'System' // <--- MỚI
  ) {
    if (!warehouse) throw new BadRequestException('Chưa chọn kho');

    let masterItem: any;
    let itemCode = '';

    // 1. Kiểm tra Item Master
    if (itemType === 'PRODUCT') {
      masterItem = await this.productRepo.findOne({ where: { id: itemId } });
      if (!masterItem) throw new BadRequestException('SP không tồn tại');
      itemCode = masterItem.sku;
    } else {
      masterItem = await this.materialRepo.findOne({ where: { id: itemId } });
      if (!masterItem) throw new BadRequestException('NPL không tồn tại');
      itemCode = masterItem.code;
    }

    // 2. Lấy hoặc Tạo record tồn kho cho KHO CỤ THỂ
    let stockRecord = await this.stockRepo.findOne({
      where: { item_type: itemType, item_id: itemId, warehouse_code: warehouse }
    });

    if (!stockRecord) {
      stockRecord = this.stockRepo.create({
        item_type: itemType, item_id: itemId, warehouse_code: warehouse, quantity: 0
      });
    }

    // 3. Tính toán
    const change = type === 'IMPORT' ? Number(quantity) : -Number(quantity);
    stockRecord.quantity = Number(stockRecord.quantity) + change;

    // Nếu xuất quá tồn kho (tùy nghiệp vụ, ở đây cho phép âm hoặc chặn)
    // if (stockRecord.quantity < 0) throw new BadRequestException('Không đủ tồn kho để xuất');

    await this.stockRepo.save(stockRecord);

    // 4. Cập nhật Tổng Tồn vào Master (để hiển thị nhanh - Bỏ qua KHO_MAU)
    // Tính tổng lại từ bảng inventory_stock cho chính xác
    const allStocks = await this.stockRepo.find({ where: { item_type: itemType, item_id: itemId } });
    const totalQty = allStocks
      .filter(s => s.warehouse_code !== 'KHO_MAU')
      .reduce((sum, s) => sum + Number(s.quantity), 0);

    if (itemType === 'PRODUCT') {
      await this.productRepo.update(itemId, { quantity_in_stock: totalQty });
    } else {
      await this.materialRepo.update(itemId, { quantity_in_stock: totalQty });
    }

    // 5. Ghi Log
    const history = this.historyRepo.create({
      type, item_type: itemType, item_id: itemId, item_code: itemCode,
      quantity: quantity,
      balance_after: stockRecord.quantity, // Balance của riêng kho này
      warehouse: warehouse, // Ghi nhận kho
      reference_code: refCode || 'MANUAL',
      note,
      updated_by
    });

    return this.historyRepo.save(history);
  }

  // --- CHUYỂN ĐỔI BTP (BTP REPURPOSING) ---
  async convertBtp(sourceSku: string, targetSku: string, quantity: number, updatedBy: string = 'System') {
    if (quantity <= 0) throw new BadRequestException('Số lượng chuyển đổi phải lớn hơn 0');
    if (sourceSku === targetSku) throw new BadRequestException('Mã nguồn và đích không được giống nhau');

    const sourceProduct = await this.productRepo.findOne({ where: { sku: sourceSku } });
    if (!sourceProduct) throw new BadRequestException(`Sản phẩm nguồn ${sourceSku} không tồn tại`);

    const targetProduct = await this.productRepo.findOne({ where: { sku: targetSku } });
    if (!targetProduct) throw new BadRequestException(`Sản phẩm đích ${targetSku} không tồn tại`);

    if (sourceProduct.name !== targetProduct.name) {
      throw new BadRequestException('Chỉ được phép chuyển đổi giữa các biến thể của cùng một sản phẩm cha (Cùng Tên)');
    }

    const warehouse = 'KHO_BTP';

    // Kiểm tra tồn kho KHO_BTP của nguồn
    const sourceStock = await this.stockRepo.findOne({ where: { item_type: 'PRODUCT', item_id: sourceProduct.id, warehouse_code: warehouse } });
    if (!sourceStock || Number(sourceStock.quantity) < quantity) {
      throw new BadRequestException(`Tồn kho BTP của ${sourceSku} không đủ (Hiện có: ${sourceStock?.quantity || 0})`);
    }

    const refCode = `CVT-${dayjs().format('YYYYMMDDHHmmss')}`;

    // 1. Xuất kho BTP nguồn
    await this.adjustStock(
      'EXPORT', 'PRODUCT', sourceProduct.id, quantity, refCode,
      `Chuyển đổi ${quantity} BTP sang mã ${targetSku}`, warehouse, updatedBy
    );

    // 2. Nhập kho BTP đích
    await this.adjustStock(
      'IMPORT', 'PRODUCT', targetProduct.id, quantity, refCode,
      `Nhận ${quantity} BTP chuyển đổi từ mã ${sourceSku}`, warehouse, updatedBy
    );

    return { success: true, message: `Đã chuyển đổi thành công ${quantity} BTP từ ${sourceSku} sang ${targetSku}` };
  }

  // --- HÀM RESET DỮ LIỆU TỒN KHO ---
  async resetAllStocks() {
    // 1. Xóa lịch sử
    await this.historyRepo.clear();

    // 2. Xóa chi tiết tồn kho
    await this.stockRepo.clear();

    // 3. Reset Master Data về 0
    await this.productRepo.createQueryBuilder().update().set({ quantity_in_stock: 0 }).execute();
    await this.materialRepo.createQueryBuilder().update().set({ quantity_in_stock: 0 }).execute();

    return { message: 'Đã reset toàn bộ tồn kho về 0' };
  }

  // --- HÀM CHUYỂN KHO (ATOMIC) ---
  async transferStock(
    itemType: 'PRODUCT' | 'MATERIAL',
    itemId: number,
    quantity: number,
    fromWh: string,
    toWh: string,
    note: string,
    updated_by: string = 'System'
  ) {
    if (!fromWh || !toWh) throw new BadRequestException('Vui lòng chọn đủ 2 kho');
    if (fromWh === toWh) throw new BadRequestException('Kho đi và kho đến phải khác nhau');

    // 1. Kiểm tra tồn kho tại kho đi (Optional: Nếu muốn chặn âm)
    // const stockSrc = await this.stockRepo.findOne({ where: { item_type: itemType, item_id: itemId, warehouse_code: fromWh } });
    // if (!stockSrc || Number(stockSrc.quantity) < quantity) throw new BadRequestException('Kho nguồn không đủ tồn');

    // 2. Thực hiện chuyển (Transaction logic could be better, but reuse adjustStock is safe enough for now)
    // Xuất kho nguồn
    await this.adjustStock('EXPORT', itemType, itemId, quantity, `TRANSFER_OUT`, `Chuyển tới ${toWh}: ${note}`, fromWh, updated_by);

    // Nhập kho đích
    await this.adjustStock('IMPORT', itemType, itemId, quantity, `TRANSFER_IN`, `Nhận từ ${fromWh}: ${note}`, toWh, updated_by);

    return { message: 'Chuyển kho thành công' };
  }

    async getReceiptsByPo(poId: number) {
        return this.receiptRepo.find({
            where: { po_id: poId },
            relations: ['items']
        });
    }

  // --- SUPPLIER STOCK MANAGEMENT ---
  async adjustSupplierStock(
    supplierId: number,
    materialId: number,
    quantityChange: number,
    type: SupplierTransactionType,
    referenceCode: string,
    note: string
  ) {
    let stock = await this.supplierStockRepo.findOne({
      where: { supplier_id: supplierId, material_id: materialId }
    });

    if (!stock) {
      stock = this.supplierStockRepo.create({
        supplier_id: supplierId,
        material_id: materialId,
        quantity: 0
      });
    }

    stock.quantity = Number(stock.quantity) + Number(quantityChange);
    await this.supplierStockRepo.save(stock);

    const tx = this.supplierTxRepo.create({
      supplier_id: supplierId,
      material_id: materialId,
      type,
      quantity: quantityChange,
      balance_after: stock.quantity,
      reference_code: referenceCode,
      note
    });
    await this.supplierTxRepo.save(tx);

    return stock;
  }

  async getSupplierStocks(supplierId: number, startDate?: string, endDate?: string) {
    const stocks = await this.supplierStockRepo.find({
      where: { supplier_id: supplierId },
      relations: ['material']
    });

    const query = this.supplierTxRepo.createQueryBuilder('tx')
      .leftJoinAndSelect('tx.material', 'material')
      .where('tx.supplier_id = :supplierId', { supplierId })
      .orderBy('tx.created_at', 'DESC');

    if (startDate) query.andWhere('tx.created_at >= :startDate', { startDate });
    if (endDate) query.andWhere('tx.created_at <= :endDate', { endDate });

    const transactions = await query.getMany();
    return { stocks, transactions };
  }

  async getAllSupplierStocks() {
    return this.supplierStockRepo.find({
      relations: ['material']
    });
  }

  // --- GOODS RECEIPT FLOW ---

  async createDraftReceipt(data: { po_id: number; items: any[]; note?: string }) {
    // 1. Create Header
    const receipt = this.receiptRepo.create({
      code: `PNK-${Date.now()}`,
      po_id: data.po_id,
      status: GoodsReceiptStatus.DRAFT,
      note: data.note
    });
    await this.receiptRepo.save(receipt);

    // 2. Create Items
    if (data.items && data.items.length > 0) {
      for (const item of data.items) {
        const rItem = this.receiptItemRepo.create({
          receipt: receipt,
          material_id: item.material_id,
          product_id: item.product_id,
          po_item_id: item.po_item_id,
          quantity: item.quantity,
          packing_data: item.packing_data || null
        });
        await this.receiptItemRepo.save(rItem);
      }
    }

    return receipt;
  }

  async getPendingReceipts() {
    return this.receiptRepo.find({
      where: { status: GoodsReceiptStatus.DRAFT },
      relations: [
        'items',
        'items.material',
        'items.product',
        'items.po_item',
        'purchase_order',
        'purchase_order.supplier',
        'purchase_order.items',
        'purchase_order.items.material',
        'purchase_order.items.product',
        'purchase_order.pfo',
        'purchase_order.pfo.sales_order',
        'purchase_order.pfo.sales_order.customer'
      ],
      order: { created_at: 'DESC' }
    });
  }

  async deleteDraftReceipt(id: number) {
    const receipt = await this.receiptRepo.findOne({ where: { id } });
    if (!receipt) throw new BadRequestException('Phiếu nhập không tồn tại');
    if (receipt.status !== GoodsReceiptStatus.DRAFT) throw new BadRequestException('Chỉ xóa được phiếu nháp');
    await this.receiptRepo.delete(id);
    return { success: true, message: 'Đã xóa phiếu nhập' };
  }

  async confirmReceipt(id: number, data?: { items?: any[], actual_receive_date?: string, shipping_fee?: number, delivery_note_url?: string }, warehouseCode: string = 'KHO_NPL', updated_by: string = 'System') {
    const receipt = await this.receiptRepo.findOne({
      where: { id },
      relations: ['items', 'purchase_order', 'purchase_order.items']
    });
    if (!receipt) throw new BadRequestException('Phiếu nhập không tồn tại');
    if (receipt.status !== GoodsReceiptStatus.DRAFT) throw new BadRequestException('Phiếu đã xử lý');

    // Cập nhật thông tin phiếu nếu có
    if (data) {
      if (data.actual_receive_date) receipt.actual_receive_date = data.actual_receive_date;
      if (data.shipping_fee !== undefined) receipt.shipping_fee = data.shipping_fee;
      if (data.delivery_note_url !== undefined) receipt.delivery_note_url = data.delivery_note_url;

      // Cập nhật số lượng item
      if (data.items && data.items.length > 0) {
        for (const inputItem of data.items) {
          const matchedItem = receipt.items.find(i => i.id === inputItem.id);
          if (matchedItem) {
            matchedItem.quantity = inputItem.quantity;
            await this.receiptItemRepo.save(matchedItem);
          }
        }
      }
      await this.receiptRepo.save(receipt);
    }

    // 1. Loop items and import to stock
    let totalValue = 0;

    for (const item of receipt.items) {
      if (item.material_id) {
        await this.adjustStock(
          'IMPORT',
          'MATERIAL',
          item.material_id,
          item.quantity,
          receipt.code,
          `Nhập kho từ PO ${receipt.po_id ? '#' + receipt.po_id : ''}`,
          warehouseCode,
          updated_by
        );
      } else if (item.product_id) {
        let targetWarehouse = warehouseCode === 'KHO_NPL' ? 'KHO_TP' : warehouseCode;
        if (receipt.purchase_order?.type === 'OUTSOURCING' && !item.po_item_id) {
            targetWarehouse = 'KHO_BTP';
        }

        await this.adjustStock(
          'IMPORT',
          'PRODUCT',
          item.product_id,
          item.quantity,
          receipt.code,
          `Nhập kho từ PO ${receipt.po_id ? '#' + receipt.po_id : ''}`,
          targetWarehouse,
          updated_by
        );

        // [MỚI] Tự động trừ Tồn kho NPL của NCC dựa trên Định mức (BOM)
        if (receipt.purchase_order && receipt.purchase_order.supplier_id) {
          const product = await this.productRepo.findOne({ where: { id: item.product_id } });
          if (product) {
            const boms = await this.productsService.getProductBOM(product.sku);
            for (const bom of boms) {
              const qtyConsumed = Number(bom.quantity || 0) * Number(item.quantity);
              if (qtyConsumed > 0) {
                await this.adjustSupplierStock(
                  receipt.purchase_order.supplier_id,
                  bom.material_id,
                  -qtyConsumed,
                  SupplierTransactionType.CONSUME_NPL,
                  receipt.code,
                  `Khấu trừ NPL sản xuất ${product.sku} (SL: ${item.quantity})`
                );
              }
            }
          }
        }
      }

      // Calculate Debt: Find PO Price
      if (receipt.po_id && item.po_item_id) {
        const poItem = await this.poItemRepo.findOne({ where: { id: item.po_item_id } });
        if (poItem) {
          totalValue += Number(item.quantity) * Number(poItem.unit_price);
        }
      }
    }

    // 2. Update Supplier Debt
    // Cộng thêm phí vận chuyển vào công nợ
    const totalDebt = totalValue + Number(receipt.shipping_fee || 0);

    if (receipt.purchase_order && receipt.purchase_order.supplier_id && totalDebt > 0) {
      const supplier = await this.supplierRepo.findOne({ where: { id: receipt.purchase_order.supplier_id } });
      if (supplier) {
        supplier.debt = Number(supplier.debt || 0) + totalDebt;
        await this.supplierRepo.save(supplier);
      }
    }

    // Cập nhật thông tin vào PO
    if (receipt.po_id) {
      const po = await this.poRepo.findOne({ where: { id: receipt.po_id } });
      if (po) {
        po.total_amount = Number(po.total_amount || 0) + Number(receipt.shipping_fee || 0);
        await this.poRepo.save(po);
      }
    }

    // 3. Update Receipt Status
    receipt.delivery_date = new Date().toISOString();
    receipt.status = GoodsReceiptStatus.COMPLETED;
    await this.receiptRepo.save(receipt);

    // 4. --- MỚI: Auto-detect Partial / Full Delivery → Update PO Status ---
    if (receipt.po_id && receipt.purchase_order) {
      await this.updatePODeliveryStatus(receipt.po_id);
    }

    return { message: 'Đã nhập kho thành công', receipt };
  }

  // --- MỚI: Kiểm tra và cập nhật PO delivery status ---
  private async updatePODeliveryStatus(poId: number) {
    try {
      const po = await this.poRepo.findOne({ where: { id: poId }, relations: ['items'] });
      if (!po || !po.items || po.items.length === 0) return;

      // Lấy tất cả phiếu nhập đã confirmed cho PO này
      const allReceipts = await this.receiptRepo.find({
        where: { po_id: poId, status: GoodsReceiptStatus.COMPLETED },
        relations: ['items']
      });

      // Tính tổng đã nhận per PO item
      const totalReceived = new Map<number, number>();
      for (const gr of allReceipts) {
        for (const ri of (gr.items || [])) {
          if (ri.po_item_id) {
            totalReceived.set(
              ri.po_item_id,
              (totalReceived.get(ri.po_item_id) || 0) + Number(ri.quantity)
            );
          }
        }
      }

      // So sánh vs PO items
      let allDelivered = true;
      let anyDelivered = false;

      for (const poItem of po.items) {
        const received = totalReceived.get(poItem.id) || 0;
        if (received > 0) anyDelivered = true;
        if (received < Number(poItem.quantity) * 0.95) allDelivered = false; // Tolerance 5%
      }

      // Update PO status
      if (allDelivered) {
        po.status = 'DELIVERED' as any;
      } else if (anyDelivered) {
        po.status = 'PARTIAL_DELIVERED' as any;
      }
      // Nếu chưa giao gì thì giữ nguyên status

      await this.poRepo.save(po);
    } catch (e) {
      console.error('Auto-update PO delivery status failed:', e);
      // Không throw — không block nhập kho
    }
  }

  // --- SALES DELIVERY CONFIRMATION FLOW ---

  async getPendingDeliveries() {
    return this.deliveryRepo.find({
      where: { status: 'PENDING_EXPORT' }, // Or whatever status was set in SalesService
      relations: ['sales_order', 'sales_order.customer', 'items'],
      order: { created_at: 'DESC' }
    });
  }

  async getCompletedDeliveries() {
    return this.deliveryRepo.find({
      where: { status: In(['SHIPPED', 'DELIVERING', 'DELIVERED']) },
      relations: ['sales_order', 'sales_order.customer', 'items'],
      order: { created_at: 'DESC' }
    });
  }

  async confirmStockExport(deliveryId: number, warehouseCode: string = 'KHO_TP', updated_by: string = 'System') {
    const delivery = await this.deliveryRepo.findOne({
      where: { id: deliveryId },
      relations: ['items', 'sales_order']
    });

    if (!delivery) throw new BadRequestException('Phiếu xuất không tồn tại');
    if (delivery.status !== 'PENDING_EXPORT') throw new BadRequestException('Phiếu đã xử lý hoặc không ở trạng thái chờ xuất');

    // Loop items and deduct stock
    for (const item of delivery.items) {
      if (!item.sku) continue;

      const product = await this.productRepo.findOne({ where: { sku: item.sku } });
      if (product) {
        try {
          // Check if Combo (has components)
          const components = await this.productsService.getComboComponents(item.sku);

          if (components && components.length > 0) {
            // Is Combo -> Deduct Components
            for (const comp of components) {
              if (comp.child_product) {
                const deductQty = Number(item.quantity) * Number(comp.quantity);
                await this.adjustStock(
                  'EXPORT',
                  'PRODUCT',
                  comp.child_product.id,
                  deductQty,
                  delivery.code,
                  `Xuất Combo ${item.sku} (Đơn ${delivery.sales_order?.order_code})`,
                  warehouseCode,
                  updated_by
                );

                // MỚI: Trừ đi booking_stock (vì hàng đã thực xuất)
                comp.child_product.booking_stock = Math.max(0, Number(comp.child_product.booking_stock || 0) - deductQty);
                await this.productsService.update(comp.child_product.id, { booking_stock: comp.child_product.booking_stock });

                // MỚI: Trừ đi approved_booking_stock
                comp.child_product.approved_booking_stock = Math.max(0, Number(comp.child_product.approved_booking_stock || 0) - deductQty);
                await this.productsService.update(comp.child_product.id, { approved_booking_stock: comp.child_product.approved_booking_stock } as any);
              }
            }
          } else {
            // Is Single Product -> Deduct Itself
            await this.adjustStock(
              'EXPORT',
              'PRODUCT',
              product.id,
              Number(item.quantity),
              delivery.code,
              `Giao hàng đơn ${delivery.sales_order?.order_code}`,
              warehouseCode,
              updated_by
            );

            // MỚI: Trừ đi booking_stock (vì hàng đã thực xuất)
            product.booking_stock = Math.max(0, Number(product.booking_stock || 0) - Number(item.quantity));
            await this.productsService.update(product.id, { booking_stock: product.booking_stock });

            // MỚI: Trừ đi approved_booking_stock
            product.approved_booking_stock = Math.max(0, Number(product.approved_booking_stock || 0) - Number(item.quantity));
            await this.productsService.update(product.id, { approved_booking_stock: product.approved_booking_stock } as any);
          }

        } catch (e) {
          // Log error but generally we might want to stop? 
          // For now continue best effort or throw?
          // Let's throw to ensure data integrity
          throw new BadRequestException(`Lỗi xuất kho ${item.sku}: ${e.message}`);
        }
      }
    }

    // Update Status
    delivery.status = 'SHIPPED'; // Or DELIVERING if you want another step? Plan said SHIPPED.
    // NOTE: SHIPPED means Stock Deducted. Then SalesService can send email later?
    // Current SalesService.sendDeliveryEmail sets status to SHIPPED too.
    // If we set SHIPPED here, sendDeliveryEmail might process it again?
    // SalesService.sendDeliveryEmail checks: delivery.email_sent = true.
    // It is fine.

    await this.deliveryRepo.save(delivery);

    // --- MỚI: Cập nhật Finance / SO Profit ---
    try {
      let totalCogs = 0;
      for (const item of delivery.items) {
        if (!item.sku) continue;
        const product = await this.productRepo.findOne({ where: { sku: item.sku } });
        if (product) {
          totalCogs += Number(item.quantity) * Number(product.cost_price || 0);
        }
      }

      if (totalCogs > 0 && delivery.sales_order) {
        await this.financeService.createTransaction({
          date: new Date().toISOString().split('T')[0],
          type: 'EXPENSE',
          amount: totalCogs,
          reference_code: delivery.code,
          reference_type: 'GOODS_ISSUE_PRODUCT',
          description: `Giá vốn xuất kho sản phẩm (Phiếu ${delivery.code})`,
          allocations: [{ refCode: delivery.sales_order.order_code, amount: totalCogs }],
          partner_name: delivery.sales_order.customer?.name || delivery.sales_order.customer_name || 'Khách hàng'
        });
      }
    } catch (e) {
      console.error('Failed to create Finance Transaction for Stock Export:', e);
    }
    // ----------------------------------------

    return { message: 'Đã xuất kho thành công', delivery };
  }

  // ==========================================
  // --- GOODS ISSUE (PHIẾU XUẤT KHO NPL) ---
  // ==========================================

  async createGoodsIssue(data: any) {
    const gi = this.goodsIssueRepo.create({
      code: data.code || `PXK-${dayjs().format('YYMMDD')}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
      type: data.type || 'OUTSOURCING',
      delivery_mode: data.delivery_mode || 'PER_ORDER',
      po_id: data.po_id || null,
      supplier_id: data.supplier_id || null,
      pfo_id: data.pfo_id || null,
      issue_date: data.issue_date || dayjs().format('YYYY-MM-DD'),
      vehicle: data.vehicle || null,
      note: data.note || null,
      status: GoodsIssueStatus.DRAFT
    });
    const saved = await this.goodsIssueRepo.save(gi);

    if (data.items && data.items.length > 0) {
      for (const item of data.items) {
        const giItem = this.giItemRepo.create({
          issue_id: saved.id,
          material_id: item.material_id,
          quantity: Number(item.quantity),
          material_category: item.material_category || null,
          note: item.note || null
        });
        await this.giItemRepo.save(giItem);
      }
    }

    return this.goodsIssueRepo.findOne({ where: { id: saved.id }, relations: ['items', 'items.material', 'supplier'] });
  }

  async updateGoodsIssue(id: number, data: any) {
    const gi = await this.goodsIssueRepo.findOne({ where: { id }, relations: ['items'] });
    if (!gi) throw new BadRequestException('Phiếu xuất kho không tồn tại');

    // Có thể cập nhật metadata cho mọi trạng thái
    if (data.note !== undefined) gi.note = data.note;
    if (data.vehicle !== undefined) gi.vehicle = data.vehicle;
    if (data.supplier_id !== undefined) gi.supplier_id = data.supplier_id;
    if (data.pfo_id !== undefined) gi.pfo_id = data.pfo_id;
    if (data.po_id !== undefined) gi.po_id = data.po_id;
    if (data.type !== undefined) gi.type = data.type;
    if (data.delivery_mode !== undefined) gi.delivery_mode = data.delivery_mode;
    if (data.issue_date !== undefined) gi.issue_date = data.issue_date;

    await this.goodsIssueRepo.save(gi);

    // CHỈ CHO PHÉP sửa danh sách NPL nếu phiếu còn nháp
    if (data.items && gi.status === GoodsIssueStatus.DRAFT) {
      // Xóa hết item cũ
      if (gi.items && gi.items.length > 0) {
        await this.giItemRepo.remove(gi.items);
      }
      // Tạo lại item mới
      for (const item of data.items) {
        const giItem = this.giItemRepo.create({
          issue_id: gi.id,
          material_id: item.material_id,
          quantity: Number(item.quantity),
          material_category: item.material_category || null,
          note: item.note || null,
          supplier_id: item.supplier_id || null
        });
        await this.giItemRepo.save(giItem);
      }
    }

    return this.goodsIssueRepo.findOne({ where: { id }, relations: ['items', 'items.material', 'supplier'] });
  }

  async getGoodsIssues(query?: { po_id?: number; supplier_id?: number }) {
    const where: any = {};
    if (query?.po_id) where.po_id = query.po_id;
    if (query?.supplier_id) where.supplier_id = query.supplier_id;

    return this.goodsIssueRepo.find({
      where,
      relations: [
        'items', 
        'items.material', 
        'supplier', 
        'purchase_order', 
        'purchase_order.pfo', 
        'purchase_order.pfo.sales_order', 
        'purchase_order.pfo.sales_order.customer', 
        'purchase_order.child_pos', 
        'purchase_order.child_pos.pfo', 
        'purchase_order.child_pos.pfo.sales_order', 
        'purchase_order.child_pos.pfo.sales_order.customer'
      ],
      order: { created_at: 'DESC' }
    });
  }

  async getUnlinkedIssues(pfoId: number) {
    return this.goodsIssueRepo.find({
      where: {
        pfo_id: pfoId,
        po_id: IsNull(),
        type: GoodsIssueType.OUTSOURCING,
        status: In([GoodsIssueStatus.DRAFT, GoodsIssueStatus.CONFIRMED])
      },
      relations: ['items', 'items.material'],
      order: { created_at: 'DESC' }
    });
  }

  async linkGoodsIssueToPo(id: number, poId: number) {
    const gi = await this.goodsIssueRepo.findOne({ where: { id } });
    if (!gi) throw new BadRequestException('Phiếu xuất kho không tồn tại');
    gi.po_id = poId;
    return this.goodsIssueRepo.save(gi);
  }

  async getGoodsIssueDetail(id: number) {
    const gi = await this.goodsIssueRepo.findOne({
      where: { id },
      relations: ['items', 'items.material', 'supplier', 'purchase_order']
    });
    if (!gi) throw new BadRequestException('Phiếu xuất kho không tồn tại');
    return gi;
  }

  async confirmGoodsIssue(id: number, updated_by: string = 'System', body?: any) {
    const gi = await this.goodsIssueRepo.findOne({
      where: { id },
      relations: ['items', 'items.material']
    });
    if (!gi) throw new BadRequestException('Phiếu xuất kho không tồn tại');
    if (gi.status !== GoodsIssueStatus.DRAFT) throw new BadRequestException('Phiếu đã xử lý');

    // Cập nhật số lượng và nhà gia công cho từng item
    if (body?.items && body.items.length > 0) {
      for (const inputItem of body.items) {
        const matchedItem = gi.items.find(i => i.id === inputItem.id);
        if (matchedItem) {
          if (inputItem.quantity !== undefined) matchedItem.quantity = inputItem.quantity;
          if (inputItem.supplier_id !== undefined) matchedItem.supplier_id = inputItem.supplier_id;
          await this.giItemRepo.save(matchedItem);
        }
      }
    }

    if (body?.supplier_id) {
      gi.supplier_id = body.supplier_id;
      await this.goodsIssueRepo.save(gi);
    }

    // Xuất kho thực tế từng NPL
    let totalNplCost = 0;
    for (const item of gi.items) {
      if (item.material_id) {
        totalNplCost += Number(item.quantity) * Number(item.material?.cost_price || 0);

        await this.adjustStock(
          'EXPORT', 'MATERIAL', item.material_id,
          Number(item.quantity), gi.code,
          `Xuất cho GC: ${gi.note || gi.code}`,
          'KHO_NPL',
          updated_by
        );

        // [MỚI] Tự động cộng Tồn kho NPL cho NCC khi xuất kho giao NCC
        const actualSupplierId = item.supplier_id || gi.supplier_id;
        if (actualSupplierId && gi.type === 'OUTSOURCING') {
          await this.adjustSupplierStock(
            actualSupplierId,
            item.material_id,
            Number(item.quantity),
            SupplierTransactionType.RECEIVE_NPL,
            gi.code,
            `Nhận NPL từ Phiếu xuất ${gi.code}`
          );
        }
      }
    }

    // --- MỚI: Cập nhật Finance / SO Profit ---
    if (totalNplCost > 0 && gi.pfo_id) {
      try {
        const plan = await this.planningService.findOne(gi.pfo_id);
        if (plan && plan.sales_order) {
          const salesOrders = [plan.sales_order];
          // Tính tổng số lượng sản phẩm của KHSX
          let totalPlanItems = 0;
          salesOrders.forEach(so => {
            so.items?.forEach(i => {
               totalPlanItems += Number(i.quantity || 0);
            });
          });

          const allocations = [];
          salesOrders.forEach(so => {
             let soItemsQty = 0;
             so.items?.forEach(i => { soItemsQty += Number(i.quantity || 0); });
             
             let allocatedAmount = 0;
             if (totalPlanItems > 0) {
                allocatedAmount = (soItemsQty / totalPlanItems) * totalNplCost;
             } else {
                allocatedAmount = totalNplCost / salesOrders.length; // fallback chia đều
             }

             if (allocatedAmount > 0) {
                allocations.push({ refCode: so.order_code, amount: allocatedAmount });
             }
          });

          if (allocations.length > 0) {
             await this.financeService.createTransaction({
                date: new Date().toISOString().split('T')[0],
                type: 'EXPENSE',
                amount: totalNplCost,
                reference_code: gi.code,
                reference_type: 'GOODS_ISSUE_NPL',
                description: `Chi phí NPL xuất kho KHSX ${plan.code} (Phiếu ${gi.code})`,
                allocations: allocations,
                partner_name: gi.supplier ? gi.supplier.name : 'Kho Nội Bộ'
             });
          }
        }
      } catch (e) {
         console.error('Failed to create Finance Transaction for Goods Issue:', e);
      }
    }
    // ----------------------------------------

    gi.status = GoodsIssueStatus.CONFIRMED;
    const saved = await this.goodsIssueRepo.save(gi);

    // [AUTO-UPDATE PFO] Cập nhật KHSX sang IN_PRODUCTION và tự động duyệt Booking tạm thời
    if (gi.pfo_id) {
      try {
        await this.goodsIssueRepo.manager.update('ProductionFulfillmentOrder', gi.pfo_id, { status: 'IN_PRODUCTION' });
        const pfo: any = await this.goodsIssueRepo.manager.findOne('ProductionFulfillmentOrder', { where: { id: gi.pfo_id } });
        if (pfo && pfo.sales_order_id) {
            await this.goodsIssueRepo.manager.update(SalesOrderItem, 
                { order_id: pfo.sales_order_id, booking_status: BookingStatus.TEMPORARY }, 
                { booking_status: BookingStatus.CONFIRMED, booking_expires_at: null }
            );
        }
      } catch (err) {
        console.error('Error auto-updating PFO and bookings on material issue:', err);
      }
    }

    return saved;
  }

  async markGoodsIssueDelivered(id: number) {
    const gi = await this.goodsIssueRepo.findOne({ where: { id } });
    if (!gi) throw new BadRequestException('Phiếu xuất kho không tồn tại');
    gi.status = GoodsIssueStatus.DELIVERED;
    return this.goodsIssueRepo.save(gi);
  }

  async deleteGoodsIssue(id: number) {
    const gi = await this.goodsIssueRepo.findOne({ 
      where: { id },
      relations: ['items', 'items.material']
    });
    if (!gi) throw new BadRequestException('Phiếu xuất kho không tồn tại');

    // Nếu phiếu đã xác nhận xuất kho hoặc đã giao mà bị xóa (vd: do trùng lặp), hoàn trả lại số lượng tồn kho
    if (gi.status === GoodsIssueStatus.CONFIRMED || gi.status === GoodsIssueStatus.DELIVERED) {
      for (const item of (gi.items || [])) {
        if (item.material_id) {
          const mat = await this.materialRepo.findOne({ where: { id: item.material_id } });
          if (mat) {
            mat.quantity_in_stock = Number(mat.quantity_in_stock || 0) + Number(item.quantity || 0);
            await this.materialRepo.save(mat);
          }
        }
      }
    }

    if (gi.items && gi.items.length > 0) {
      await this.giItemRepo.delete({ issue_id: id });
    }
    await this.goodsIssueRepo.delete(id);
    return { success: true, message: 'Đã xóa phiếu xuất kho' };
  }
}
