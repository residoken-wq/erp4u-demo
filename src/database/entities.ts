import { CHATBOT_ENTITIES } from '../chatbot/entities';
import { TenantEntitlement } from '../common/packages/tenant-entitlement.entity';
import { UsageCounter } from '../common/packages/usage-counter.entity';

import { Product } from '../products/product.entity';
import { Material } from '../materials/material.entity';
import { BOM } from '../bom/bom.entity';
import { ProductComponent } from '../products/product-component.entity';
import { ProductRouting } from '../products/product-routing.entity';
import { ProductLogistics } from '../products/product-logistics.entity';
import { ProductPattern } from '../products/product-pattern.entity';
import { ProductPackingSpec } from '../products/entities/product-packing-spec.entity';

import { SalesOrder } from '../sales/sales-order.entity';
import { SalesOrderItem } from '../sales/sales-order-item.entity';
import { ProductSample } from '../sales/product-sample.entity';
import { SalesDelivery } from '../sales/sales-delivery.entity';
import { SalesDeliveryItem } from '../sales/sales-delivery-item.entity';
import { SalesComment } from '../sales/sales-comment.entity';
import { SalesChecklist } from '../sales/sales-checklist.entity';
import { SalesChecklistItem } from '../sales/sales-checklist-item.entity';
import { PriceList } from '../sales/pricelist/price-list.entity';
import { PriceListRule } from '../sales/pricelist/price-list-rule.entity';
import { SalesOrderVersion } from '../sales/sales-order-version.entity';
import { SalesTarget } from '../sales/sales-target.entity';

import { StockHistory } from '../inventory/stock-history.entity';
import { InventoryStock } from '../inventory/inventory-stock.entity';
import { ShippingCarrier } from '../inventory/entities/shipping-carrier.entity';

import { PurchaseOrder } from '../purchasing/entities/purchase-order.entity';
import { PurchaseOrderItem } from '../purchasing/entities/purchase-order-item.entity';
import { GoodsReceipt } from '../inventory/entities/goods-receipt.entity';
import { GoodsReceiptItem } from '../inventory/entities/goods-receipt-item.entity';
import { SampleTransaction } from '../inventory/samples/sample-transaction.entity';
import { SampleTransactionItem } from '../inventory/samples/sample-transaction-item.entity';
import { GoodsIssue } from '../inventory/entities/goods-issue.entity';
import { GoodsIssueItem } from '../inventory/entities/goods-issue-item.entity';
import { SupplierStock } from '../inventory/entities/supplier-stock.entity';
import { SupplierTransaction } from '../inventory/entities/supplier-transaction.entity';

import { ProductionOrder } from '../production/entities/production-order.entity';
import { WorkOrder } from '../production/work-order.entity';
import { WorkOrderStep } from '../production/work-order-step.entity';
import { OutsourcingAssignment } from '../production/entities/outsourcing-assignment.entity';

import { QualityInspection } from '../qc/quality-inspection.entity';
import { QCDefectItem } from '../qc/qc-defect-item.entity';

import { Transaction } from '../finance/transaction.entity';
import { TransactionCategory } from '../finance/transaction-category.entity';

import { Task } from '../tasks/task.entity';
import { TaskTimeLog } from '../tasks/task-time-log.entity';
import { Notification } from '../notifications/notification.entity';

import { Project } from '../projects/entities/project.entity';
import { Milestone } from '../projects/entities/milestone.entity';
import { Discussion } from '../discussions/entities/discussion.entity';
import { DiscussionComment } from '../discussions/entities/discussion-comment.entity';

import { Supplier } from '../suppliers/supplier.entity';
import { SupplierMaterial } from '../suppliers/supplier-material.entity';
import { SupplierContact } from '../suppliers/supplier-contact.entity';
import { Customer } from '../customers/customer.entity';
import { CustomerContact } from '../customers/customer-contact.entity';
import { CustomerComment } from '../customers/customer-comment.entity';
import { CustomerCredit } from '../customers/customer-credit.entity';
import { ProductionFulfillmentOrder } from '../planning/pfo.entity';
import { PfoMaterialRequirement } from '../planning/pfo-material-requirement.entity';
import { PfoMilestone } from '../planning/pfo-milestone.entity';
import { PfoQcRecord } from '../planning/pfo-qc-record.entity';
import { Process } from '../processes/process.entity';
import { Category } from '../categories/category.entity';

import { User } from '../users/entities/user.entity';
import { UserGroup } from '../users/entities/user-group.entity';
import { GroupPermission } from '../users/entities/group-permission.entity';
import { RbacAccessLog } from '../auth/entities/rbac-access-log.entity';
import { SystemConfig } from '../system/system-config.entity';
import { ApiToken } from '../system/entities/api-token.entity';
import { ContractTemplate } from '../system/contract-template.entity';
import { EmailTemplate } from '../system/email-template.entity';
import { BlogPost } from '../website/entities/blog-post.entity';
import { ActivityLog } from '../system/entities/activity-log.entity';
import { ProductWebsiteConfig } from '../website/entities/product-website-config.entity';
import { WebsitePolicy } from '../website/entities/website-policy.entity';
import { WizardConfig } from '../website/entities/wizard-config.entity';
import { PortalOtp } from '../public/entities/portal-otp.entity';
import { PortalSession } from '../public/entities/portal-session.entity';
import { Promotion } from '../sales/promotion.entity';

import { Employee } from '../hr/entities/employee.entity';
import { Attendance } from '../hr/entities/attendance.entity';
import { LeaveRequest } from '../hr/entities/leave-request.entity';
import { LeaveEntitlement } from '../hr/entities/leave-entitlement.entity';
import { AssetAssignment } from '../hr/entities/asset-assignment.entity';
import { Payslip } from '../hr/entities/payslip.entity';
import { TrainingPlan } from '../hr/entities/training-plan.entity';
import { WorkShift } from '../hr/entities/work-shift.entity';
import { JobPost } from '../hr/entities/job-post.entity';
import { Candidate } from '../hr/entities/candidate.entity';
import { Assessment } from '../hr/entities/assessment.entity';
import { Interview } from '../hr/entities/interview.entity';
import { ReviewQuestion } from '../hr/entities/review-question.entity';
import { ReviewCampaign } from '../hr/entities/review-campaign.entity';
import { EmployeeReview } from '../hr/entities/employee-review.entity';

import { AiMessage } from '../ai/ai-message.entity';
import {
  AiAuditLog,
  AiDraft,
  AiConversation,
  AiConversationMessage,
  AiDocumentScan,
} from '../ai/entities';
import {
  Alert,
  AlertSetting,
  AlertUserPref,
  AlertRun,
} from '../alerts/entities';
import { CustomerLogo } from '../designs/entities/customer-logo.entity';
import { PrintDesign } from '../designs/entities/print-design.entity';
import { PrintSample } from '../designs/entities/print-sample.entity';
import { DesignOrder } from '../designs/entities/design-order.entity';
import { DesignOrderItem } from '../designs/entities/design-order-item.entity';

import { SocialChannel } from '../social/entities/social-channel.entity';
import { SocialOrder } from '../social/entities/social-order.entity';
import { SocialProductMapping } from '../social/entities/social-product-mapping.entity';
import { MarketingCampaign } from '../marketing/entities/marketing-campaign.entity';
import { CustomerSegment } from '../marketing/entities/customer-segment.entity';
import { AutomationWorkflow } from '../marketing/entities/automation-workflow.entity';

import { TikTokMessage } from '../tiktok/entities/tiktok-message.entity';
import { TikTokComment } from '../tiktok/entities/tiktok-comment.entity';
import { TikTokConversation } from '../tiktok/entities/tiktok-conversation.entity';

import { Announcement } from '../announcements/announcement.entity';
import { AnnouncementRead } from '../announcements/announcement-read.entity';
import { WebProject } from '../website/entities/web-project.entity';
import { AnalyticsVisitor } from '../analytics/analytics-visitor.entity';

import { ZaloApiConfig } from '../zns/entities/zalo-api-config.entity';
import { ZnsMessageLog } from '../zns/entities/zns-message-log.entity';

export const CORE_ENTITIES = [
  Product, Material, BOM, ProductComponent, ProductRouting, ProductLogistics, ProductPattern, ProductPackingSpec,
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
  User, UserGroup, GroupPermission, RbacAccessLog,
  SystemConfig, ActivityLog, ApiToken,
  Employee, Attendance, LeaveRequest, LeaveEntitlement, AssetAssignment, Payslip, TrainingPlan, WorkShift,
  JobPost, Candidate, Assessment, Interview,
  ReviewQuestion, ReviewCampaign, EmployeeReview,
  ContractTemplate, EmailTemplate,
  MarketingCampaign, CustomerSegment, AutomationWorkflow,
  Announcement, AnnouncementRead,
  PortalOtp, PortalSession,
  Promotion,
  AnalyticsVisitor,
  TenantEntitlement,
  UsageCounter,
];

/**
 * Premium Add-on entities (Ai, Chatbot, TikTok, Social, Zns, Designs, Website).
 * When includePremium: false, DataSource still registers all entities (including PREMIUM_ENTITIES)
 * so that premium tables remain in the database schema to avoid destructive migration drops.
 */
export const PREMIUM_ENTITIES = [
  AiMessage,
  AiAuditLog,
  AiDraft,
  AiConversation,
  AiConversationMessage,
  AiDocumentScan,
  Alert,
  AlertSetting,
  AlertUserPref,
  AlertRun,
  CustomerLogo, PrintDesign, PrintSample, DesignOrder, DesignOrderItem,
  SocialChannel, SocialOrder, SocialProductMapping,
  TikTokMessage, TikTokComment, TikTokConversation,
  BlogPost, ProductWebsiteConfig, WebsitePolicy, WizardConfig, WebProject,
  ZaloApiConfig,
  ZnsMessageLog,
  ...CHATBOT_ENTITIES,
];

export const ENTITIES = [
  ...CORE_ENTITIES,
  ...PREMIUM_ENTITIES,
];
