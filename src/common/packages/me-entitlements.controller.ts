import { Controller, Get, UseGuards, Inject, Optional } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { AuthOnly } from '../../auth/permissions.decorator';
import { CorePackage } from './requires-package.decorator';
import { ENTITLEMENT_PROVIDER, EntitlementProvider } from './entitlement-provider.interface';
import { INSTALLED_ADDONS } from './installed-addons.token';

@Controller('me')
@CorePackage()
export class MeEntitlementsController {
  constructor(
    private readonly configService: ConfigService,
    @Inject(ENTITLEMENT_PROVIDER)
    private readonly entitlementProvider: EntitlementProvider,
    private readonly moduleRef: ModuleRef,
    @Optional()
    @Inject(INSTALLED_ADDONS)
    private readonly rawAddons?: any,
  ) {}

  private getInstalledAddons(): {
    AI: boolean;
    OMNICHANNEL: boolean;
    DESIGN: boolean;
    WEBSITE: boolean;
  } {
    const installed = new Set<string>();

    const recordAddon = (val: any) => {
      if (!val) return;
      if (Array.isArray(val)) {
        val.forEach(recordAddon);
      } else if (typeof val === 'string') {
        installed.add(val.trim().toUpperCase());
      }
    };

    try {
      const instances = this.moduleRef.get(INSTALLED_ADDONS, { each: true });
      recordAddon(instances);
    } catch {
      // ignore if token is not found or moduleRef is not yet initialized
    }

    if (this.rawAddons) {
      recordAddon(this.rawAddons);
    }

    return {
      AI: installed.has('AI'),
      OMNICHANNEL: installed.has('OMNICHANNEL'),
      DESIGN: installed.has('DESIGN'),
      WEBSITE: installed.has('WEBSITE'),
    };
  }

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

    const addons = this.getInstalledAddons();

    return {
      mode,
      packages,
      addons,
    };
  }
}
