import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PERMISSION_KEY } from './permissions.decorator';
import { GroupPermission } from '../users/entities/group-permission.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class PermissionsGuard implements CanActivate {
    constructor(
        private reflector: Reflector,
        @InjectRepository(GroupPermission)
        private permRepo: Repository<GroupPermission>,
        @InjectRepository(User)
        private userRepo: Repository<User>,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // 1. Đọc metadata từ decorator @RequirePermission
        const requirement = this.reflector.getAllAndOverride<{ moduleCode: string; action: string }>(PERMISSION_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        // Nếu route không có @RequirePermission → PASS (backwards compatible)
        if (!requirement) {
            return true;
        }

        // 2. Lấy user từ request (đã được JwtAuthGuard inject)
        const request = context.switchToHttp().getRequest();
        const jwtUser = request.user;

        if (!jwtUser) {
            throw new ForbiddenException('Không xác định được người dùng');
        }

        // 3. Admin bypass tất cả
        if (jwtUser.username === 'admin') {
            return true;
        }

        // 4. Lấy group_id từ JWT payload
        const groupId = jwtUser.groupId;
        if (!groupId) {
            throw new ForbiddenException('Tài khoản chưa được gán nhóm quyền');
        }

        // 5. Query permission từ DB
        const { moduleCode, action } = requirement;
        const perm = await this.permRepo.findOne({
            where: {
                group_id: groupId,
                module_code: moduleCode,
            },
        });

        if (!perm) {
            throw new ForbiddenException(
                `Bạn không có quyền truy cập module "${moduleCode}". Liên hệ Admin để được cấp quyền.`
            );
        }

        // 6. Check action cụ thể
        const allowed = perm[action as keyof GroupPermission];
        if (!allowed) {
            const actionLabels: Record<string, string> = {
                can_view: 'Xem',
                can_create: 'Tạo mới',
                can_update: 'Chỉnh sửa',
                can_delete: 'Xóa',
            };
            throw new ForbiddenException(
                `Bạn không có quyền "${actionLabels[action] || action}" trong module "${moduleCode}".`
            );
        }

        return true;
    }
}
