import { DataSource } from 'typeorm';
import { UserGroup } from '../../users/entities/user-group.entity';
import { GroupPermission } from '../../users/entities/group-permission.entity';
import { SystemConfig } from '../../system/system-config.entity';

export async function seedSystem(dataSource: DataSource) {
  const groupRepo = dataSource.getRepository(UserGroup);
  const permRepo = dataSource.getRepository(GroupPermission);
  const configRepo = dataSource.getRepository(SystemConfig);

  console.log('  -> Seeding System Configs...');
  const configs = [
    { key: 'COMPANY_NAME', value: 'ERP4U Manufacturing Solutions Co., Ltd.' },
    { key: 'COMPANY_ADDRESS', value: 'Khu Công Nghiệp Tân Bình, P. Tây Thạnh, Q. Tân Phú, TP. Hồ Chí Minh' },
    { key: 'COMPANY_PHONE', value: '1900 6868' },
    { key: 'COMPANY_EMAIL', value: 'contact@erp4u.demo' },
    { key: 'COMPANY_TAX_CODE', value: '0318889999' },
    { key: 'DEFAULT_CURRENCY', value: 'VND' },
    { key: 'APP_VERSION', value: '1.0.0-demo' },
  ];

  for (const c of configs) {
    let item = await configRepo.findOne({ where: { key: c.key } });
    if (!item) {
      item = configRepo.create(c);
      await configRepo.save(item);
    }
  }

  console.log('  -> Seeding User Groups & Permissions...');
  const groupsData = [
    { name: 'Admin', description: 'Toàn quyền quản trị hệ thống ERP4U' },
    { name: 'Kinh Doanh', description: 'Quản lý bán hàng, báo giá, CRM khách hàng' },
    { name: 'Quản Lý Kho', description: 'Quản lý tồn kho nguyên vật liệu, thành phẩm, nhập xuất kho' },
    { name: 'Kế Toán', description: 'Quản lý thu chi, công nợ, hóa đơn, báo cáo tài chính' },
    { name: 'Nhân Sự', description: 'Quản lý nhân viên, chấm công, bảng lương, tuyển dụng' },
  ];

  const modules = ['SALES', 'PRODUCT', 'CUSTOMER', 'SUPPLIER', 'INVENTORY', 'PRODUCTION', 'PURCHASING', 'FINANCE', 'HR', 'SYSTEM'];

  for (const g of groupsData) {
    let group = await groupRepo.findOne({ where: { name: g.name } });
    if (!group) {
      group = groupRepo.create(g);
      group = await groupRepo.save(group);
    }

    for (const mod of modules) {
      let perm = await permRepo.findOne({ where: { module_code: mod, group_id: group.id } });
      if (!perm) {
        const isAdmin = g.name === 'Admin';
        const isSales = g.name === 'Kinh Doanh' && ['SALES', 'PRODUCT', 'CUSTOMER'].includes(mod);
        const isWarehouse = g.name === 'Quản Lý Kho' && ['INVENTORY', 'PRODUCT', 'SUPPLIER', 'PURCHASING'].includes(mod);
        const isFinance = g.name === 'Kế Toán' && ['FINANCE', 'CUSTOMER', 'SUPPLIER', 'SALES'].includes(mod);
        const isHr = g.name === 'Nhân Sự' && ['HR', 'SYSTEM'].includes(mod);

        const canAccess = isAdmin || isSales || isWarehouse || isFinance || isHr;

        perm = permRepo.create({
          module_code: mod,
          group_id: group.id,
          can_view: canAccess,
          can_create: isAdmin || isSales || isWarehouse || isFinance || isHr,
          can_update: isAdmin || isSales || isWarehouse || isFinance || isHr,
          can_delete: isAdmin,
          view_cost_price: isAdmin || isFinance || isWarehouse,
        });
        await permRepo.save(perm);
      }
    }
  }
}
