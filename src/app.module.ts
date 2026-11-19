import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

// Modules
import { ProductsModule } from './products/products.module';
import { MaterialsModule } from './materials/materials.module';
import { BomModule } from './bom/bom.module';
import { SalesModule } from './sales/sales.module';
import { InventoryModule } from './inventory/inventory.module';
import { ProductionModule } from './production/production.module';
import { PurchasingModule } from './purchasing/purchasing.module';
import { FinanceModule } from './finance/finance.module';
import { UploadModule } from './upload/upload.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { CustomersModule } from './customers/customers.module';
import { PlanningModule } from './planning/planning.module';
import { ProcessesModule } from './processes/processes.module';
import { CategoriesModule } from './categories/categories.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { TasksModule } from './tasks/tasks.module';
import { ProjectsModule } from './projects/projects.module';
import { DiscussionsModule } from './discussions/discussions.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SystemModule } from './system/system.module';
import { WebsiteModule } from './website/website.module';
import { PublicModule } from './public/public.module';
import { HrModule } from './hr/hr.module';
import { EncryptionModule } from './common/encryption/encryption.module';
import { SocialModule } from './social/social.module';
import { MarketingModule } from './marketing/marketing.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { QCModule } from './qc/qc.module';
import { DesignsModule } from './designs/designs.module';
import { TikTokModule } from './tiktok/tiktok.module';
import { ShippingModule } from './shipping/shipping.module';
import { ZnsModule } from './zns/zns.module';

import { AnalyticsModule } from './analytics/analytics.module';
import { ChatbotModule } from './chatbot/chatbot.module';
import { CommonModule } from './common/common.module';
import { TenancyModule } from './common/tenancy/tenancy.module';
import { installTenantConnectionHook } from './common/tenancy/tenant-connection.hook';
import { EntitlementsModule } from './common/packages/entitlements.module';
import { AiModule } from './ai/ai.module';

import { User } from './users/entities/user.entity';
import { ActivityInterceptor } from './common/interceptors/activity.interceptor';
import { UserContextInterceptor } from './common/interceptors/user-context.interceptor';
import { AppController } from './app.controller';
import { ENTITIES } from './database/entities';
import { buildDataSourceOptions } from './database/data-source';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        buildDataSourceOptions(
          {
            NODE_ENV: configService.get<string>('NODE_ENV'),
            DATABASE_URL: configService.get<string>('DATABASE_URL'),
            POSTGRES_URL: configService.get<string>('POSTGRES_URL'),
            DB_HOST: configService.get<string>('DB_HOST'),
            DB_PORT: configService.get<string | number>('DB_PORT'),
            DB_USERNAME: configService.get<string>('DB_USERNAME'),
            DB_PASSWORD: configService.get<string>('DB_PASSWORD'),
            DB_DATABASE: configService.get<string>('DB_DATABASE'),
          },
          {
            entities: ENTITIES,
            synchronize: false,
            migrationsRun:
              configService.get<string>('DB_AUTO_MIGRATE') !== 'false',
          },
        ),
      dataSourceFactory: async (options) => {
        if (!options) {
          throw new Error('Invalid TypeORM DataSource options');
        }
        const dataSource = await new DataSource(options).initialize();
        installTenantConnectionHook(dataSource);
        return dataSource;
      },
    }),
    TenancyModule,
    CommonModule,
    UsersModule, AuthModule, EntitlementsModule,
    ProductsModule, MaterialsModule, BomModule, SalesModule,
    InventoryModule, ProductionModule, PurchasingModule, FinanceModule,
    TasksModule, ProjectsModule, DiscussionsModule, NotificationsModule, SystemModule,
    UploadModule, SuppliersModule, CustomersModule, PlanningModule,
    ProcessesModule, CategoriesModule, AiModule,
    WebsiteModule, PublicModule, HrModule,
    EncryptionModule, // Column-level PII encryption
    SocialModule, // Social integration (Facebook, Shopee, TikTok)
    MarketingModule, // Marketing campaigns, segments, automation
    AnnouncementsModule, // Announcements for employees
    AnalyticsModule, // Website Analytics tracking
    QCModule, // Quality Control module
    DesignsModule, // Printing & Embroidery Design Module
    TikTokModule, // TikTok Shop inbox & comments integration
    ShippingModule, // Shipping & GHTK carrier integration
    ZnsModule, // Zalo ZNS Integration module
    ChatbotModule, // Trợ lý AI website module (P0)
    TypeOrmModule.forFeature([User]), // Needed for ActivityInterceptor
  ],
  providers: [
    {
      provide: 'APP_INTERCEPTOR',
      useClass: UserContextInterceptor, // Must run first to set context
    },
    {
      provide: 'APP_INTERCEPTOR',
      useClass: ActivityInterceptor,
    },
  ],
  controllers: [AppController]
})
export class AppModule { }