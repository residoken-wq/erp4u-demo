import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UserGroup } from '../users/entities/user-group.entity';
import { GroupPermission } from '../users/entities/group-permission.entity';
import { SystemConfig } from '../system/system-config.entity';

@Injectable()
export class RbacSeedService implements OnModuleInit {
  private readonly logger = new Logger(RbacSeedService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit() {
    try {
      await this.runSeed();
    } catch (error) {
      this.logger.error('Failed to run RBAC Seed V1', error);
    }
  }

  async runSeed() {
    return this.dataSource.transaction(async (manager) => {
      // 1. Kiểm tra idempotent bằng key RBAC_SEED_V1
      const existingConfig = await manager.findOne(SystemConfig, {
        where: { key: 'RBAC_SEED_V1' },
      });

      if (existingConfig) {
        this.logger.log('RBAC_SEED_V1 already applied. Skipping seed.');
        return { applied: false, seedData: JSON.parse(existingConfig.value || '{}') };
      }

      this.logger.log('Starting RBAC Seed V1 (D1-D4, D7)...');

      const groups = await manager.find(UserGroup, {
        relations: ['permissions', 'users'],
        order: { id: 'ASC' },
      });

      const changes: Array<{
        group_id: number;
        group_name: string;
        from: string;
        to: string;
        flags: {
          can_view: boolean;
          can_create: boolean;
          can_update: boolean;
          can_delete: boolean;
          view_cost_price: boolean;
        };
      }> = [];

      const copyIfMissing = async (
        group: UserGroup,
        fromCode: string,
        toCode: string,
      ) => {
        const hasTarget = group.permissions?.some((p) => p.module_code === toCode);
        if (hasTarget) {
          return;
        }

        const sourcePerm = group.permissions?.find((p) => p.module_code === fromCode);
        if (!sourcePerm) {
          return;
        }

        const flags = {
          can_view: !!sourcePerm.can_view,
          can_create: !!sourcePerm.can_create,
          can_update: !!sourcePerm.can_update,
          can_delete: !!sourcePerm.can_delete,
          view_cost_price: !!sourcePerm.view_cost_price,
        };

        const newPerm = manager.create(GroupPermission, {
          group_id: group.id,
          module_code: toCode,
          ...flags,
        });

        await manager.save(GroupPermission, newPerm);

        changes.push({
          group_id: group.id,
          group_name: group.name,
          from: fromCode,
          to: toCode,
          flags,
        });
      };

      // 2. Chép quyền cho từng nhóm theo D1, D2, D3
      for (const group of groups) {
        await copyIfMissing(group, 'PRODUCTION', 'PURCHASE'); // D1
        await copyIfMissing(group, 'SALES', 'MARKETING');     // D2
        await copyIfMissing(group, 'USERS', 'SYSTEM');        // D3
      }

      // 3. D4: Tạo nhóm "Biên tập Website (CMS)" nếu chưa có
      const createdGroups: Array<{
        group_id: number;
        name: string;
        permissions: any[];
      }> = [];

      const existingCmsGroup = groups.find(
        (g) => g.name === 'Biên tập Website (CMS)',
      );

      if (!existingCmsGroup) {
        const cmsGroup = manager.create(UserGroup, {
          name: 'Biên tập Website (CMS)',
          description: 'Quyền sửa nội dung website qua localhost:3001',
        });
        const savedCmsGroup = await manager.save(UserGroup, cmsGroup);

        const cmsPerm = manager.create(GroupPermission, {
          group_id: savedCmsGroup.id,
          module_code: 'CMS',
          can_view: true,
          can_create: true,
          can_update: true,
          can_delete: true,
          view_cost_price: false,
        });
        await manager.save(GroupPermission, cmsPerm);

        createdGroups.push({
          group_id: savedCmsGroup.id,
          name: savedCmsGroup.name,
          permissions: [
            {
              module_code: 'CMS',
              can_view: true,
              can_create: true,
              can_update: true,
              can_delete: true,
              view_cost_price: false,
            },
          ],
        });
      }

      // 4. Danh sách nhóm có quyền HR (D7 audit info)
      const hrGroups = groups
        .map((g) => {
          const hrPerm = g.permissions?.find((p) => p.module_code === 'HR');
          if (
            hrPerm &&
            (hrPerm.can_view ||
              hrPerm.can_create ||
              hrPerm.can_update ||
              hrPerm.can_delete)
          ) {
            return {
              group_id: g.id,
              group_name: g.name,
              users_count: g.users?.length || 0,
              flags: {
                can_view: !!hrPerm.can_view,
                can_create: !!hrPerm.can_create,
                can_update: !!hrPerm.can_update,
                can_delete: !!hrPerm.can_delete,
                view_cost_price: !!hrPerm.view_cost_price,
              },
            };
          }
          return null;
        })
        .filter(Boolean);

      // 5. Lưu đánh dấu RBAC_SEED_V1 trong system_configs
      const seedRecord = {
        at: new Date().toISOString(),
        changes,
        created_groups: createdGroups,
        hr_groups: hrGroups,
      };

      const config = manager.create(SystemConfig, {
        key: 'RBAC_SEED_V1',
        value: JSON.stringify(seedRecord),
        description: 'RBAC v2 Phase 1 Seed Record (D1-D4, D7)',
      });
      await manager.save(SystemConfig, config);

      this.logger.log(
        `RBAC Seed V1 finished successfully. Created ${changes.length} permission entries and ${createdGroups.length} groups.`,
      );

      return { applied: true, seedData: seedRecord };
    });
  }
}
