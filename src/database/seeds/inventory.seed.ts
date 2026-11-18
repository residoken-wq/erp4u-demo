import { DataSource, DeepPartial } from 'typeorm';
import { InventoryStock } from '../../inventory/inventory-stock.entity';
import { Material } from '../../materials/material.entity';
import { Product } from '../../products/product.entity';

export async function seedInventory(dataSource: DataSource) {
  const stockRepo = dataSource.getRepository(InventoryStock);
  const matRepo = dataSource.getRepository(Material);
  const prodRepo = dataSource.getRepository(Product);

  console.log('  -> Seeding Inventory Initial Stocks...');
  const materials = await matRepo.find();
  const products = await prodRepo.find();

  for (const m of materials) {
    let stock = await stockRepo.findOne({ where: { item_type: 'MATERIAL', item_id: m.id, warehouse_code: 'KHO_NVL_TONG' } });
    if (!stock) {
      stock = stockRepo.create({
        item_type: 'MATERIAL',
        item_id: m.id,
        warehouse_code: 'KHO_NVL_TONG',
        quantity: Math.floor(Math.random() * 2000) + 500,
      } as DeepPartial<InventoryStock>);
      await stockRepo.save(stock);
    }
  }

  for (const p of products) {
    let stock = await stockRepo.findOne({ where: { item_type: 'PRODUCT', item_id: p.id, warehouse_code: 'KHO_THANH_PHAM' } });
    if (!stock) {
      stock = stockRepo.create({
        item_type: 'PRODUCT',
        item_id: p.id,
        warehouse_code: 'KHO_THANH_PHAM',
        quantity: Math.floor(Math.random() * 1500) + 200,
      } as DeepPartial<InventoryStock>);
      await stockRepo.save(stock);
    }
  }
}
