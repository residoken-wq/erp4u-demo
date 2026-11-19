import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { SystemModule } from '../system/system.module';
import { SalesModule } from '../sales/sales.module';
import { Product } from '../products/product.entity';
import { Category } from '../categories/category.entity';
import { Customer } from '../customers/customer.entity';
import { SystemConfig } from '../system/system-config.entity';
import { BlogPost } from './entities/blog-post.entity';
import { WebProject } from './entities/web-project.entity';
import { WebsitePolicy } from './entities/website-policy.entity';
import { WizardConfig } from './entities/wizard-config.entity';
import { ProductWebsiteConfig } from './entities/product-website-config.entity';
import { BlogsController } from './blogs.controller';
import { BlogsService } from './blogs.service';
import { WebsiteProjectsController } from './website-projects.controller';
import { WebsiteProjectsService } from './website-projects.service';
import { WebsitePublicController } from './website-public.controller';
import { WebsiteService } from './website.service';

@Global()
@Module({
    imports: [
        TypeOrmModule.forFeature([
            BlogPost,
            WebProject,
            WebsitePolicy,
            WizardConfig,
            ProductWebsiteConfig,
            Product,
            Category,
            Customer,
            SystemConfig,
        ]),
        SalesModule,
        SystemModule,
        AuthModule,
    ],
    controllers: [
        BlogsController,
        WebsiteProjectsController,
        WebsitePublicController,
    ],
    providers: [
        BlogsService,
        WebsiteProjectsService,
        WebsiteService,
        {
            provide: 'WEBSITE_SERVICE',
            useExisting: WebsiteService,
        },
    ],
    exports: [
        BlogsService,
        WebsiteProjectsService,
        WebsiteService,
        'WEBSITE_SERVICE',
    ],
})
export class WebsiteModule { }
