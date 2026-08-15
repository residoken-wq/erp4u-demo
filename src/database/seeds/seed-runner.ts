import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { DataSource } from 'typeorm';
import { seedSystem } from './system.seed';
import { seedUsers } from './users.seed';
import { seedCategories } from './categories.seed';
import { seedMaterials } from './materials.seed';
import { seedProducts } from './products.seed';
import { seedCustomers } from './customers.seed';
import { seedSuppliers } from './suppliers.seed';
import { seedEmployees } from './employees.seed';
import { seedSalesOrders } from './sales-orders.seed';
import { seedInventory } from './inventory.seed';

async function runSeeder() {
  console.log('====================================================');
  console.log('🌱 Starting ERP4U Demo Database Seeder...');
  console.log('====================================================');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const dataSource = app.get(DataSource);

  const isReset = process.argv.includes('--reset');
  if (isReset) {
    console.log('⚠️ --reset flag detected: Truncating existing tables...');
    try {
      await dataSource.query(`
        TRUNCATE TABLE 
          sales_order_items, sales_orders,
          product_bom, products, materials, categories,
          customer_contacts, customers,
          supplier_contacts, suppliers,
          employees, work_shifts,
          group_permissions, user_groups, users,
          inventory_stocks, system_configs
        CASCADE;
      `);
      console.log('✅ Tables truncated successfully.');
    } catch (err: any) {
      console.log('Notice during truncate (normal on fresh DB):', err.message);
    }
  }

  try {
    await seedSystem(dataSource);
    await seedUsers(dataSource);
    await seedCategories(dataSource);
    await seedMaterials(dataSource);
    await seedProducts(dataSource);
    await seedCustomers(dataSource);
    await seedSuppliers(dataSource);
    await seedEmployees(dataSource);
    await seedSalesOrders(dataSource);
    await seedInventory(dataSource);

    console.log('====================================================');
    console.log('🎉 ERP4U Demo Database Seeding COMPLETED successfully!');
    console.log('🔑 Demo credentials:');
    console.log('   - admin / admin123 (Full Access)');
    console.log('   - sales01 / demo123 (Kinh Doanh)');
    console.log('   - warehouse01 / demo123 (Kho Vận)');
    console.log('   - accountant01 / demo123 (Kế Toán)');
    console.log('   - hr01 / demo123 (Nhân Sự)');
    console.log('====================================================');
  } catch (error) {
    console.error('❌ Seeder failed with error:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

runSeeder();
