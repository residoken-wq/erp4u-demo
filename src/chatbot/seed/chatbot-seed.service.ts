import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UserGroup } from '../../users/entities/user-group.entity';
import { GroupPermission } from '../../users/entities/group-permission.entity';
import { SystemConfig } from '../../system/system-config.entity';
import { PermissionCacheService } from '../../auth/permission-cache.service';

function formatFlags(flags: {
  can_view: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
  view_cost_price: boolean;
}): string {
  return [
    flags.can_view ? 'V' : '-',
    flags.can_create ? 'C' : '-',
    flags.can_update ? 'U' : '-',
    flags.can_delete ? 'D' : '-',
    flags.view_cost_price ? '$' : '-',
  ].join('');
}

@Injectable()
export class ChatbotSeedService implements OnModuleInit {
  private readonly logger = new Logger(ChatbotSeedService.name);

  constructor(
    private readonly dataSource: DataSource,
    @Optional()
    private readonly permCacheService?: PermissionCacheService,
  ) {}

  async onModuleInit() {
    try {
      await this.runSeed();
    } catch (err: any) {
      this.logger.error(`Failed to run Chatbot Seed V1: ${err?.message}`);
    }
  }

  async runSeed() {
    return this.dataSource.transaction(async (manager) => {
      // 1. Idempotency check via system_configs.CHATBOT_SEED_V1
      const existingConfig = await manager.findOne(SystemConfig, {
        where: { key: 'CHATBOT_SEED_V1' },
      });

      if (existingConfig) {
        this.logger.log('CHATBOT_SEED_V1 already applied. Skipping seed.');
        return { applied: false, seedData: JSON.parse(existingConfig.value || '{}') };
      }

      this.logger.log('Starting Chatbot Seed V1 (copy permissions from SALES to CHATBOT)...');

      const groups = await manager.find(UserGroup, {
        relations: ['permissions'],
        order: { id: 'ASC' },
      });

      const changes: Array<{
        group_id: number;
        group_name: string;
        flags: string;
      }> = [];

      for (const group of groups) {
        const hasChatbot = group.permissions?.some((p) => p.module_code === 'CHATBOT');
        if (hasChatbot) {
          continue;
        }

        const salesPerm = group.permissions?.find((p) => p.module_code === 'SALES');
        if (!salesPerm) {
          continue;
        }

        const flags = {
          can_view: !!salesPerm.can_view,
          can_create: !!salesPerm.can_create,
          can_update: !!salesPerm.can_update,
          can_delete: !!salesPerm.can_delete,
          view_cost_price: !!salesPerm.view_cost_price,
        };

        const newPerm = manager.create(GroupPermission, {
          group_id: group.id,
          module_code: 'CHATBOT',
          ...flags,
        });
        await manager.save(GroupPermission, newPerm);

        changes.push({
          group_id: group.id,
          group_name: group.name,
          flags: formatFlags(flags),
        });
      }

      const seedRecord = {
        at: new Date().toISOString(),
        changes,
      };

      const config = manager.create(SystemConfig, {
        key: 'CHATBOT_SEED_V1',
        value: JSON.stringify(seedRecord),
        description: 'Chatbot P0 Seed Record (Copy SALES to CHATBOT)',
      });
      await manager.save(SystemConfig, config);

      if (this.permCacheService) {
        this.permCacheService.invalidateGroup();
      }

      this.logger.log(
        `Chatbot Seed V1 finished successfully. Created ${changes.length} CHATBOT permission entries.`,
      );

      return { applied: true, seedData: seedRecord };
    });
  }
}
