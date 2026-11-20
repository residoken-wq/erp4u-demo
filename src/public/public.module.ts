import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PublicController } from './public.controller';
import { PortalController } from './portal.controller';
import { Customer } from '../customers/customer.entity';
import { CustomerContact } from '../customers/customer-contact.entity';
import { SystemConfig } from '../system/system-config.entity';
import { SalesModule } from '../sales/sales.module';
import { SystemModule } from '../system/system.module';
import { PortalOtp } from './entities/portal-otp.entity';
import { PortalSession } from './entities/portal-session.entity';
import { SalesOrder } from '../sales/sales-order.entity';
import { HrModule } from '../hr/hr.module';
import { EmailService } from '../common/services/email.service';
import { DemoModeService } from '../common/services/demo-mode.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Customer, CustomerContact, SystemConfig,
            // Portal entities
            PortalOtp, PortalSession, SalesOrder
        ]),
        SalesModule,
        SystemModule,
        HrModule,
    ],
    controllers: [PublicController, PortalController],
    providers: [EmailService, DemoModeService]
})
export class PublicModule { }
