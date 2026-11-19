import { Controller, Get, UseGuards, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { AuthOnly } from '../../auth/permissions.decorator';
import { CorePackage } from './requires-package.decorator';
import { ENTITLEMENT_PROVIDER, EntitlementProvider } from './entitlement-provider.interface';

@Controller('me')
@CorePackage()
export class MeEntitlementsController {
  constructor(
    private readonly configService: ConfigService,
    @Inject(ENTITLEMENT_PROVIDER)
    private readonly entitlementProvider: EntitlementProvider,
  ) {}

  @Get('entitlements')
  @UseGuards(JwtAuthGuard)
  @AuthOnly()
  async getEntitlements() {
    const rawMode = this.configService.get<string>('ENTITLEMENTS_MODE');
    const mode = rawMode?.trim()?.toLowerCase() === 'db' ? 'db' : 'all';
    const list = await this.entitlementProvider.list();

    // In P6a: do not return limits to frontend
    const packages = list.map(({ key, enabled, validUntil }) => ({
      key,
      enabled,
      validUntil,
    }));

    return {
      mode,
      packages,
    };
  }
}
