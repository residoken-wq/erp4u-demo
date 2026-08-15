import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SocialController } from './social.controller';
import { SocialService } from './social.service';
import { SocialChannel } from './entities/social-channel.entity';
import { SocialOrder } from './entities/social-order.entity';
import { SocialProductMapping } from './entities/social-product-mapping.entity';
import { SalesOrder } from '../sales/sales-order.entity';
import { Product } from '../products/product.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            SocialChannel,
            SocialOrder,
            SocialProductMapping,
            SalesOrder,
            Product,
        ]),
    ],
    controllers: [SocialController],
    providers: [SocialService],
    exports: [SocialService],
})
export class SocialModule { }
