import { DataSource, DeepPartial } from 'typeorm';
import { Supplier, SupplierType } from '../../suppliers/supplier.entity';
import { SupplierContact } from '../../suppliers/supplier-contact.entity';

export async function seedSuppliers(dataSource: DataSource) {
  const supRepo = dataSource.getRepository(Supplier);
  const contactRepo = dataSource.getRepository(SupplierContact);

  console.log('  -> Seeding Suppliers & Contacts (Encrypted)...');
  const suppliersData = [
    {
      code: 'NCC-MAU-01',
      name: 'Nhà cung cấp Mẫu 01',
      type: SupplierType.MATERIAL,
      tax_code: '0000000011',
      phone: '0280000001',
      email: 'kinhdoanh@example.com',
      legal_name: 'CÔNG TY CỔ PHẦN CUNG ỨNG VẬT TƯ MẪU 01',
      address: 'Số 11 Đường Mẫu, Quận Mẫu, TP. Mẫu',
      note: 'Nhà cung cấp giấy cuộn Kraft mẫu, cấp hạn mức nợ 30 ngày',
      contacts: [
        { full_name: 'Người Liên Hệ Demo 11', job_title: 'Giám Đốc Bán Hàng', phone_number: '0900000021', email: 'sales-ncc1@example.com' },
      ],
    },
    {
      code: 'NCC-MAU-02',
      name: 'Nhà cung cấp Mẫu 02',
      type: SupplierType.MATERIAL,
      tax_code: '0000000012',
      phone: '0280000002',
      email: 'orders@example.com',
      legal_name: 'CÔNG TY TNHH VẬT TƯ HÓA CHẤT MẪU 02',
      address: 'Số 12 Đường Mẫu, Quận Mẫu, TP. Mẫu',
      note: 'Cung cấp mực in Offset và hóa chất ngành in chất lượng cao đạt chuẩn RoHS',
      contacts: [
        { full_name: 'Người Liên Hệ Demo 12', job_title: 'Trưởng Phòng Kinh Doanh', phone_number: '0900000022', email: 'sales-ncc2@example.com' },
      ],
    },
    {
      code: 'NCC-LOGISTICS-01',
      name: 'Công ty Vận chuyển Mẫu',
      type: SupplierType.LOGISTICS,
      tax_code: '0000000013',
      phone: '19000000',
      email: 'support@example.com',
      legal_name: 'CÔNG TY CỔ PHẦN VẬN TẢI TIẾP VẬN MẪU',
      address: 'Số 13 Đường Mẫu, Quận Mẫu, TP. Mẫu',
      note: 'Đối tác xe tải 2.5T - 8T giao hàng thành phẩm tới các KCN lân cận',
      contacts: [
        { full_name: 'Người Liên Hệ Demo 13', job_title: 'Điều Phối Xe Hàng', phone_number: '0900000023', email: 'vanchuyen@example.com' },
      ],
    },
  ];

  for (const s of suppliersData) {
    let sup = await supRepo.findOne({ where: { code: s.code } });
    if (!sup) {
      const { contacts, ...supFields } = s;
      sup = supRepo.create(supFields as DeepPartial<Supplier>);
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
