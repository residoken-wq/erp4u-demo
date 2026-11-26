import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import {
  stripCostFields,
  sanitizeWritePayload,
  CostVisibilityInterceptor,
  CostVisible,
  DEFAULT_COST_KEYS,
  DEFAULT_PURCHASE_COST_KEYS,
  defaultProductCostDetector,
} from '../index';

describe('Cost Visibility Common Helper & Interceptor (Task P12b3)', () => {
  describe('stripCostFields utility', () => {
    it('preserves Date, Buffer, null, undefined and primitive values', () => {
      const now = new Date();
      const buf = Buffer.from('test-buffer');
      const input = {
        id: 1,
        title: 'Demo',
        date: now,
        buf: buf,
        empty: null,
        missing: undefined,
        active: true,
        cost_price: 50000,
      };

      const result = stripCostFields(input, { canViewCost: false });
      expect(result.id).toBe(1);
      expect(result.title).toBe('Demo');
      expect(result.date).toBe(now);
      expect(result.date instanceof Date).toBe(true);
      expect(Buffer.isBuffer(result.buf)).toBe(true);
      expect(result.empty).toBeNull();
      expect(result.missing).toBeUndefined();
      expect(result.active).toBe(true);
      expect(result).not.toHaveProperty('cost_price');
    });

    it('preserves pagination wrappers { data, total, page, limit }', () => {
      const paginated = {
        total: 100,
        page: 1,
        limit: 10,
        data: [
          { id: 1, sku: 'SKU-01', base_price: 100000, cost_price: 60000, profit_margin: 40 },
          { id: 2, sku: 'SKU-02', base_price: 200000, cost_price: 120000, profit_margin: 40 },
        ],
      };

      const result = stripCostFields(paginated, { canViewCost: false });
      expect(result.total).toBe(100);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).not.toHaveProperty('cost_price');
      expect(result.data[0]).not.toHaveProperty('profit_margin');
      expect(result.data[0].base_price).toBe(100000);
      expect(result.data[1]).not.toHaveProperty('cost_price');
      expect(result.data[1]).not.toHaveProperty('profit_margin');
    });

    it('does not remove selling price fields (base_price, unit_price, website_price)', () => {
      const order = {
        order_code: 'SO-001',
        total_amount: 500000,
        total_cost: 300000,
        profit: 200000,
        items: [
          {
            sku: 'SP-01',
            quantity: 2,
            unit_price: 250000,
            product: {
              sku: 'SP-01',
              base_price: 250000,
              website_price: 260000,
              cost_price: 150000,
            },
          },
        ],
      };

      const result = stripCostFields(order, { canViewCost: false });
      expect(result.total_amount).toBe(500000);
      expect(result).not.toHaveProperty('total_cost');
      expect(result).not.toHaveProperty('profit');
      expect(result.items[0].unit_price).toBe(250000);
      expect(result.items[0].product.base_price).toBe(250000);
      expect(result.items[0].product.website_price).toBe(260000);
      expect(result.items[0].product).not.toHaveProperty('cost_price');
    });

    it('handles purchaseKeys rule for Mua hàng (PURCHASE module)', () => {
      // Case 1: Mua hàng calling materials route: canViewPurchaseCost = true, canViewCost = false
      const material = {
        id: 10,
        code: 'VAI-COTTON',
        name: 'Vải Cotton Test',
        cost_per_unit: 45000,
        cost_price: 45000,
        quantity_in_stock: 100,
      };

      const resultMuaHang = stripCostFields(material, {
        canViewCost: false,
        canViewPurchaseCost: true,
        purchaseKeys: ['cost_per_unit', 'cost_price'],
      });
      expect(resultMuaHang.cost_per_unit).toBe(45000);
      expect(resultMuaHang.cost_price).toBe(45000);
      expect(resultMuaHang.name).toBe('Vải Cotton Test');

      // Case 2: Kho calling materials route: canViewPurchaseCost = false, canViewCost = false
      const resultKho = stripCostFields(material, {
        canViewCost: false,
        canViewPurchaseCost: false,
        purchaseKeys: ['cost_per_unit', 'cost_price'],
      });
      expect(resultKho).not.toHaveProperty('cost_per_unit');
      expect(resultKho).not.toHaveProperty('cost_price');
      expect(resultKho.name).toBe('Vải Cotton Test');

      // Case 3: Mua hàng calling products route: canViewCost = false, canViewPurchaseCost = true
      const productWithBOM = {
        sku: 'SP-BOM-01',
        cost_price: 120000,
        profit_margin: 25,
        boms: [
          {
            quantity: 1,
            material: {
              code: 'VAI-01',
              cost_per_unit: 45000,
              cost_price: 45000,
            },
          },
        ],
      };

      const resProdMuaHang = stripCostFields(productWithBOM, {
        canViewCost: false,
        canViewPurchaseCost: true,
        purchaseKeys: ['cost_per_unit'],
      });
      // Product cost price is stripped
      expect(resProdMuaHang).not.toHaveProperty('cost_price');
      expect(resProdMuaHang).not.toHaveProperty('profit_margin');
      // Material cost_per_unit is preserved for Mua hàng
      expect(resProdMuaHang.boms[0].material.cost_per_unit).toBe(45000);
    });

    it('safely handles circular references with WeakSet', () => {
      const parent: any = { id: 1, cost_price: 100 };
      const child: any = { id: 2, cost_price: 50 };
      parent.child = child;
      child.parent = parent;

      const result = stripCostFields(parent, { canViewCost: false });
      expect(result.id).toBe(1);
      expect(result).not.toHaveProperty('cost_price');
      expect(result.child.id).toBe(2);
      expect(result.child).not.toHaveProperty('cost_price');
    });

    it('P12b3-r2 Mục 2: filters GET /purchasing nested relations (cost_price, profit_margin in items.product, total_cost in pfo.sales_order)', () => {
      const poResponse = {
        id: 10,
        po_code: 'PO-2026-001',
        total_amount: 1500000,
        items: [
          {
            id: 1,
            po_id: 10,
            material_id: 50,
            quantity: 20,
            unit_price: 50000,
            subtotal: 1000000,
            material: {
              id: 50,
              code: 'MAT-50',
              name: 'Vải Canvas',
              cost_per_unit: 50000,
              cost_price: 50000,
            },
          },
          {
            id: 2,
            po_id: 10,
            product_id: 100,
            quantity: 5,
            unit_price: 100000,
            subtotal: 500000,
            product: {
              id: 100,
              sku: 'PROD-100',
              name: 'Balo Du Lịch',
              base_price: 250000,
              cost_price: 120000,
              profit_margin: 35,
            },
          },
        ],
        pfo: {
          id: 5,
          code: 'PFO-005',
          sales_order: {
            id: 20,
            order_code: 'SO-020',
            total_amount: 3000000,
            total_cost: 1800000,
          },
        },
      };

      // Case 2A: Mua hàng (canViewPurchaseCost = true, canViewCost = false)
      const resMuaHang = stripCostFields(JSON.parse(JSON.stringify(poResponse)), {
        canViewCost: false,
        canViewPurchaseCost: true,
        purchaseKeys: ['cost_per_unit', 'cost_price', 'unit_price', 'price'],
        productCostDetector: defaultProductCostDetector,
      });

      // Mua hàng sees NVL prices & PO item unit_price
      expect(resMuaHang.items[0].unit_price).toBe(50000);
      expect(resMuaHang.items[0].material.cost_per_unit).toBe(50000);
      expect(resMuaHang.items[1].unit_price).toBe(100000);
      // Mua hàng CANNOT see product cost_price, profit_margin or sales_order total_cost
      expect(resMuaHang.items[1].product).not.toHaveProperty('cost_price');
      expect(resMuaHang.items[1].product).not.toHaveProperty('profit_margin');
      expect(resMuaHang.pfo.sales_order).not.toHaveProperty('total_cost');

      // Case 2B: Kho (canViewPurchaseCost = false, canViewCost = false)
      const resKho = stripCostFields(JSON.parse(JSON.stringify(poResponse)), {
        canViewCost: false,
        canViewPurchaseCost: false,
        purchaseKeys: ['cost_per_unit', 'cost_price', 'unit_price', 'price'],
        productCostDetector: defaultProductCostDetector,
      });

      // Kho sees NO cost or purchase price
      expect(resKho.items[0]).not.toHaveProperty('unit_price');
      expect(resKho.items[0].material).not.toHaveProperty('cost_per_unit');
      expect(resKho.items[1]).not.toHaveProperty('unit_price');
      expect(resKho.items[1].product).not.toHaveProperty('cost_price');
      expect(resKho.items[1].product).not.toHaveProperty('profit_margin');
      expect(resKho.pfo.sales_order).not.toHaveProperty('total_cost');

      // Case 2C: Admin (canViewCost = true)
      const resAdmin = stripCostFields(JSON.parse(JSON.stringify(poResponse)), {
        canViewCost: true,
        canViewPurchaseCost: true,
        purchaseKeys: ['cost_per_unit', 'cost_price', 'unit_price', 'price'],
        productCostDetector: defaultProductCostDetector,
      });
      expect(resAdmin.items[1].product.cost_price).toBe(120000);
      expect(resAdmin.items[1].product.profit_margin).toBe(35);
      expect(resAdmin.pfo.sales_order.total_cost).toBe(1800000);
    });

    it('P12b3-r2 Mục 3: distinguishes product line vs material line in PFO requirements', () => {
      const pfoData = {
        id: 101,
        code: 'PFO-TEST-01',
        material_requirements: [
          {
            id: 1,
            pfo_id: 101,
            material_id: 88,
            material_code: 'NVL-COTTON',
            material_name: 'Vải Cotton',
            planned_quantity: 100,
            unit_price: 45000,
          },
          {
            id: 2,
            pfo_id: 101,
            product_id: 99,
            material_code: 'BTP-THAN-TRUOC',
            material_name: 'Thân Trước Áo',
            planned_quantity: 50,
            unit_price: 120000, // Derived from prod.cost_price
            total_cost: 6000000,
          },
        ],
      };

      // Mua hàng: canViewPurchaseCost = true, canViewCost = false
      const resMuaHang = stripCostFields(JSON.parse(JSON.stringify(pfoData)), {
        canViewCost: false,
        canViewPurchaseCost: true,
        purchaseKeys: ['cost_per_unit', 'unit_price'],
        productCostDetector: defaultProductCostDetector,
      });

      // Dòng NVL có unit_price
      expect(resMuaHang.material_requirements[0].unit_price).toBe(45000);
      expect(resMuaHang.material_requirements[0].material_code).toBe('NVL-COTTON');

      // Dòng thành phẩm / BTP KHÔNG có unit_price và total_cost
      expect(resMuaHang.material_requirements[1]).not.toHaveProperty('unit_price');
      expect(resMuaHang.material_requirements[1]).not.toHaveProperty('total_cost');
      expect(resMuaHang.material_requirements[1].material_code).toBe('BTP-THAN-TRUOC');

      // Admin: có đầy đủ cả 2 dòng
      const resAdmin = stripCostFields(JSON.parse(JSON.stringify(pfoData)), {
        canViewCost: true,
        canViewPurchaseCost: true,
        purchaseKeys: ['cost_per_unit', 'unit_price'],
        productCostDetector: defaultProductCostDetector,
      });
      expect(resAdmin.material_requirements[0].unit_price).toBe(45000);
      expect(resAdmin.material_requirements[1].unit_price).toBe(120000);
      expect(resAdmin.material_requirements[1].total_cost).toBe(6000000);
    });

    it('defaultProductCostDetector correctly identifies lines', () => {
      // 1. Material requirement
      expect(defaultProductCostDetector({ material_id: 10, unit_price: 50000 })).toBe(false);
      // 2. PO item with product_id (purchase line, not internal cost)
      expect(defaultProductCostDetector({ po_id: 100, product_id: 5, unit_price: 20000 })).toBe(false);
      // 3. Sales order item (customer price)
      expect(defaultProductCostDetector({ sales_order_id: 20, product_id: 5, unit_price: 200000 })).toBe(false);
      // 4. Product requirement in PFO (internal product cost)
      expect(defaultProductCostDetector({ pfo_id: 1, product_id: 5, unit_price: 80000 })).toBe(true);
      // 5. PFO demand dashboard detail
      expect(defaultProductCostDetector({ pfo_id: 1, product_id: 5, sales_order_id: 20, unit_price: 80000 })).toBe(true);
    });
  });

  describe('sanitizeWritePayload (Mục 3: Ghi dữ liệu không ghi đè giá vốn)', () => {
    it('removes cost keys from request payload when user cannot view cost', () => {
      const payload: any = {
        sku: 'SP-TEST',
        name: 'Sản phẩm Test',
        cost_price: 999999,
        profit_margin: 50,
        base_price: 1500000,
      };

      sanitizeWritePayload(payload, { canViewCost: false });
      expect(payload).not.toHaveProperty('cost_price');
      expect(payload).not.toHaveProperty('profit_margin');
      expect(payload.sku).toBe('SP-TEST');
      expect(payload.name).toBe('Sản phẩm Test');
      expect(payload.base_price).toBe(1500000);
    });

    it('preserves cost keys when user has permission', () => {
      const payload: any = {
        sku: 'SP-TEST',
        name: 'Sản phẩm Test',
        cost_price: 999999,
        profit_margin: 50,
      };

      sanitizeWritePayload(payload, { canViewCost: true });
      expect(payload.cost_price).toBe(999999);
      expect(payload.profit_margin).toBe(50);
    });

    it('removes purchase keys when user cannot view purchase cost', () => {
      const payload: any = {
        code: 'NPL-01',
        name: 'Vải Cotton',
        cost_per_unit: 50000,
        cost_price: 50000,
        unit: 'm',
      };

      sanitizeWritePayload(payload, {
        canViewCost: false,
        canViewPurchaseCost: false,
        purchaseKeys: ['cost_per_unit', 'cost_price'],
      });
      expect(payload).not.toHaveProperty('cost_per_unit');
      expect(payload).not.toHaveProperty('cost_price');
      expect(payload.code).toBe('NPL-01');
    });

    it('preserves purchase keys when user has purchase permission', () => {
      const payload: any = {
        code: 'NPL-01',
        cost_per_unit: 50000,
        cost_price: 50000,
      };

      sanitizeWritePayload(payload, {
        canViewCost: false,
        canViewPurchaseCost: true,
        purchaseKeys: ['cost_per_unit', 'cost_price'],
      });
      expect(payload.cost_per_unit).toBe(50000);
      expect(payload.cost_price).toBe(50000);
    });
  });

  describe('CostVisibilityInterceptor', () => {
    let interceptor: CostVisibilityInterceptor;
    let mockReflector: any;
    let mockPermCache: any;

    beforeEach(() => {
      mockReflector = {
        getAllAndOverride: jest.fn(),
      };
      mockPermCache = {
        canViewCostPrice: jest.fn(),
        canViewPurchaseCost: jest.fn(),
      };
      interceptor = new CostVisibilityInterceptor(mockReflector, mockPermCache);
    });

    it('passes through when route has no @CostVisible metadata', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(undefined);

      const mockContext: any = {
        getHandler: () => {},
        getClass: () => {},
      };
      const mockNext: any = {
        handle: () => of({ test: 'ok' }),
      };

      const result$ = await interceptor.intercept(mockContext, mockNext);
      result$.subscribe((val) => {
        expect(val).toEqual({ test: 'ok' });
      });
      expect(mockPermCache.canViewCostPrice).not.toHaveBeenCalled();
    });

    it('sanitizes PUT payload and strips response for unauthorized user', async () => {
      mockReflector.getAllAndOverride.mockReturnValue({
        modules: ['PRODUCT'],
      });
      mockPermCache.canViewCostPrice.mockResolvedValue(false);
      mockPermCache.canViewPurchaseCost.mockResolvedValue(false);

      const reqBody: any = {
        name: 'Updated Name',
        cost_price: 999999,
        profit_margin: 50,
      };
      const req: any = {
        method: 'PUT',
        body: reqBody,
        user: { id: 2, username: 'user_kho', groupId: 3 },
      };
      const mockContext: any = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => req,
        }),
      };
      const responseData = {
        id: 1,
        name: 'Updated Name',
        cost_price: 100000,
        profit_margin: 20,
      };
      const mockNext: any = {
        handle: () => of(responseData),
      };

      const result$ = await interceptor.intercept(mockContext, mockNext);
      // Verify body was sanitized BEFORE handler
      expect(req.body).not.toHaveProperty('cost_price');
      expect(req.body).not.toHaveProperty('profit_margin');
      expect(req.body.name).toBe('Updated Name');

      // Verify response was stripped AFTER handler
      result$.subscribe((val) => {
        expect(val).not.toHaveProperty('cost_price');
        expect(val).not.toHaveProperty('profit_margin');
        expect(val.name).toBe('Updated Name');
      });
    });

    it('allows admin to see all costs and send cost updates', async () => {
      mockReflector.getAllAndOverride.mockReturnValue({
        modules: ['PRODUCT'],
      });
      mockPermCache.canViewCostPrice.mockResolvedValue(true);
      mockPermCache.canViewPurchaseCost.mockResolvedValue(true);

      const reqBody: any = {
        cost_price: 150000,
      };
      const req: any = {
        method: 'PUT',
        body: reqBody,
        user: { id: 1, username: 'admin', groupId: 1 },
      };
      const mockContext: any = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => req,
        }),
      };
      const responseData = {
        id: 1,
        cost_price: 150000,
      };
      const mockNext: any = {
        handle: () => of(responseData),
      };

      const result$ = await interceptor.intercept(mockContext, mockNext);
      expect(req.body.cost_price).toBe(150000);
      result$.subscribe((val) => {
        expect(val.cost_price).toBe(150000);
      });
    });
  });
});
