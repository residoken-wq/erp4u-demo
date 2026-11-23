import { Injectable, ForbiddenException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import {
  ENTITLEMENT_PROVIDER,
  EntitlementProvider,
} from '../common/packages/entitlement-provider.interface';
import { PackageKey } from '../common/packages/package.registry';

export interface UserQuotaUsage {
  used: number;
  max: number | null;
}

@Injectable()
export class UserQuotaService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @Inject(ENTITLEMENT_PROVIDER)
    private readonly entitlementProvider: EntitlementProvider,
  ) {}

  /**
   * Retrieves max_users limit from CORE package limits.
   * A missing value, null, non-number, non-integer, or non-positive value (<= 0) means unlimited (null).
   */
  async getMaxUsers(): Promise<number | null> {
    const limits = await this.entitlementProvider.getLimits(PackageKey.CORE);
    const rawMax = limits?.max_users;
    if (typeof rawMax === 'number' && Number.isInteger(rawMax) && rawMax > 0) {
      return rawMax;
    }
    return null;
  }

  /**
   * Returns current active user count and max user limit.
   */
  async getUsage(manager?: EntityManager): Promise<UserQuotaUsage> {
    const max = await this.getMaxUsers();
    const repo = manager ? manager.getRepository(User) : this.userRepo;
    const used = await repo.count({ where: { is_active: true } });
    return { used, max };
  }

  /**
   * Checks whether adding or activating a user would exceed the max_users limit.
   * Throws ForbiddenException when used >= max.
   */
  async assertQuota(manager?: EntityManager): Promise<void> {
    const { used, max } = await this.getUsage(manager);
    if (max !== null && used >= max) {
      throw new ForbiddenException({
        code: 'USER_LIMIT_REACHED',
        message: `Đã đạt số người dùng tối đa của gói (${used}/${max}). Liên hệ quản trị để nâng cấp gói.`,
      });
    }
  }
}
