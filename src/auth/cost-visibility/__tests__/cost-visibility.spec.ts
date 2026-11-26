import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import {
  stripCostFields,
  sanitizeWritePayload,
  CostVisibilityInterceptor,
  CostVisible,
  DEFAULT_COST_KEYS,
  DEFAULT_PURCHASE_COST_KEYS,
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
