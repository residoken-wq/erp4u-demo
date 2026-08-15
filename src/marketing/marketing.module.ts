import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketingController } from './marketing.controller';
import { MarketingService } from './marketing.service';
import { MarketingCampaign } from './entities/marketing-campaign.entity';
import { CustomerSegment } from './entities/customer-segment.entity';
import { AutomationWorkflow } from './entities/automation-workflow.entity';
import { Customer } from '../customers/customer.entity';
import { SalesOrder } from '../sales/sales-order.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            MarketingCampaign,
            CustomerSegment,
            AutomationWorkflow,
            Customer,
            SalesOrder,
        ]),
    ],
    controllers: [MarketingController],
    providers: [MarketingService],
    exports: [MarketingService],
})
export class MarketingModule { }
