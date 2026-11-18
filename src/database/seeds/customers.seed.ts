import { DataSource } from 'typeorm';
import { Customer, CustomerType } from '../../customers/customer.entity';
import { CustomerContact } from '../../customers/customer-contact.entity';
import { User } from '../../users/entities/user.entity';

export async function seedCustomers(dataSource: DataSource) {
  const custRepo = dataSource.getRepository(Customer);
  const contactRepo = dataSource.getRepository(CustomerContact);
  const userRepo = dataSource.getRepository(User);

  console.log('  -> Seeding Customers & Contacts (Encrypted)...');
  const salesUser = await userRepo.findOne({ where: { username: 'sales01' } });

  const customersData = [
    {
      code: 'KH-DEMO-01',
      name: 'Công ty Khách hàng Mẫu A',
      type: CustomerType.CUSTOMER,
      tax_code: '0000000001',
      phone: '0900000001',
      email: 'khachhang-a@example.com',
      legal_name: 'CÔNG TY KHÁCH HÀNG MẪU A',
      legal_address: 'Số 1 Đường Mẫu, Quận Mẫu, TP. Mẫu',
      legal_representative: 'Đại Diện Demo 01',
      einvoice_email: 'ketoan-a@example.com',
      address: 'Số 1 Đường Mẫu, Quận Mẫu, TP. Mẫu',
      province: 'TP. Mẫu',
      district: 'Quận Mẫu',
      credit_limit: 150000000,
      potential_value: 300000000,
      lead_status: 'WON',
      contacts: [
        { full_name: 'Người Liên Hệ Demo 01', job_title: 'Tổng Giám Đốc', phone: '0900000001', email: 'giamdoc-a@example.com' },
        { full_name: 'Người Liên Hệ Demo 02', job_title: 'Trưởng Phòng Mua Hàng', phone: '0900000004', email: 'muahang-a@example.com' },
      ],
    },
    {
      code: 'KH-DEMO-02',
      name: 'Công ty Khách hàng Mẫu B',
      type: CustomerType.CUSTOMER,
      tax_code: '0000000002',
      phone: '0900000005',
      email: 'khachhang-b@example.com',
      legal_name: 'CÔNG TY KHÁCH HÀNG MẪU B',
      legal_address: 'Số 2 Đường Mẫu, Quận Mẫu, TP. Mẫu',
      legal_representative: 'Đại Diện Demo 02',
      einvoice_email: 'invoice-b@example.com',
      address: 'Số 2 Đường Mẫu, Quận Mẫu, TP. Mẫu',
      province: 'TP. Mẫu',
      district: 'Quận Mẫu',
      credit_limit: 80000000,
      potential_value: 120000000,
      lead_status: 'WON',
      contacts: [
        { full_name: 'Người Liên Hệ Demo 03', job_title: 'Giám Đốc Vận Hành', phone: '0900000005', email: 'vanhanh-b@example.com' },
      ],
    },
    {
      code: 'KH-DEMO-03',
      name: 'Doanh Nghiệp Mẫu C',
      type: CustomerType.CUSTOMER,
      tax_code: '0000000003',
      phone: '0900000006',
      email: 'khachhang-c@example.com',
      legal_name: 'CÔNG TY DOANH NGHIỆP MẪU C',
      legal_address: 'Số 3 Đường Mẫu, Quận Mẫu, TP. Mẫu',
      legal_representative: 'Đại Diện Demo 03',
      einvoice_email: 'acc-c@example.com',
      address: 'Số 3 Đường Mẫu, Quận Mẫu, TP. Mẫu',
      province: 'TP. Mẫu',
      district: 'Quận Mẫu',
      credit_limit: 200000000,
      potential_value: 500000000,
      lead_status: 'WON',
      contacts: [
        { full_name: 'Người Liên Hệ Demo 04', job_title: 'Giám Đốc Kinh Doanh', phone: '0900000006', email: 'kinhdoanh-c@example.com' },
      ],
    },
    {
      code: 'LEAD-DEMO-01',
      name: 'Hộ kinh doanh Mẫu B',
      type: CustomerType.LEAD,
      tax_code: '0000000004',
      phone: '0900000007',
      email: 'lead-b@example.com',
      legal_name: 'HỘ KINH DOANH MẪU B',
      legal_address: 'Số 4 Đường Mẫu, Quận Mẫu, TP. Mẫu',
      legal_representative: 'Đại Diện Demo 04',
      einvoice_email: 'lead-b@example.com',
      address: 'Số 4 Đường Mẫu, Quận Mẫu, TP. Mẫu',
      province: 'TP. Mẫu',
      district: 'Quận Mẫu',
      credit_limit: 0,
      potential_value: 65000000,
      lead_status: 'QUALIFIED',
      contacts: [
        { full_name: 'Người Liên Hệ Demo 05', job_title: 'Chủ Hộ Kinh Doanh', phone: '0900000007', email: 'chuho-b@example.com' },
      ],
    },
  ];

  for (const c of customersData) {
    let cust = await custRepo.findOne({ where: { code: c.code } });
    if (!cust) {
      const { contacts, ...custFields } = c;
      cust = custRepo.create({
        ...custFields,
        assigned_to_id: salesUser?.id,
      });
      cust = await custRepo.save(cust);

      if (contacts && contacts.length > 0) {
        for (const ct of contacts) {
          const contact = contactRepo.create({
            ...ct,
            customer: cust,
          });
          await contactRepo.save(contact);
        }
      }
    }
  }
}
