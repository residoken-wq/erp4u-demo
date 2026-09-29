import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SystemConfig } from '../../system/system-config.entity';
import { ChatbotSource } from '../entities/chatbot-source.entity';
import { ChatbotConflict } from '../entities/chatbot-conflict.entity';
import { ChatbotKnowledgeItem } from '../entities/chatbot-knowledge-item.entity';
import { ChatbotSchemaService } from '../schema/chatbot-schema.service';
import { applyKbV2ConflictResolutions, applyKbV2ItemTriage } from './kb-v2-conflict-triage';

@Injectable()
export class ChatbotKbSeedService implements OnModuleInit {
  private readonly logger = new Logger(ChatbotKbSeedService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly schemaService: ChatbotSchemaService,
  ) {}

  async onModuleInit() {
    // Seed failure must never block application startup (hotfix 2026-09-28: prod 502).
    try {
      await this.schemaService.initSchema();
      await this.seed();
      await this.cleanupV1Seed();
      await this.triageKbV2();
    } catch (err: any) {
      this.logger.error(`Chatbot KB init skipped: ${err?.message}`);
    }
  }

  /** Owner-approved kb-v2 conflict triage (2026-09-29). Never throws. */
  async triageKbV2(): Promise<void> {
    try {
      const res = await this.dataSource.transaction(async (mgr) => {
        const resolved = await applyKbV2ConflictResolutions(mgr);
        const items = await applyKbV2ItemTriage(mgr);
        return { resolved, ...items };
      });
      this.logger.log(`kb-v2 triage: resolved=${res.resolved} retired=${res.retired} rewritten=${res.rewritten}`);
    } catch (err: any) {
      this.logger.error(`kb-v2 triage failed: ${err?.message}`);
    }
  }

  async seed() {
    const configRepo = this.dataSource.getRepository(SystemConfig);
    const existing = await configRepo.findOne({ where: { key: 'CHATBOT_KB_SEED_V1' } });
    if (existing) {
      this.logger.log('Chatbot KB Seed V1 already executed, skipping.');
      return;
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      this.logger.log('Starting Chatbot KB Seed V1...');

      // 1. Sources (S1, S2, S3, S4, A1, SPEC)
      const sourcesData = [
        {
          code: 'S1',
          title: 'Bảng giá & quy cách nệm gối mầm non ERP4U 2026',
          internal_ref: 'https://docs.google.com/spreadsheets/d/1s1-price-spec',
          sensitivity: 'internal',
        },
        {
          code: 'S2',
          title: 'Quy trình tư vấn & chào giá đồng phục mầm non',
          internal_ref: 'https://docs.google.com/document/d/1s2-sales-process',
          sensitivity: 'internal',
        },
        {
          code: 'S3',
          title: 'Chính sách đổi trả, bảo hành & khiếu nại sản phẩm',
          internal_ref: 'https://docs.google.com/document/d/1s3-policy-return',
          sensitivity: 'internal',
        },
        {
          code: 'S4',
          title: 'Hồ sơ công bố hợp quy & kiểm định dệt may',
          internal_ref: 'https://docs.google.com/document/d/1s4-certifications',
          sensitivity: 'public',
        },
        {
          code: 'A1',
          title: 'Tài liệu đào tạo nhân viên tư vấn bán hàng ERP4U',
          internal_ref: 'https://docs.google.com/document/d/1a1-training-materials',
          sensitivity: 'internal',
        },
        {
          code: 'SPEC',
          title: 'Đặc tả yêu cầu Trợ lý AI ERP4U',
          internal_ref: 'https://docs.google.com/document/d/1spec-cuu-erp4u',
          sensitivity: 'internal',
        },
      ];

      for (const s of sourcesData) {
        await queryRunner.manager.save(ChatbotSource, queryRunner.manager.create(ChatbotSource, s));
      }

      // 2. Conflicts (D01 .. D16)
      const conflictsData = [
        {
          code: 'D01',
          title: 'Xung đột chính sách giá sỉ trường học và đại lý',
          risk: 'Báo giá không nhất quán',
          locked_topics: ['price.*'],
          owner_role: 'Sales Director',
          status: 'open',
        },
        {
          code: 'D02',
          title: 'Chiết khấu số lượng lớn >500 bộ',
          risk: 'Vượt thẩm quyền nhân viên',
          locked_topics: ['price.*'],
          owner_role: 'Sales Director',
          status: 'open',
        },
        {
          code: 'D03',
          title: 'Độ dày thành phẩm nệm mầm non (3cm vs 5cm)',
          risk: 'Sai cam kết kỹ thuật sản phẩm',
          locked_topics: ['product.thickness.*'],
          owner_role: 'Production Lead',
          status: 'open',
        },
        {
          code: 'D04',
          title: 'Dung sai độ dày nệm sau chần',
          risk: 'Khiếu nại khách hàng',
          locked_topics: ['product.thickness.foam*'],
          owner_role: 'QC Manager',
          status: 'open',
        },
        {
          code: 'D05',
          title: 'Phí in/thêu logo số lượng ít',
          risk: 'Lỗ chi phí khuôn bản',
          locked_topics: ['service.logo.*', 'price.service.*'],
          owner_role: 'Production Lead',
          status: 'open',
        },
        {
          code: 'D06',
          title: 'MOQ đặt may theo yêu cầu kích thước riêng',
          risk: 'Không đủ định mức vải',
          locked_topics: ['moq.*'],
          owner_role: 'Production Lead',
          status: 'open',
        },
        {
          code: 'D07',
          title: 'Thời gian giao hàng đơn hàng gấp <5 ngày',
          risk: 'Trễ hẹn cam kết',
          locked_topics: ['leadtime.*'],
          owner_role: 'Production Lead',
          status: 'open',
        },
        {
          code: 'D08',
          title: 'Nhãn mác thương hiệu trường trên sản phẩm',
          risk: 'Quy định nhãn hàng',
          locked_topics: ['product.label.*'],
          owner_role: 'Sales Director',
          status: 'open',
        },
        {
          code: 'D09',
          title: 'Quy cách túi đựng vừa bộ nệm gối chăn',
          risk: 'Không vừa kích cỡ túi',
          locked_topics: ['bundle.bag_fit*'],
          owner_role: 'Packaging Lead',
          status: 'open',
        },
        {
          code: 'D10',
          title: 'Phí vận chuyển các tỉnh miền Tây và Tây Nguyên',
          risk: 'Chi phí vận chuyển phát sinh',
          locked_topics: ['shipping.*'],
          owner_role: 'Logistics Lead',
          status: 'open',
        },
        {
          code: 'D11',
          title: 'Thuế VAT 8% hay 10% cho sản phẩm may mặc',
          risk: 'Xuất hóa đơn sai thuế suất',
          locked_topics: ['tax.*'],
          owner_role: 'Chief Accountant',
          status: 'open',
        },
        {
          code: 'D12',
          title: 'Chính sách đổi trả hàng đã in thêu tên bé/trường',
          risk: 'Không thể tái sử dụng hàng hoàn',
          locked_topics: ['policy.return.*', 'policy.warranty.*'],
          owner_role: 'Customer Service',
          status: 'open',
        },
        {
          code: 'D13',
          title: 'Giá combo trọn gói mùa tựu trường',
          risk: 'Áp dụng trùng chương trình khuyến mãi',
          locked_topics: ['price.*'],
          owner_role: 'Sales Director',
          status: 'open',
        },
        {
          code: 'D14',
          title: 'Quy trình xác nhận đơn hàng không cọc',
          risk: 'Rủi ro hủy đơn',
          locked_topics: ['order.*'],
          owner_role: 'Sales Director',
          status: 'open',
        },
        {
          code: 'D15',
          title: 'Công bố chất liệu vải cotton 100% vs CVC',
          risk: 'Quảng cáo sai sự thật',
          locked_topics: ['product.material_claim*'],
          owner_role: 'Product Lead',
          status: 'open',
        },
        {
          code: 'D16',
          title: 'Tài khoản thanh toán cá nhân vs công ty',
          risk: 'Chuyển nhầm tài khoản không được ghi nhận',
          locked_topics: ['payment.*', 'contact.bank*'],
          owner_role: 'Chief Accountant',
          status: 'open',
        },
      ];

      for (const c of conflictsData) {
        await queryRunner.manager.save(ChatbotConflict, queryRunner.manager.create(ChatbotConflict, c));
      }

      // 3. Mark CHATBOT_KB_SEED_V1 done (seed V1 now only contains sources and conflicts)
      const seedMarker = queryRunner.manager.create(SystemConfig, {
        key: 'CHATBOT_KB_SEED_V1',
        value: JSON.stringify({ at: new Date().toISOString(), version: 1 }),
        description: 'Chatbot Knowledge Base Seed V1 marker',
      });
      await queryRunner.manager.save(SystemConfig, seedMarker);

      await queryRunner.commitTransaction();
      this.logger.log('Chatbot KB Seed V1 completed successfully.');
    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Chatbot KB Seed V1 failed: ${err.message}`, err.stack);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async cleanupV1Seed(): Promise<void> {
    const configRepo = this.dataSource.getRepository(SystemConfig);
    const existing = await configRepo.findOne({ where: { key: 'CHATBOT_KB_SEED_V1_CLEANUP' } });
    if (existing) {
      this.logger.log('CHATBOT_KB_SEED_V1_CLEANUP already applied, skipping.');
      return;
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      this.logger.log('Starting CHATBOT_KB_SEED_V1_CLEANUP migration...');

      const targetTopics = [
        'product.spec.mattress_mesh',
        'product.spec.mattress_cotton',
        'product.spec.pillow_flat',
        'product.spec.pillow_hug',
        'product.spec.blanket_cotton',
        'product.spec.bag_canvas',
        'product.spec.bag_waterproof',
        'product.spec.sheet_mesh',
        'product.spec.uniform_boy',
        'product.spec.uniform_girl',
        'product.spec.fabric_safety',
        'script.greeting',
        'script.ask_segment',
        'script.ask_quantity',
        'script.ask_size',
        'script.logo_support',
        'script.lead_contact',
        'script.outside_hours',
        'script.fallback_busy',
      ];

      const qb = queryRunner.manager
        .createQueryBuilder(ChatbotKnowledgeItem, 'item')
        .where('item.topic IN (:...targetTopics)', { targetTopics })
        .andWhere('(item.seed_key IS NULL OR item.seed_key NOT LIKE :kb2Prefix)', { kb2Prefix: 'kb2.%' });

      const items = await qb.getMany();

      let retiredCount = 0;
      let skippedPublishedCount = 0;

      for (const item of items) {
        if (item.status === 'published') {
          this.logger.warn(
            `CHATBOT_KB_SEED_V1_CLEANUP: item ${item.id} (topic: ${item.topic}) is already published, skipping retirement.`,
          );
          skippedPublishedCount++;
        } else if (item.status === 'draft' || item.status === 'needs_review') {
          item.status = 'retired';
          await queryRunner.manager.save(ChatbotKnowledgeItem, item);
          retiredCount++;
        }
      }

      const marker = queryRunner.manager.create(SystemConfig, {
        key: 'CHATBOT_KB_SEED_V1_CLEANUP',
        value: JSON.stringify({
          at: new Date().toISOString(),
          retired_count: retiredCount,
          skipped_published_count: skippedPublishedCount,
        }),
        description: 'Chatbot Knowledge Base Seed V1 Cleanup marker (retire fabricated seed items)',
      });
      await queryRunner.manager.save(SystemConfig, marker);

      await queryRunner.commitTransaction();
      this.logger.log(
        `CHATBOT_KB_SEED_V1_CLEANUP completed: retired=${retiredCount}, skipped_published=${skippedPublishedCount}`,
      );
    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`CHATBOT_KB_SEED_V1_CLEANUP failed: ${err.message}`, err.stack);
    } finally {
      await queryRunner.release();
    }
  }
}
