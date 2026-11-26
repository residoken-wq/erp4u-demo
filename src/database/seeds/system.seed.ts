import { DataSource } from 'typeorm';
import { UserGroup } from '../../users/entities/user-group.entity';
import { GroupPermission } from '../../users/entities/group-permission.entity';
import { SystemConfig } from '../../system/system-config.entity';
import { DEFAULT_GROUP_TEMPLATES } from '../../auth/default-group-templates';

export async function seedSystem(dataSource: DataSource) {
  const groupRepo = dataSource.getRepository(UserGroup);
  const permRepo = dataSource.getRepository(GroupPermission);
  const configRepo = dataSource.getRepository(SystemConfig);

  console.log('  -> Seeding System Configs...');
  const configs = [
    { key: 'COMPANY_NAME', value: 'ERP4U Manufacturing Solutions Co., Ltd.' },
    { key: 'COMPANY_ADDRESS', value: 'Số 1 Đường Mẫu, Quận Mẫu, TP. Mẫu' },
    { key: 'COMPANY_PHONE', value: '1900 0000' },
    { key: 'COMPANY_EMAIL', value: 'contact@example.com' },
    { key: 'COMPANY_TAX_CODE', value: '0000000000' },
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

  console.log('  -> Seeding User Groups & Permissions (Default Templates)...');
  for (const template of DEFAULT_GROUP_TEMPLATES) {
    let group = await groupRepo.findOne({ where: { name: template.name } });
    if (!group) {
      group = groupRepo.create({
        name: template.name,
        description: template.description,
      });
      group = await groupRepo.save(group);
    }

    for (const p of template.permissions) {
      let perm = await permRepo.findOne({ where: { module_code: p.module_code, group_id: group.id } });
      if (!perm) {
        perm = permRepo.create({
          module_code: p.module_code,
          group_id: group.id,
          can_view: !!p.can_view,
          can_create: !!p.can_create,
          can_update: !!p.can_update,
          can_delete: !!p.can_delete,
          view_cost_price: !!p.view_cost_price,
        });
        await permRepo.save(perm);
      }
    }
  }
}
