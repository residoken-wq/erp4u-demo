import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

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
import { BlogsModule } from './blogs/blogs.module';
import { PublicModule } from './public/public.module';
import { HrModule } from './hr/hr.module';
import { EncryptionModule } from './common/encryption/encryption.module';
import { SocialModule } from './social/social.module';
import { MarketingModule } from './marketing/marketing.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { WebsiteProjectsModule } from './website-projects/website-projects.module';
import { QCModule } from './qc/qc.module';
import { DesignsModule } from './designs/designs.module';

import { AnalyticsModule } from './analytics/analytics.module';

// Entities
import { Product } from './products/product.entity';
import { Material } from './materials/material.entity';
import { BOM } from './bom/bom.entity';
import { ProductComponent } from './products/product-component.entity';
import { ProductRouting } from './products/product-routing.entity';
import { ProductLogistics } from './products/product-logistics.entity';
import { ProductPattern } from './products/product-pattern.entity';

import { SalesOrder } from './sales/sales-order.entity';
import { SalesOrderItem } from './sales/sales-order-item.entity';
import { ProductSample } from './sales/product-sample.entity';
import { SalesDelivery } from './sales/sales-delivery.entity';
import { SalesDeliveryItem } from './sales/sales-delivery-item.entity';
import { SalesComment } from './sales/sales-comment.entity';
import { SalesChecklist } from './sales/sales-checklist.entity';
import { SalesChecklistItem } from './sales/sales-checklist-item.entity';
import { PriceList } from './sales/pricelist/price-list.entity';
import { PriceListRule } from './sales/pricelist/price-list-rule.entity';
import { SalesOrderVersion } from './sales/sales-order-version.entity';
import { SalesTarget } from './sales/sales-target.entity';

import { StockHistory } from './inventory/stock-history.entity';
import { InventoryStock } from './inventory/inventory-stock.entity';
import { ShippingCarrier } from './inventory/entities/shipping-carrier.entity';

import { PurchaseOrder } from './purchasing/entities/purchase-order.entity';
import { PurchaseOrderItem } from './purchasing/entities/purchase-order-item.entity';
import { GoodsReceipt } from './inventory/entities/goods-receipt.entity';
import { GoodsReceiptItem } from './inventory/entities/goods-receipt-item.entity';
import { SampleTransaction } from './inventory/samples/sample-transaction.entity';
import { SampleTransactionItem } from './inventory/samples/sample-transaction-item.entity';
import { GoodsIssue } from './inventory/entities/goods-issue.entity';
import { GoodsIssueItem } from './inventory/entities/goods-issue-item.entity';
import { SupplierStock } from './inventory/entities/supplier-stock.entity';
import { SupplierTransaction } from './inventory/entities/supplier-transaction.entity';

import { ProductionOrder } from './production/entities/production-order.entity';
import { WorkOrder } from './production/work-order.entity';
import { WorkOrderStep } from './production/work-order-step.entity';
import { OutsourcingAssignment } from './production/entities/outsourcing-assignment.entity';

import { QualityInspection } from './qc/quality-inspection.entity';
import { QCDefectItem } from './qc/qc-defect-item.entity';

// Finance Entities
import { Transaction } from './finance/transaction.entity';
import { TransactionCategory } from './finance/transaction-category.entity';

// Task & Notification Entities
import { Task } from './tasks/task.entity';
import { TaskTimeLog } from './tasks/task-time-log.entity';
import { Notification } from './notifications/notification.entity';

import { Project } from './projects/entities/project.entity';
import { Milestone } from './projects/entities/milestone.entity';
import { Discussion } from './discussions/entities/discussion.entity';
import { DiscussionComment } from './discussions/entities/discussion-comment.entity';

import { Supplier } from './suppliers/supplier.entity';
import { SupplierMaterial } from './suppliers/supplier-material.entity';
import { SupplierContact } from './suppliers/supplier-contact.entity';
import { Customer } from './customers/customer.entity';
import { CustomerContact } from './customers/customer-contact.entity';
import { CustomerComment } from './customers/customer-comment.entity';
import { CustomerCredit } from './customers/customer-credit.entity';
import { ProductionFulfillmentOrder } from './planning/pfo.entity';
import { PfoMaterialRequirement } from './planning/pfo-material-requirement.entity';
import { PfoMilestone } from './planning/pfo-milestone.entity';
import { PfoQcRecord } from './planning/pfo-qc-record.entity';
import { Process } from './processes/process.entity';
import { Category } from './categories/category.entity';

// User Entities
import { User } from './users/entities/user.entity';
import { UserGroup } from './users/entities/user-group.entity';
import { GroupPermission } from './users/entities/group-permission.entity';
import { SystemConfig } from './system/system-config.entity';
import { ApiToken } from './system/entities/api-token.entity';
import { ContractTemplate } from './system/contract-template.entity';
import { EmailTemplate } from './system/email-template.entity';
import { BlogPost } from './blogs/blog-post.entity';
import { ActivityInterceptor } from './common/interceptors/activity.interceptor';
import { ActivityLog } from './system/entities/activity-log.entity';
import { ProductWebsiteConfig } from './products/entities/product-website-config.entity';
import { WebsitePolicy } from './public/entities/website-policy.entity';
import { WizardConfig } from './public/entities/wizard-config.entity';
import { PortalOtp } from './public/entities/portal-otp.entity';
import { PortalSession } from './public/entities/portal-session.entity';
import { Promotion } from './sales/promotion.entity';

// HR Entities
import { Employee } from './hr/entities/employee.entity';
import { Attendance } from './hr/entities/attendance.entity';
import { LeaveRequest } from './hr/entities/leave-request.entity';
import { LeaveEntitlement } from './hr/entities/leave-entitlement.entity';
import { AssetAssignment } from './hr/entities/asset-assignment.entity';
import { Payslip } from './hr/entities/payslip.entity';
import { TrainingPlan } from './hr/entities/training-plan.entity';
import { WorkShift } from './hr/entities/work-shift.entity';
import { JobPost } from './hr/entities/job-post.entity';
import { Candidate } from './hr/entities/candidate.entity';
import { Assessment } from './hr/entities/assessment.entity';
import { Interview } from './hr/entities/interview.entity';
import { ReviewQuestion } from './hr/entities/review-question.entity';
import { ReviewCampaign } from './hr/entities/review-campaign.entity';
import { EmployeeReview } from './hr/entities/employee-review.entity';

import { AppController } from './app.controller';

import { AiModule } from './ai/ai.module';
import { AiMessage } from './ai/ai-message.entity';
import { CustomerLogo } from './designs/entities/customer-logo.entity';
import { PrintDesign } from './designs/entities/print-design.entity';
import { PrintSample } from './designs/entities/print-sample.entity';

// Social & Marketing Entities
import { SocialChannel } from './social/entities/social-channel.entity';
import { SocialOrder } from './social/entities/social-order.entity';
import { SocialProductMapping } from './social/entities/social-product-mapping.entity';
import { MarketingCampaign } from './marketing/entities/marketing-campaign.entity';
import { CustomerSegment } from './marketing/entities/customer-segment.entity';
import { AutomationWorkflow } from './marketing/entities/automation-workflow.entity';

// Announcement Entities
import { Announcement } from './announcements/announcement.entity';
import { AnnouncementRead } from './announcements/announcement-read.entity';
import { WebProject } from './website-projects/entities/web-project.entity';
import { AnalyticsVisitor } from './analytics/analytics-visitor.entity';

import { MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { UserContextInterceptor } from './common/interceptors/user-context.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dbUrl = configService.get<string>('POSTGRES_URL') || configService.get<string>('PRISMA_DATABASE_URL') || configService.get<string>('DATABASE_URL');
        return {
          type: 'postgres',
          ...(dbUrl ? { 
            url: dbUrl, 
            ssl: { rejectUnauthorized: false } 
          } : {
            host: configService.get<string>('DB_HOST') || 'localhost',
            port: configService.get<number>('DB_PORT') || 5432,
            username: configService.get<string>('DB_USERNAME') || 'erp4u_user',
            password: configService.get<string>('DB_PASSWORD') || 'erp4u_password',
            database: configService.get<string>('DB_DATABASE') || 'erp4u_db',
          }),
        entities: [
          Product, Material, BOM, ProductComponent, ProductRouting, ProductLogistics, ProductPattern,
          SalesOrder, SalesOrderItem, ProductSample, SalesDelivery, SalesDeliveryItem, SalesComment,
          SalesChecklist, SalesChecklistItem,
          PriceList, PriceListRule, SalesOrderVersion, SalesTarget,
          PurchaseOrder, PurchaseOrderItem, GoodsReceipt, GoodsReceiptItem,
          StockHistory, InventoryStock, ShippingCarrier, SampleTransaction, SampleTransactionItem,
          GoodsIssue, GoodsIssueItem, SupplierStock, SupplierTransaction,
          ProductionOrder, WorkOrder, WorkOrderStep, OutsourcingAssignment,
          QualityInspection, QCDefectItem,
          Transaction, TransactionCategory,
          Task, TaskTimeLog, Notification,
          Project, Milestone, Discussion, DiscussionComment,
          Supplier, SupplierMaterial, SupplierContact,
          Customer, CustomerContact, CustomerComment, CustomerCredit,
          ProductionFulfillmentOrder, PfoMaterialRequirement, PfoMilestone, PfoQcRecord, Process, Category,
          User, UserGroup, GroupPermission,
          SystemConfig, ActivityLog, ApiToken,
          BlogPost,
          Employee, Attendance, LeaveRequest, LeaveEntitlement, AssetAssignment, Payslip, TrainingPlan, WorkShift,
          JobPost, Candidate, Assessment, Interview,
          ReviewQuestion, ReviewCampaign, EmployeeReview,
          // Website Config & Templates
          ProductWebsiteConfig, ContractTemplate, EmailTemplate, WebsitePolicy, WizardConfig,
          // Social & Marketing
          SocialChannel, SocialOrder, SocialProductMapping,
          MarketingCampaign, CustomerSegment, AutomationWorkflow,
          // Announcements
          Announcement, AnnouncementRead,
          // Website
          WebProject,
          // Portal
          PortalOtp, PortalSession,
          // Promotions
          Promotion,
          AnalyticsVisitor,
          AiMessage,
          CustomerLogo, PrintDesign, PrintSample
        ],
        synchronize: configService.get<string>('NODE_ENV') !== 'production',
        subscribers: [],
      };
    },
    }),
    UsersModule, AuthModule,
    ProductsModule, MaterialsModule, BomModule, SalesModule,
    InventoryModule, ProductionModule, PurchasingModule, FinanceModule,
    TasksModule, ProjectsModule, DiscussionsModule, NotificationsModule, SystemModule,
    UploadModule, SuppliersModule, CustomersModule, PlanningModule,
    ProcessesModule, CategoriesModule, AiModule,
    BlogsModule, PublicModule, HrModule,
    EncryptionModule, // Column-level PII encryption
    SocialModule, // Social integration (Facebook, Shopee, TikTok)
    MarketingModule, // Marketing campaigns, segments, automation
    AnnouncementsModule, // Announcements for employees
    WebsiteProjectsModule,
    AnalyticsModule, // Website Analytics tracking
    QCModule, // Quality Control module
    DesignsModule, // Printing & Embroidery Design Module
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