import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PublicController } from './public.controller';
import { PortalController } from './portal.controller';
import { Product } from '../products/product.entity';
import { Category } from '../categories/category.entity';
import { Customer } from '../customers/customer.entity';
import { CustomerContact } from '../customers/customer-contact.entity';
import { BlogPost } from '../blogs/blog-post.entity';
import { SystemConfig } from '../system/system-config.entity';
import { SalesModule } from '../sales/sales.module';
import { ProductWebsiteConfig } from '../products/entities/product-website-config.entity';
import { SystemModule } from '../system/system.module';
import { WebsitePolicy } from './entities/website-policy.entity';
import { WizardConfig } from './entities/wizard-config.entity';
import { PortalOtp } from './entities/portal-otp.entity';
import { PortalSession } from './entities/portal-session.entity';
import { SalesOrder } from '../sales/sales-order.entity';
import { WebProject } from '../website-projects/entities/web-project.entity';
import { JobPost } from '../hr/entities/job-post.entity';
import { Candidate } from '../hr/entities/candidate.entity';
import { Assessment } from '../hr/entities/assessment.entity';
import { Interview } from '../hr/entities/interview.entity';
import { HrModule } from '../hr/hr.module';
import { EmailService } from '../common/services/email.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Product, Category, Customer, CustomerContact, BlogPost, SystemConfig, 
            ProductWebsiteConfig, WebsitePolicy, WizardConfig, WebProject,
            JobPost, Candidate, Assessment, Interview,
            // Portal entities
            PortalOtp, PortalSession, SalesOrder
        ]),
        SalesModule,
        SystemModule, // <--- Import for SystemService
        HrModule // <--- Import for HrService (if needed)
    ],
    controllers: [PublicController, PortalController],
    providers: [EmailService]
})
export class PublicModule { }
