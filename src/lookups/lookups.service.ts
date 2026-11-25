import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Product } from '../products/product.entity';
import { Customer } from '../customers/customer.entity';
import { Supplier } from '../suppliers/supplier.entity';
import { Employee } from '../hr/entities/employee.entity';
import { Category } from '../categories/category.entity';
import { Material } from '../materials/material.entity';

export interface UserLookupItem {
  id: number;
  full_name: string;
  username: string;
}

export interface ProductLookupItem {
  id: number;
  code: string;
  sku: string;
  name: string;
  unit: string;
}

export interface CustomerLookupItem {
  id: number;
  code: string;
  name: string;
}

export interface SupplierLookupItem {
  id: number;
  code: string;
  name: string;
  type?: string;
}

export interface WarehouseLookupItem {
  id: string;
  name: string;
}

export interface EmployeeLookupItem {
  id: number;
  code: string;
  full_name: string;
}

export interface CategoryLookupItem {
  id: number;
  name: string;
}

export interface MaterialLookupItem {
  id: number;
  code: string;
  name: string;
  unit: string;
}

const WAREHOUSES: WarehouseLookupItem[] = [
  { id: 'KHO_TP', name: 'Kho thành phẩm' },
  { id: 'KHO_BTP', name: 'Kho bán thành phẩm' },
  { id: 'KHO_NPL', name: 'Kho nguyên phụ liệu' },
  { id: 'KHO_LOI', name: 'Kho hàng lỗi' },
];

function resolveTake(q?: string, limit?: number): number {
  const hasQuery = Boolean(q && q.trim());
  if (hasQuery) {
    if (limit && !isNaN(limit)) {
      return Math.min(Math.max(limit, 1), 50);
    }
    return 50;
  }
  if (limit && !isNaN(limit)) {
    return Math.min(Math.max(limit, 1), 5000);
  }
  return 5000;
}

@Injectable()
export class LookupsService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(Material)
    private readonly materialRepo: Repository<Material>,
  ) {}

  async getUsers(q?: string, limit?: number): Promise<UserLookupItem[]> {
    const take = resolveTake(q, limit);
    const qb = this.userRepo
      .createQueryBuilder('u')
      .select(['u.id', 'u.full_name', 'u.username'])
      .where('u.is_active = :active', { active: true });

    if (q && q.trim()) {
      qb.andWhere('(u.full_name ILIKE :q OR u.username ILIKE :q)', {
        q: `%${q.trim()}%`,
      });
    }

    qb.orderBy('u.full_name', 'ASC').take(take);
    const users = await qb.getMany();
    return users.map((u) => ({
      id: u.id,
      full_name: u.full_name || u.username,
      username: u.username,
    }));
  }

  async getProducts(q?: string, limit?: number): Promise<ProductLookupItem[]> {
    const take = resolveTake(q, limit);
    const qb = this.productRepo
      .createQueryBuilder('p')
      .select(['p.id', 'p.sku', 'p.name', 'p.unit'])
      .where('p.is_active = :active', { active: true });

    if (q && q.trim()) {
      qb.andWhere('(p.name ILIKE :q OR p.sku ILIKE :q)', {
        q: `%${q.trim()}%`,
      });
    }

    qb.orderBy('p.name', 'ASC').take(take);
    const products = await qb.getMany();
    return products.map((p) => ({
      id: p.id,
      code: p.sku,
      sku: p.sku,
      name: p.name,
      unit: p.unit || 'cái',
    }));
  }

  async getCustomers(q?: string, limit?: number): Promise<CustomerLookupItem[]> {
    const take = resolveTake(q, limit);
    const qb = this.customerRepo
      .createQueryBuilder('c')
      .select(['c.id', 'c.code', 'c.name']);

    if (q && q.trim()) {
      qb.where('(c.name ILIKE :q OR c.code ILIKE :q)', {
        q: `%${q.trim()}%`,
      });
    }

    qb.orderBy('c.name', 'ASC').take(take);
    const customers = await qb.getMany();
    return customers.map((c) => ({
      id: c.id,
      code: c.code || '',
      name: c.name,
    }));
  }

  async getSuppliers(
    q?: string,
    limit?: number,
    type?: string,
  ): Promise<SupplierLookupItem[]> {
    const take = resolveTake(q, limit);
    const qb = this.supplierRepo
      .createQueryBuilder('s')
      .select(['s.id', 's.code', 's.name', 's.type']);

    if (type && type.trim()) {
      qb.andWhere('s.type = :type', { type: type.trim() });
    }

    if (q && q.trim()) {
      qb.andWhere('(s.name ILIKE :q OR s.code ILIKE :q)', {
        q: `%${q.trim()}%`,
      });
    }

    qb.orderBy('s.name', 'ASC').take(take);
    const suppliers = await qb.getMany();
    return suppliers.map((s) => ({
      id: s.id,
      code: s.code || '',
      name: s.name,
      type: s.type,
    }));
  }

  async getWarehouses(q?: string, limit?: number): Promise<WarehouseLookupItem[]> {
    const take = resolveTake(q, limit);
    let list = WAREHOUSES;
    if (q && q.trim()) {
      const term = q.trim().toLowerCase();
      list = list.filter(
        (w) =>
          w.name.toLowerCase().includes(term) ||
          w.id.toLowerCase().includes(term),
      );
    }
    return list.slice(0, take);
  }

  async getEmployees(q?: string, limit?: number): Promise<EmployeeLookupItem[]> {
    const take = resolveTake(q, limit);
    const qb = this.employeeRepo
      .createQueryBuilder('e')
      .select(['e.id', 'e.full_name'])
      .where('e.is_active = :active', { active: true });

    if (q && q.trim()) {
      qb.andWhere('e.full_name ILIKE :q', {
        q: `%${q.trim()}%`,
      });
    }

    qb.orderBy('e.full_name', 'ASC').take(take);
    const employees = await qb.getMany();
    return employees.map((e) => ({
      id: e.id,
      code: 'NV' + String(e.id).padStart(3, '0'),
      full_name: e.full_name,
    }));
  }

  async getCategories(q?: string, limit?: number): Promise<CategoryLookupItem[]> {
    const take = resolveTake(q, limit);
    const qb = this.categoryRepo.createQueryBuilder('c').select(['c.id', 'c.name']);

    if (q && q.trim()) {
      qb.where('c.name ILIKE :q', { q: `%${q.trim()}%` });
    }

    qb.orderBy('c.name', 'ASC').take(take);
    const categories = await qb.getMany();
    return categories.map((c) => ({
      id: c.id,
      name: c.name,
    }));
  }

  async getMaterials(q?: string, limit?: number): Promise<MaterialLookupItem[]> {
    const take = resolveTake(q, limit);
    const qb = this.materialRepo
      .createQueryBuilder('m')
      .select(['m.id', 'm.code', 'm.name', 'm.unit']);

    if (q && q.trim()) {
      qb.where('(m.name ILIKE :q OR m.code ILIKE :q)', {
        q: `%${q.trim()}%`,
      });
    }

    qb.orderBy('m.name', 'ASC').take(take);
    const materials = await qb.getMany();
    return materials.map((m) => ({
      id: m.id,
      code: m.code || '',
      name: m.name,
      unit: m.unit || 'cái',
    }));
  }
}
