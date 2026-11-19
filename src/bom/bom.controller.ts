import { Controller } from '@nestjs/common';
import { RequiresPackage } from '../common/packages/requires-package.decorator';
import { PackageKey } from '../common/packages/package.registry';

@Controller('bom')
@RequiresPackage(PackageKey.PRODUCTION)
export class BomController {}
