import { DataSource } from 'typeorm';
import { Supplier, SupplierType } from '../../suppliers/supplier.entity';
import { SupplierContact } from '../../suppliers/supplier-contact.entity';

export async function seedSuppliers(dataSource: DataSource) {
  const supRepo = dataSource.getRepository(Supplier);
  const contactRepo = dataSource.getRepository(SupplierContact);

  console.log('  -> Seeding Suppliers & Contacts (Encrypted)...');
  const suppliersData = [
    {
      code: 'NCC-PAPER-VT',
      name: 'Nhà Máy Giấy Việt Trì Pulp & Paper',
      type: SupplierType.MATERIAL,
      tax_code: '2600123456',
      phone: '02103846200',
      email: 'kinhdoanh@viettripaper.vn',
      legal_name: 'CÔNG TY CỔ PHẦN GIẤY VIỆT TRÌ',
      address: 'P. Bến Gót, TP. Việt Trì, Tỉnh Phú Thọ',
      note: 'Nhà cung cấp giấy cuộn Kraft hàng đầu miền Bắc, cấp hạn mức nợ 30 ngày',
      contacts: [
        { full_name: 'Nguyễn Tiến Dũng', job_title: 'Giám Đốc Bán Hàng Công Nghiệp', phone_number: '0912345678', email: 'dung.nt@viettripaper.vn' },
      ],
    },
    {
      code: 'NCC-INK-DIC',
      name: 'Tập Đoàn Mực In DIC Printing Chemicals VN',
      type: SupplierType.MATERIAL,
      tax_code: '3700445566',
      phone: '02743782555',
      email: 'orders-vn@dic.com.vn',
      legal_name: 'CÔNG TY TNHH DIC VIỆT NAM',
      address: 'KCN VSIP 1, Thuận An, Bình Dương',
      note: 'Cung cấp mực in Offset và hóa chất ngành in chất lượng cao đạt chuẩn RoHS',
      contacts: [
        { full_name: 'Trần Văn Nam', job_title: 'Trưởng Phòng Kinh Doanh Phía Nam', phone_number: '0908998877', email: 'nam.tv@dic.com.vn' },
      ],
    },
    {
      code: 'NCC-LOGISTICS-VN',
      name: 'Vận Tải & Giao Nhận Siêu Tốc Express',
      type: SupplierType.LOGISTICS,
      tax_code: '0315998877',
      phone: '1900545432',
      email: 'support@sieutoclogistics.vn',
      legal_name: 'CÔNG TY CP TIẾP VẬN VÀ GIAO NHẬN SIÊU TỐC',
      address: 'Kho K1, Cảng Cát Lái, P. Cát Lái, TP. Thủ Đức',
      note: 'Đối tác xe tải 2.5T - 8T giao hàng thành phẩm tới các KCN lân cận',
      contacts: [
        { full_name: 'Lê Thành Đạt', job_title: 'Điều Phối Xe Hàng', phone_number: '0938554433', email: 'dat.lt@sieutoclogistics.vn' },
      ],
    },
  ];

  for (const s of suppliersData) {
    let sup = await supRepo.findOne({ where: { code: s.code } });
    if (!sup) {
      const { contacts, ...supFields } = s;
      sup = supRepo.create(supFields as any);
      sup = await supRepo.save(sup);

      if (contacts && contacts.length > 0) {
        for (const ct of contacts) {
          const contact = contactRepo.create({
            ...ct,
            supplier: sup,
          });
          await contactRepo.save(contact);
        }
      }
    }
  }
}
