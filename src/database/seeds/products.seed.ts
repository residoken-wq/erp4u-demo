import { DataSource } from 'typeorm';
import { Product } from '../../products/product.entity';
import { Category } from '../../categories/category.entity';
import { BOM } from '../../bom/bom.entity';
import { Material } from '../../materials/material.entity';

export async function seedProducts(dataSource: DataSource) {
  const prodRepo = dataSource.getRepository(Product);
  const catRepo = dataSource.getRepository(Category);
  const matRepo = dataSource.getRepository(Material);
  const bomRepo = dataSource.getRepository(BOM);

  console.log('  -> Seeding Products & BOMs...');
  const catCarton = await catRepo.findOne({ where: { code: 'CAT_CARTON' } });
  const catBag = await catRepo.findOne({ where: { code: 'CAT_BAG' } });
  const catLabel = await catRepo.findOne({ where: { code: 'CAT_LABEL' } });

  const productsData = [
    { sku: 'PRD-BOX-30x20x15', name: 'Thùng Carton Sóng B 3 Lớp 30x20x15cm', category_id: catCarton?.id, base_price: 6800, cost_price: 4200, min_stock: 500 },
    { sku: 'PRD-BOX-40x30x20', name: 'Thùng Carton Sóng BC 5 Lớp 40x30x20cm', category_id: catCarton?.id, base_price: 13500, cost_price: 8900, min_stock: 300 },
    { sku: 'PRD-BAG-KRAFT-A4', name: 'Túi Giấy Kraft Quai Dệt Size A4 (24x34x10cm)', category_id: catBag?.id, base_price: 4500, cost_price: 2800, min_stock: 1000 },
    { sku: 'PRD-BAG-IVORY-LUX', name: 'Túi Giấy Ivory 300gsm Cán Mờ Ép Kim Logo', category_id: catBag?.id, base_price: 11200, cost_price: 6800, min_stock: 400 },
    { sku: 'PRD-STICKER-5CM', name: 'Decal Tem Tròn 5cm Cán Màng Chống Thấm', category_id: catLabel?.id, base_price: 450, cost_price: 180, min_stock: 5000 },
  ];

  const allMats = await matRepo.find();
  const matMap = new Map(allMats.map((m) => [m.code, m]));

  for (const p of productsData) {
    let prod = await prodRepo.findOne({ where: { sku: p.sku } });
    if (!prod) {
      prod = prodRepo.create(p as any);
      prod = await prodRepo.save(prod);

      // Create Sample BOM
      if (p.sku.startsWith('PRD-BOX')) {
        const matCorr = matMap.get('MAT-CORRUGATED-3L') || allMats[0];
        const matInk = matMap.get('MAT-INK-BLACK') || allMats[1];
        if (matCorr) {
          await bomRepo.save(bomRepo.create({ product: prod, material: matCorr, quantity: 0.35, unit: 'm2' } as any));
        }
        if (matInk) {
          await bomRepo.save(bomRepo.create({ product: prod, material: matInk, quantity: 0.005, unit: 'Kg' } as any));
        }
      } else if (p.sku.startsWith('PRD-BAG')) {
        const matPaper = matMap.get('MAT-KRAFT-180') || allMats[0];
        const matRope = matMap.get('MAT-ROPE-COTTON') || allMats[1];
        if (matPaper) {
          await bomRepo.save(bomRepo.create({ product: prod, material: matPaper, quantity: 0.08, unit: 'Kg' } as any));
        }
        if (matRope) {
          await bomRepo.save(bomRepo.create({ product: prod, material: matRope, quantity: 0.8, unit: 'Mét' } as any));
        }
      }
    }
  }
}
