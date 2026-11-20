import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ZaloApiConfig } from './entities/zalo-api-config.entity';
import { ZnsMessageLog } from './entities/zns-message-log.entity';
import { SalesOrder } from '../sales/sales-order.entity';
import { SalesDelivery } from '../sales/sales-delivery.entity';
import { ZaloZnsService } from './zns.service';
import { ZnsController } from './zns.controller';
import { AuthModule } from '../auth/auth.module';
import { NOTIFICATION_CHANNELS, ZNS_SERVICE } from '../common/extension-points';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ZaloApiConfig,
      ZnsMessageLog,
      SalesOrder,
      SalesDelivery,
    ]),
    AuthModule,
  ],
  controllers: [ZnsController],
  providers: [
    ZaloZnsService,
    {
      provide: NOTIFICATION_CHANNELS,
      useExisting: ZaloZnsService,
    },
    {
      provide: ZNS_SERVICE,
      useExisting: ZaloZnsService,
    },
  ],
  exports: [ZaloZnsService, NOTIFICATION_CHANNELS, ZNS_SERVICE],
})
export class ZnsModule {}

