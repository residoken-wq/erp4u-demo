import { SetMetadata } from '@nestjs/common';
import { PackageKey } from './package.registry';

export const REQUIRES_PACKAGE_KEY = 'requires_package';

/**
 * Decorator to declare that a controller or endpoint requires a specific package.
 */
export const RequiresPackage = (pkg: PackageKey) => SetMetadata(REQUIRES_PACKAGE_KEY, pkg);

/**
 * Explicit marker for Core features so tests can distinguish
 * intentionally Core modules from unannotated controllers.
 */
export const CorePackage = () => SetMetadata(REQUIRES_PACKAGE_KEY, PackageKey.CORE);
