import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LookupsService } from '../lookups.service';
import { User } from '../../users/entities/user.entity';
import { Product } from '../../products/product.entity';
import { Customer } from '../../customers/customer.entity';
import { Supplier } from '../../suppliers/supplier.entity';
import { Employee } from '../../hr/entities/employee.entity';
import { Category } from '../../categories/category.entity';
import { Material } from '../../materials/material.entity';

describe('LookupsService (Unit Tests / D3 Minimal Cross-Module Lookups)', () => {
  let service: LookupsService;

  const createMockQueryBuilder = (result: any[]) => {
    const qb: any = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(result),
    };
    return qb;
  };

  let mockUserRepo: any;
  let mockProductRepo: any;
  let mockCustomerRepo: any;
  let mockSupplierRepo: any;
  let mockEmployeeRepo: any;
  let mockCategoryRepo: any;
  let mockMaterialRepo: any;

  beforeEach(async () => {
    mockUserRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(
        createMockQueryBuilder([
          { id: 1, full_name: 'Nguyen Van A', username: 'nguyenvana' },
        ]),
      ),
    };

    mockProductRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(
        createMockQueryBuilder([
          { id: 10, sku: 'SP-001', name: 'Sản phẩm mẫu 01', unit: 'cái' },
        ]),
      ),
    };

    mockCustomerRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(
        createMockQueryBuilder([
          { id: 20, code: 'KH-001', name: 'Khách hàng Demo 01' },
        ]),
      ),
    };

    mockSupplierRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(
        createMockQueryBuilder([
          { id: 30, code: 'NCC-001', name: 'Nhà cung cấp Demo 01', type: 'LOGISTICS' },
        ]),
      ),
    };

    mockEmployeeRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(
        createMockQueryBuilder([
          { id: 40, full_name: 'Tran Thi B' },
        ]),
      ),
    };

    mockCategoryRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(
        createMockQueryBuilder([
          { id: 50, name: 'Danh mục Áo thun' },
        ]),
      ),
    };

    mockMaterialRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(
        createMockQueryBuilder([
          { id: 60, code: 'NPL-001', name: 'Vải cotton 100%', unit: 'mét' },
        ]),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LookupsService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(Product), useValue: mockProductRepo },
        { provide: getRepositoryToken(Customer), useValue: mockCustomerRepo },
        { provide: getRepositoryToken(Supplier), useValue: mockSupplierRepo },
        { provide: getRepositoryToken(Employee), useValue: mockEmployeeRepo },
        { provide: getRepositoryToken(Category), useValue: mockCategoryRepo },
        { provide: getRepositoryToken(Material), useValue: mockMaterialRepo },
      ],
    }).compile();

    service = module.get<LookupsService>(LookupsService);
  });

  it('getUsers returns only allowed fields (id, full_name, username)', async () => {
    const res = await service.getUsers();
    expect(res).toEqual([
      { id: 1, full_name: 'Nguyen Van A', username: 'nguyenvana' },
    ]);
    expect((res[0] as any).password).toBeUndefined();
    expect((res[0] as any).group_id).toBeUndefined();
  });

  it('getProducts returns only allowed fields (id, code, sku, name, unit) without cost/price', async () => {
    const res = await service.getProducts();
    expect(res).toEqual([
      { id: 10, code: 'SP-001', sku: 'SP-001', name: 'Sản phẩm mẫu 01', unit: 'cái' },
    ]);
    expect((res[0] as any).base_price).toBeUndefined();
    expect((res[0] as any).cost_price).toBeUndefined();
    expect((res[0] as any).profit_margin).toBeUndefined();
  });

  it('getCustomers returns only allowed fields (id, code, name) without debt/credit', async () => {
    const res = await service.getCustomers();
    expect(res).toEqual([
      { id: 20, code: 'KH-001', name: 'Khách hàng Demo 01' },
    ]);
    expect((res[0] as any).credit_limit).toBeUndefined();
    expect((res[0] as any).current_debt).toBeUndefined();
    expect((res[0] as any).phone).toBeUndefined();
  });

  it('getSuppliers returns only allowed fields (id, code, name, type) without debt', async () => {
    const res = await service.getSuppliers();
    expect(res).toEqual([
      { id: 30, code: 'NCC-001', name: 'Nhà cung cấp Demo 01', type: 'LOGISTICS' },
    ]);
    expect((res[0] as any).debt).toBeUndefined();
  });

  it('getWarehouses returns static allowed warehouses with optional q filtering', async () => {
    const res = await service.getWarehouses();
    expect(res.length).toBe(4);
    expect(res.map((w) => w.id)).toEqual(['KHO_TP', 'KHO_BTP', 'KHO_NPL', 'KHO_LOI']);

    const filtered = await service.getWarehouses('nguyên phụ liệu');
    expect(filtered).toEqual([{ id: 'KHO_NPL', name: 'Kho nguyên phụ liệu' }]);
  });

  it('getEmployees returns only id, code, full_name without salary/PII', async () => {
    const res = await service.getEmployees();
    expect(res).toEqual([
      { id: 40, code: 'NV040', full_name: 'Tran Thi B' },
    ]);
    expect((res[0] as any).base_salary).toBeUndefined();
    expect((res[0] as any).phone).toBeUndefined();
    expect((res[0] as any).address).toBeUndefined();
  });
});
