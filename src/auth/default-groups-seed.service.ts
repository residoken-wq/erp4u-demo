import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantSeeder } from '../common/tenancy/tenant-seeder.interface';
import { UserGroup } from '../users/entities/user-group.entity';
import { GroupPermission } from '../users/entities/group-permission.entity';
import { DEFAULT_GROUP_TEMPLATES } from './default-group-templates';

@Injectable()
export class DefaultGroupsSeedService implements TenantSeeder {
  readonly name = 'default-groups-seed';
  private readonly logger = new Logger(DefaultGroupsSeedService.name);

  constructor(private readonly dataSource: DataSource) {}

  async seed(): Promise<void> {
    // In test environment, skip automatic boot seeding unless explicitly enabled,
    // so that integration test suites with custom fixtures are not affected.
    if (process.env.NODE_ENV === 'test' && process.env.SEED_DEFAULT_GROUPS !== 'true') {
      return;
    }

    const groupRepo = this.dataSource.getRepository(UserGroup);
    const permRepo = this.dataSource.getRepository(GroupPermission);

    const existingCount = await groupRepo.count();
    if (existingCount > 0) {
      this.logger.debug(
        `[default-groups-seed] Tenant already has ${existingCount} user groups. Skipping seed.`,
      );
      return;
    }

    this.logger.log(
      `[default-groups-seed] Seeding ${DEFAULT_GROUP_TEMPLATES.length} default group templates for fresh tenant...`,
    );

    for (const template of DEFAULT_GROUP_TEMPLATES) {
      const group = groupRepo.create({
        name: template.name,
        description: template.description,
      });
      const savedGroup = await groupRepo.save(group);

      const perms = template.permissions.map((p) =>
        permRepo.create({
          group_id: savedGroup.id,
          module_code: p.module_code,
          can_view: !!p.can_view,
          can_create: !!p.can_create,
          can_update: !!p.can_update,
          can_delete: !!p.can_delete,
          view_cost_price: !!p.view_cost_price,
        }),
      );
      await permRepo.save(perms);
    }

    this.logger.log('[default-groups-seed] Default group templates seeded successfully.');
  }
}
