import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DesignsController } from './designs.controller';
import { DesignsService } from './designs.service';
import { CustomerLogo } from './entities/customer-logo.entity';
import { PrintDesign } from './entities/print-design.entity';
import { PrintSample } from './entities/print-sample.entity';
import { DesignOrder } from './entities/design-order.entity';
import { DesignOrderItem } from './entities/design-order-item.entity';
import { AuthModule } from '../auth/auth.module';
import { DESIGN_ORDER_HOOKS } from '../common/extension-points';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([CustomerLogo, PrintDesign, PrintSample, DesignOrder, DesignOrderItem]),
    AuthModule
  ],
  controllers: [DesignsController],
  providers: [
    DesignsService,
    {
      provide: DESIGN_ORDER_HOOKS,
      useExisting: DesignsService,
    },
  ],
  exports: [DesignsService, DESIGN_ORDER_HOOKS]
})
export class DesignsModule {}
