import { DataSource } from 'typeorm';
import { Category } from '../../categories/category.entity';

export async function seedCategories(dataSource: DataSource) {
  const catRepo = dataSource.getRepository(Category);

  console.log('  -> Seeding Categories...');
  const categories = [
    { code: 'CAT_CARTON', name: 'Thùng & Hộp Carton', description: 'Bao bì hộp giấy, carton sóng 3 lớp, 5 lớp, 7 lớp' },
    { code: 'CAT_BAG', name: 'Túi Giấy & Túi Kraft', description: 'Túi giấy kraft môi trường, túi giấy ivory cao cấp, túi shopping' },
    { code: 'CAT_PLASTIC', name: 'Túi PE / Túi Nilon', description: 'Túi zipper, túi cuộn PE, túi xốp tự hủy sinh học' },
    { code: 'CAT_LABEL', name: 'Tem Nhãn & Decal', description: 'Decal giấy, decal nhựa chống nước, tem xi bạc, sticker' },
    { code: 'CAT_ACCESSORY', name: 'Phụ Liệu Đóng Gói', description: 'Băng keo, màng co PE, màng xốp nổ, nẹp góc' },
  ];

  for (const c of categories) {
    let cat = await catRepo.findOne({ where: { code: c.code } });
    if (!cat) {
      cat = catRepo.create(c);
      await catRepo.save(cat);
    }
  }
}
