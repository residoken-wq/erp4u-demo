import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRES_PACKAGE_KEY } from './requires-package.decorator';
import { PackageKey } from './package.registry';
import { ENTITLEMENT_PROVIDER, EntitlementProvider } from './entitlement-provider.interface';

@Injectable()
export class EntitlementGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(ENTITLEMENT_PROVIDER)
    private readonly entitlementProvider: EntitlementProvider,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPackage = this.reflector.getAllAndOverride<PackageKey>(
      REQUIRES_PACKAGE_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no package metadata is defined or it is marked as CORE, allow access
    if (!requiredPackage || requiredPackage === PackageKey.CORE) {
      return true;
    }

    const isEnabled = await this.entitlementProvider.isEnabled(requiredPackage);
    if (!isEnabled) {
      throw new HttpException(
        {
          statusCode: 402,
          code: 'PACKAGE_REQUIRED',
          package: requiredPackage,
          message: `Tính năng thuộc gói ${requiredPackage} chưa được kích hoạt`,
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    return true;
  }
}
