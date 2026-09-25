import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user || user.username !== 'admin') {
      throw new ForbiddenException('Chỉ Super Admin mới có quyền thực hiện thao tác này');
    }
    return true;
  }
}
