import { EventSubscriber, EntitySubscriberInterface, InsertEvent, UpdateEvent, RemoveEvent, DataSource } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { ActivityLog } from '../entities/activity-log.entity';
import { UserContextService } from '../../common/services/user-context.service';

@Injectable()
@EventSubscriber()
export class ActivitySubscriber implements EntitySubscriberInterface {
    constructor(@InjectDataSource() readonly dataSource: DataSource) {
        dataSource.subscribers.push(this);
    }

    // Dropped listenTo() so TypeORM listens to all entities.

    async afterInsert(event: InsertEvent<any>) {
        if (!this.shouldLog(event.metadata.targetName)) return;

        const user = UserContextService.getUser();
        await this.logActivity(event.manager, 'CREATE', event.metadata.tableName, event.entity.id, user, null, event.entity);
    }

    async afterUpdate(event: UpdateEvent<any>) {
        if (!this.shouldLog(event.metadata.targetName)) return;

        const user = UserContextService.getUser();

        // Calculate Diff
        const diff = this.calculateDiff(event.databaseEntity, event.entity, event.updatedColumns);

        if (Object.keys(diff.new).length > 0) {
            await this.logActivity(event.manager, 'UPDATE', event.metadata.tableName, event.databaseEntity.id, user, diff, null);
        }
    }

    async afterRemove(event: RemoveEvent<any>) {
        if (!this.shouldLog(event.metadata.targetName)) return;
        const user = UserContextService.getUser();
        await this.logActivity(event.manager, 'DELETE', event.metadata.tableName, event.databaseEntity?.id, user, null, null);
    }

    private shouldLog(targetName: any): boolean {
        // Exclude ActivityLog and maybe others
        const name = typeof targetName === 'function' ? targetName.name : targetName;
        if (name === 'ActivityLog' || name === 'SystemConfig' || name === 'AnalyticsVisitor') return false;
        return true;
    }

    private calculateDiff(oldEntity: any, newEntity: any, updatedColumns: any[]) {
        const oldValue: any = {};
        const newValue: any = {};

        updatedColumns.forEach(col => {
            const prop = col.propertyName;
            // Skip timestamps if managed automatically and not business logic
            if (prop === 'updated_at') return;

            const vOld = oldEntity[prop];
            const vNew = newEntity[prop];

            // Simple strict equality check. Warning: Date objects might need special handling.
            if (JSON.stringify(vOld) !== JSON.stringify(vNew)) {
                oldValue[prop] = vOld;
                newValue[prop] = vNew;
            }
        });

        return { old: oldValue, new: newValue };
    }

    private async logActivity(manager: any, action: string, module: string, entityId: any, user: any, details: any, fullNewEntity: any) {
        try {
            const repo = manager.getRepository(ActivityLog);

            // If Create, we might just store a summary or key fields
            let desc = '';
            if (action === 'CREATE') {
                desc = `Created ${module} #${entityId}`;
            } else if (action === 'UPDATE') {
                const keys = Object.keys(details.new).join(', ');
                desc = `Updated ${module} #${entityId}: ${keys}`;
            } else {
                desc = `Deleted ${module} #${entityId}`;
            }

            await repo.save({
                action,
                module: module.toUpperCase(),
                entity_id: String(entityId),
                user_id: user?.id || null,
                username: user?.username || 'System',
                full_name: user?.full_name || user?.username || 'System',
                description: desc,
                details: action === 'UPDATE' ? details : (fullNewEntity ? { new: fullNewEntity } : null)
            }, { listeners: false });
        } catch (e) {
            console.error('Logging Failed', e);
        }
    }
}
