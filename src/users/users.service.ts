import { Injectable, BadRequestException, NotFoundException, ForbiddenException, Inject, forwardRef, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserGroup } from './entities/user-group.entity';
import { GroupPermission } from './entities/group-permission.entity';
import { PermissionCacheService } from '../auth/permission-cache.service';
import { DemoModeService } from '../common/services/demo-mode.service';
import { UsageService } from '../common/packages/usage.service';
import { UserQuotaService } from './user-quota.service';
import { assertPermission } from '../auth/rbac-assert.helper';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(UserGroup) private groupRepo: Repository<UserGroup>,
    @InjectRepository(GroupPermission) private permRepo: Repository<GroupPermission>,
    @Inject(forwardRef(() => PermissionCacheService))
    private permCacheService: PermissionCacheService,
    private readonly demoModeService: DemoModeService,
    @Optional() private readonly usageService?: UsageService,
    @Optional() private readonly quotaService?: UserQuotaService,
    @Optional() private readonly dataSource?: DataSource,
  ) {
  }

  // --- USER MANAGEMENT ---
  async getAllUsers() {
    return this.userRepo.find({ relations: ['group'], order: { id: 'DESC' } });
  }

  async createUser(data: any) {
    const executeInManager = async (manager: EntityManager) => {
      if (this.dataSource?.options?.type === 'postgres') {
        try {
          await manager.query(
            "SELECT pg_advisory_xact_lock(hashtext('user_quota:' || current_schema()))",
          );
        } catch {
          // Fallback if advisory lock fails (e.g. non-postgres or mock)
        }
      }

      const willBeActive = data.is_active !== false;
      if (willBeActive && this.quotaService) {
        await this.quotaService.assertQuota(manager);
      }

      const repo = manager.getRepository(User);
      const existing = await repo.findOne({ where: { username: data.username } });
      if (existing) throw new BadRequestException('Tên đăng nhập đã tồn tại');

      // Hash password
      const hashedPassword = await bcrypt.hash(data.password, 10);
      const user = repo.create({ ...data, password: hashedPassword });
      const saved = await repo.save(user);
      await this.usageService?.increment('users_created');
      return saved;
    };

    if (this.dataSource?.transaction) {
      return await this.dataSource.transaction(executeInManager);
    }

    // Fallback if dataSource is not injected (e.g. unit tests with mockUserRepo)
    const willBeActive = data.is_active !== false;
    if (willBeActive && this.quotaService) {
      await this.quotaService.assertQuota();
    }
    const existing = await this.userRepo.findOne({ where: { username: data.username } });
    if (existing) throw new BadRequestException('Tên đăng nhập đã tồn tại');

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const user = this.userRepo.create({ ...data, password: hashedPassword });
    const saved = await this.userRepo.save(user);
    await this.usageService?.increment('users_created');
    return saved;
  }

  async updateUser(id: number, data: any, actor?: any) {
    const isActorAdmin = actor?.username === 'admin';
    const isSelf = actor && Number(id) === Number(actor.id);

    if (actor && !isActorAdmin) {
      // 1. không được đổi username thành admin -> 403
      if (data.username && typeof data.username === 'string' && data.username.toLowerCase() === 'admin') {
        throw new ForbiddenException('Không thể đổi tên đăng nhập thành admin');
      }
      // 2. không được gán group_id cho chính mình (chặn tự nâng quyền) -> 403
      if (isSelf && (data.group_id !== undefined || data.groupId !== undefined || data.group !== undefined)) {
        throw new ForbiddenException('Không thể tự thay đổi nhóm quyền của chính mình');
      }
    }

    // Bỏ qua các trường không cho phép trong body (password không được đổi qua route này)
    const sanitizedData = { ...data };
    delete sanitizedData.password;
    delete sanitizedData.id;
    if (sanitizedData.group) {
      delete sanitizedData.group;
    }
    if (sanitizedData.groupId !== undefined && sanitizedData.group_id === undefined) {
      sanitizedData.group_id = sanitizedData.groupId;
      delete sanitizedData.groupId;
    }

    const executeInManager = async (manager: EntityManager) => {
      const repo = manager.getRepository(User);
      const user = await repo.findOne({ where: { id } });
      if (!user) throw new NotFoundException('User not found');

      if (this.demoModeService.isDemoMode() && this.demoModeService.isDemoUser(user.username)) {
        if (data.password || data.group_id !== undefined || data.groupId !== undefined || data.group !== undefined) {
          throw new ForbiddenException('Không được phép trên bản demo');
        }
      }

      // người không phải admin không được sửa user admin -> 403
      if (actor && !isActorAdmin && user.username === 'admin') {
        throw new ForbiddenException('Không có quyền chỉnh sửa tài khoản admin');
      }

      const isActivating = !user.is_active && sanitizedData.is_active === true;
      if (isActivating) {
        if (this.dataSource?.options?.type === 'postgres') {
          try {
            await manager.query(
              "SELECT pg_advisory_xact_lock(hashtext('user_quota:' || current_schema()))",
            );
          } catch {
            // Fallback
          }
        }
        if (this.quotaService) {
          await this.quotaService.assertQuota(manager);
        }
      }

      await repo.update(id, sanitizedData);
      return repo.findOne({ where: { id }, relations: ['group'] });
    };

    if (this.dataSource?.transaction) {
      return await this.dataSource.transaction(executeInManager);
    }

    // Fallback if dataSource is not injected
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    if (this.demoModeService.isDemoMode() && this.demoModeService.isDemoUser(user.username)) {
      if (data.password || data.group_id !== undefined || data.groupId !== undefined || data.group !== undefined) {
        throw new ForbiddenException('Không được phép trên bản demo');
      }
    }

    // người không phải admin không được sửa user admin -> 403
    if (actor && !isActorAdmin && user.username === 'admin') {
      throw new ForbiddenException('Không có quyền chỉnh sửa tài khoản admin');
    }

    const isActivating = !user.is_active && sanitizedData.is_active === true;
    if (isActivating && this.quotaService) {
      await this.quotaService.assertQuota();
    }

    await this.userRepo.update(id, sanitizedData);
    return this.userRepo.findOne({ where: { id }, relations: ['group'] });
  }

  async deleteUser(id: number, actor?: any) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) return;
    if (this.demoModeService.isDemoMode() && this.demoModeService.isDemoUser(user.username)) {
      throw new ForbiddenException('Không được phép trên bản demo');
    }
    if (user.username === 'admin') {
      throw new ForbiddenException('Không thể xóa tài khoản admin');
    }
    return this.userRepo.delete(id);
  }

  async changePassword(id: number, data: any, actor?: any) {
    let user: User | null = null;
    if (typeof this.userRepo.createQueryBuilder === 'function') {
      user = await this.userRepo.createQueryBuilder('user')
        .addSelect('user.password')
        .leftJoinAndSelect('user.group', 'group')
        .where('user.id = :id', { id })
        .getOne();
    } else {
      user = await this.userRepo.findOne({ where: { id } });
    }
    if (!user) throw new NotFoundException('User not found');

    if (this.demoModeService.isDemoMode() && this.demoModeService.isDemoUser(user.username)) {
      throw new ForbiddenException('Không được phép trên bản demo');
    }

    const newPass = typeof data === 'string' ? data : data?.password;
    const currentPass = typeof data === 'object' ? data?.current_password : undefined;

    if (!newPass || typeof newPass !== 'string' || newPass.length < 8) {
      throw new BadRequestException('Mật khẩu mới phải có ít nhất 8 ký tự');
    }

    if (actor) {
      const isSelf = Number(id) === Number(actor.id);
      const isActorAdmin = actor.username === 'admin';

      if (isSelf) {
        if (!currentPass || typeof currentPass !== 'string') {
          throw new BadRequestException('Vui lòng nhập mật khẩu hiện tại');
        }
        const matches = user.password && (await bcrypt.compare(currentPass, user.password));
        if (!matches) {
          throw new BadRequestException('Mật khẩu hiện tại không chính xác');
        }
      } else {
        await assertPermission(actor, this.permCacheService, 'USERS', 'update');

        if (user.username === 'admin' && !isActorAdmin) {
          throw new ForbiddenException('Không có quyền đổi mật khẩu của tài khoản admin');
        }

        if (!isActorAdmin) {
          const targetGroupId = user.group_id || user.group?.id;
          if (targetGroupId && this.permCacheService) {
            const hasUsersUpdate = await this.permCacheService.hasAny(targetGroupId, [
              { module: 'USERS', action: 'update' },
            ]);
            if (hasUsersUpdate) {
              throw new ForbiddenException('Không có quyền đổi mật khẩu của tài khoản quản trị người dùng');
            }
          }
        }
      }
    }

    user.password = await bcrypt.hash(newPass, 10);
    const saved = await this.userRepo.save(user);
    delete (saved as any).password;
    return saved;
  }

  async getOnlineUsers() {
    const timeLimit = new Date(Date.now() - 15 * 60 * 1000); // 15 mins
    return this.userRepo.createQueryBuilder('user')
      .leftJoinAndSelect('user.group', 'group')
      .where('user.last_activity_at > :timeLimit', { timeLimit })
      .orderBy('user.last_activity_at', 'DESC')
      .getMany();
  }

  // --- GROUP & PERMISSION MANAGEMENT ---
  async getAllGroups() {
    return this.groupRepo.find({ order: { id: 'ASC' }, relations: ['permissions'] });
  }

  async getGroupDetail(id: number) {
    return this.groupRepo.findOne({ where: { id }, relations: ['permissions'] });
  }

  async assertPermissionsNotExceedingActor(actorGroupId: number | undefined, targetPermissions: any[]): Promise<void> {
    const actorPerms = actorGroupId
      ? await this.permRepo.find({ where: { group_id: actorGroupId } })
      : [];

    for (const p of targetPermissions) {
      const mod = p.module_code || p.moduleCode;
      const actorPerm = actorPerms.find((ap) => ap.module_code === mod);

      if (p.can_view && !actorPerm?.can_view) {
        throw new ForbiddenException(
          `Bạn không có quyền xem (can_view) trong module "${mod}" để cấp cho nhóm khác`,
        );
      }
      if (p.can_create && !actorPerm?.can_create) {
        throw new ForbiddenException(
          `Bạn không có quyền tạo (can_create) trong module "${mod}" để cấp cho nhóm khác`,
        );
      }
      if (p.can_update && !actorPerm?.can_update) {
        throw new ForbiddenException(
          `Bạn không có quyền sửa (can_update) trong module "${mod}" để cấp cho nhóm khác`,
        );
      }
      if (p.can_delete && !actorPerm?.can_delete) {
        throw new ForbiddenException(
          `Bạn không có quyền xoá (can_delete) trong module "${mod}" để cấp cho nhóm khác`,
        );
      }
      if (p.view_cost_price && !actorPerm?.view_cost_price) {
        throw new ForbiddenException(
          `Bạn không có quyền xem giá vốn (view_cost_price) trong module "${mod}" để cấp cho nhóm khác`,
        );
      }
    }
  }

  async createGroup(data: any, actor?: any) {
    if (actor && actor.username !== 'admin') {
      const actorGroupId = actor.groupId || actor.group_id;
      if (data.permissions && Array.isArray(data.permissions) && data.permissions.length > 0) {
        await this.assertPermissionsNotExceedingActor(actorGroupId, data.permissions);
      }
    }

    const group = this.groupRepo.create({ name: data.name, description: data.description });
    const saved = await this.groupRepo.save(group);

    if (data.permissions && data.permissions.length > 0) {
      const permObjects = data.permissions.map((p: any) => ({
        ...p,
        group_id: saved.id
      }));

      const perms = this.permRepo.create(permObjects);
      await this.permRepo.save(perms);
    }
    this.permCacheService?.invalidateGroup(saved.id);
    return saved;
  }

  async updateGroupPermissions(groupId: number, data: any, actor?: any) {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Không tìm thấy nhóm');

    if (actor && actor.username !== 'admin') {
      const actorGroupId = actor.groupId || actor.group_id;
      if (actorGroupId && Number(actorGroupId) === Number(groupId)) {
        throw new ForbiddenException('Không thể tự chỉnh sửa quyền nhóm của chính mình');
      }

      if (data.permissions && Array.isArray(data.permissions) && data.permissions.length > 0) {
        await this.assertPermissionsNotExceedingActor(actorGroupId, data.permissions);
      }
    }

    if (data.name) await this.groupRepo.update(groupId, { name: data.name, description: data.description });

    // Xóa quyền cũ và thêm quyền mới
    if (data.permissions) {
      if (Array.isArray(data.permissions) && data.permissions.length === 0 && !data.confirmEmpty) {
        throw new BadRequestException('Danh sách quyền trống');
      }

      await this.permRepo.delete({ group_id: groupId });

      const permObjects = data.permissions.map((p: any) => ({
        ...p,
        group_id: groupId
      }));

      const perms = this.permRepo.create(permObjects);
      await this.permRepo.save(perms);
    }
    this.permCacheService?.invalidateGroup(groupId);
    return { success: true };
  }

  // --- QUAN TRỌNG: Lấy user kèm theo Permissions ---
  async findOneByUsernameForAuth(username: string) {
    return this.userRepo.createQueryBuilder('user')
      .addSelect('user.password')
      .leftJoinAndSelect('user.group', 'group')
      .leftJoinAndSelect('group.permissions', 'permissions') // Lấy danh sách quyền
      .where('user.username = :username', { username })
      .getOne();
  }
}
