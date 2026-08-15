import { DataSource } from 'typeorm';
import { SalesOrder } from '../../sales/sales-order.entity';
import { SalesOrderItem } from '../../sales/sales-order-item.entity';
import { Customer } from '../../customers/customer.entity';
import { Product } from '../../products/product.entity';
import { User } from '../../users/entities/user.entity';

export async function seedSalesOrders(dataSource: DataSource) {
  const orderRepo = dataSource.getRepository(SalesOrder);
  const itemRepo = dataSource.getRepository(SalesOrderItem);
  const custRepo = dataSource.getRepository(Customer);
  const prodRepo = dataSource.getRepository(Product);
  const userRepo = dataSource.getRepository(User);

  console.log('  -> Seeding Sample Sales Orders...');
  const customers = await custRepo.find();
  const products = await prodRepo.find();
  const salesUser = await userRepo.findOne({ where: { username: 'sales01' } });

  if (customers.length === 0 || products.length === 0) return;

  const ordersData = [
    {
      code: 'SO-2026-001',
      customer: customers[0],
      status: 'IN_PRODUCTION',
      notes: 'Đơn hàng sản xuất hộp carton xuất khẩu sang Nhật',
      items: [
        { product: products[0], quantity: 5000, unit_price: 6800 },
        { product: products[1] || products[0], quantity: 2000, unit_price: 13500 },
      ],
    },
    {
      code: 'SO-2026-002',
      customer: customers[1] || customers[0],
      status: 'DELIVERED',
      notes: 'Giao tại kho Quận 1 trước 17h',
      items: [
        { product: products[2] || products[0], quantity: 10000, unit_price: 4500 },
      ],
    },
    {
      code: 'SO-2026-003',
      customer: customers[2] || customers[0],
      status: 'QUOTATION',
      notes: 'Báo giá tem nhãn in logo ép kim mẫu mới',
      items: [
        { product: products[3] || products[0], quantity: 3000, unit_price: 11200 },
      ],
    },
  ];

  for (const o of ordersData) {
    let order = await orderRepo.findOne({ where: { code: o.code } });
    if (!order) {
      const totalAmount = o.items.reduce((sum, it) => sum + it.quantity * it.unit_price, 0);
      order = orderRepo.create({
        code: o.code,
        customer: o.customer,
        customer_id: o.customer.id,
        status: o.status,
        notes: o.notes,
        total_amount: totalAmount,
        final_amount: totalAmount,
        created_by_id: salesUser?.id,
      } as any);
      order = await orderRepo.save(order);

      for (const item of o.items) {
        const orderItem = itemRepo.create({
          order: order,
          order_id: order.id,
          product: item.product,
          product_id: item.product.id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.quantity * item.unit_price,
        } as any);
        await itemRepo.save(orderItem);
      }
    }
  }
}
