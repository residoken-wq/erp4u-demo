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
      code: 'KH-ECOPLAST',
      name: 'Công Ty Cổ Phần Bao Bì EcoPlast Sài Gòn',
      type: CustomerType.CUSTOMER,
      tax_code: '0317891234',
      phone: '0903123456',
      email: 'dat-hang@ecoplast-vn.com',
      legal_name: 'CÔNG TY CỔ PHẦN BAO BÌ ECOPLAST SÀI GÒN',
      legal_address: '120 Đường Số 7, KCN Vĩnh Lộc, H. Bình Chánh, TP. HCM',
      legal_representative: 'Ông Nguyễn Hoàng Hải',
      einvoice_email: 'ketoan@ecoplast-vn.com',
      address: '120 Đường Số 7, KCN Vĩnh Lộc, TP. HCM',
      province: 'Hồ Chí Minh',
      district: 'Bình Chánh',
      credit_limit: 150000000,
      potential_value: 300000000,
      lead_status: 'WON',
      contacts: [
        { full_name: 'Nguyễn Hoàng Hải', job_title: 'Tổng Giám Đốc', phone: '0903123456', email: 'hai.nh@ecoplast-vn.com' },
        { full_name: 'Lê Thị Thuỳ Dung', job_title: 'Trưởng Phòng Mua Hàng', phone: '0918776655', email: 'dung.lt@ecoplast-vn.com' },
      ],
    },
    {
      code: 'KH-GREENFOOD',
      name: 'Công Ty TNHH Thực Phẩm Xanh GreenFood',
      type: CustomerType.CUSTOMER,
      tax_code: '0316554433',
      phone: '0988776611',
      email: 'purchase@greenfood.vn',
      legal_name: 'CÔNG TY TNHH THỰC PHẨM XANH GREENFOOD',
      legal_address: '45 Lê Duẩn, P. Bến Nghé, Quận 1, TP. HCM',
      legal_representative: 'Bà Trần Kim Yến',
      einvoice_email: 'invoice@greenfood.vn',
      address: '45 Lê Duẩn, Quận 1, TP. HCM',
      province: 'Hồ Chí Minh',
      district: 'Quận 1',
      credit_limit: 80000000,
      potential_value: 120000000,
      lead_status: 'WON',
      contacts: [
        { full_name: 'Trần Kim Yến', job_title: 'Giám Đốc Vận Hành', phone: '0988776611', email: 'yen.tk@greenfood.vn' },
      ],
    },
    {
      code: 'KH-FASHION-SUN',
      name: 'Thương Hiệu Thời Trang SunStyle',
      type: CustomerType.CUSTOMER,
      tax_code: '0109887766',
      phone: '0977665544',
      email: 'packaging@sunstyle.vn',
      legal_name: 'CÔNG TY CP THỜI TRANG SUNSTYLE VIỆT NAM',
      legal_address: '88 Thái Hà, Đống Đa, Hà Nội',
      legal_representative: 'Ông Đặng Quốc Tuấn',
      einvoice_email: 'acc@sunstyle.vn',
      address: '88 Thái Hà, Đống Đa, Hà Nội',
      province: 'Hà Nội',
      district: 'Đống Đa',
      credit_limit: 200000000,
      potential_value: 500000000,
      lead_status: 'WON',
      contacts: [
        { full_name: 'Đặng Quốc Tuấn', job_title: 'Giám Đốc Kinh Doanh', phone: '0977665544', email: 'tuan.dq@sunstyle.vn' },
      ],
    },
    {
      code: 'LEAD-COFFEE-ROAST',
      name: 'Chuỗi Cà Phê Mộc Artisan Coffee',
      type: CustomerType.LEAD,
      tax_code: '0319223344',
      phone: '0933112233',
      email: 'artisan@mochicoffee.com',
      legal_name: 'HỘ KINH DOANH ARTISAN COFFEE',
      legal_address: '15 Thảo Điền, TP. Thủ Đức, TP. HCM',
      legal_representative: 'Bà Vũ Minh Trang',
      einvoice_email: 'artisan@mochicoffee.com',
      address: '15 Thảo Điền, TP. Thủ Đức, TP. HCM',
      province: 'Hồ Chí Minh',
      district: 'Thủ Đức',
      credit_limit: 0,
      potential_value: 65000000,
      lead_status: 'QUALIFIED',
      contacts: [
        { full_name: 'Vũ Minh Trang', job_title: 'Founder & CEO', phone: '0933112233', email: 'trang.vm@mochicoffee.com' },
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
