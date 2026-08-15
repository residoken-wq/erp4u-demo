import { DataSource, DeepPartial } from 'typeorm';
import { Material } from '../../materials/material.entity';

export async function seedMaterials(dataSource: DataSource) {
  const matRepo = dataSource.getRepository(Material);

  console.log('  -> Seeding Materials (Raw materials)...');
  const materials = [
    { code: 'MAT-KRAFT-180', name: 'Giấy Kraft Việt Trì 180gsm', category: 'Giấy Nguyên Liệu', unit: 'Kg', cost_price: 18500, min_stock: 500 },
    { code: 'MAT-KRAFT-250', name: 'Giấy Kraft Nhập Khẩu Nga 250gsm', category: 'Giấy Nguyên Liệu', unit: 'Kg', cost_price: 24000, min_stock: 300 },
    { code: 'MAT-DUPLEX-300', name: 'Giấy Duplex Trắng 300gsm', category: 'Giấy Nguyên Liệu', unit: 'Kg', cost_price: 22000, min_stock: 400 },
    { code: 'MAT-IVORY-350', name: 'Giấy Ivory Cao Cấp FBB 350gsm', category: 'Giấy Nguyên Liệu', unit: 'Kg', cost_price: 32000, min_stock: 200 },
    { code: 'MAT-CORRUGATED-3L', name: 'Phôi Sóng Carton E 3 Lớp', category: 'Phôi Sóng', unit: 'm2', cost_price: 6500, min_stock: 1000 },
    { code: 'MAT-CORRUGATED-5L', name: 'Phôi Sóng Carton BC 5 Lớp', category: 'Phôi Sóng', unit: 'm2', cost_price: 11500, min_stock: 800 },
    { code: 'MAT-INK-CYAN', name: 'Mực In Offset Cyan (Xanh)', category: 'Mực & Hóa Chất', unit: 'Kg', cost_price: 180000, min_stock: 50 },
    { code: 'MAT-INK-MAGENTA', name: 'Mực In Offset Magenta (Đỏ)', category: 'Mực & Hóa Chất', unit: 'Kg', cost_price: 185000, min_stock: 50 },
    { code: 'MAT-INK-YELLOW', name: 'Mực In Offset Yellow (Vàng)', category: 'Mực & Hóa Chất', unit: 'Kg', cost_price: 175000, min_stock: 50 },
    { code: 'MAT-INK-BLACK', name: 'Mực In Offset Black (Đen)', category: 'Mực & Hóa Chất', unit: 'Kg', cost_price: 160000, min_stock: 60 },
    { code: 'MAT-GLUE-HOTMELT', name: 'Keo Nhiệt Dán Đáy Hộp Hotmelt', category: 'Keo Dán', unit: 'Kg', cost_price: 45000, min_stock: 100 },
    { code: 'MAT-GLUE-WATER', name: 'Keo Nước Cán Màng Gốc Nước', category: 'Keo Dán', unit: 'Kg', cost_price: 38000, min_stock: 150 },
    { code: 'MAT-FILM-GLOSS', name: 'Màng BOPP Cán Bóng 15mic', category: 'Màng Cán', unit: 'Cuộn', cost_price: 420000, min_stock: 20 },
    { code: 'MAT-FILM-MATTE', name: 'Màng BOPP Cán Mờ 18mic', category: 'Màng Cán', unit: 'Cuộn', cost_price: 460000, min_stock: 20 },
    { code: 'MAT-ROPE-COTTON', name: 'Quai Túi Sợi Dệt Cotton Tròn', category: 'Phụ Liệu', unit: 'Mét', cost_price: 1200, min_stock: 5000 },
    { code: 'MAT-ROPE-RIBBON', name: 'Ruy Băng Lụa Đính Quai Túi 2cm', category: 'Phụ Liệu', unit: 'Cuộn', cost_price: 65000, min_stock: 30 },
  ];

  for (const m of materials) {
    let mat = await matRepo.findOne({ where: { code: m.code } });
    if (!mat) {
      mat = matRepo.create(m as DeepPartial<Material>);
      await matRepo.save(mat);
    }
  }
}
