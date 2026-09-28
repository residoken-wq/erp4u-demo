import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SystemConfig } from '../../system/system-config.entity';
import { ChatbotSource } from '../entities/chatbot-source.entity';
import { ChatbotConflict } from '../entities/chatbot-conflict.entity';
import { ChatbotKnowledgeItem } from '../entities/chatbot-knowledge-item.entity';
import { ChatbotSchemaService } from '../schema/chatbot-schema.service';
import { scanPii, normalizeVi } from '../security/pii';

@Injectable()
export class ChatbotKbSeedService implements OnModuleInit {
  private readonly logger = new Logger(ChatbotKbSeedService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly schemaService: ChatbotSchemaService,
  ) {}

  async onModuleInit() {
    await this.schemaService.initSchema();
    await this.seed();
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
          title: 'Hồ sơ công bố hợp quy & chứng nhận kiểm định dệt may',
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

      // 3. Knowledge Items: 11 spec items (§4.2) + 8 script items (§6.7)
      const specItems = [
        {
          topic: 'product.spec.mattress_mesh',
          question: 'Quy cách nệm lưới mầm non',
          answer: 'Nệm lưới mầm non khung inox, vải lưới thoáng khí kháng khuẩn, chân nhựa chống trầy xước sàn.',
          status: 'needs_review',
          public_allowed: false,
          source_refs: ['S1', 'S4'],
        },
        {
          topic: 'product.spec.mattress_cotton',
          question: 'Quy cách nệm gòn cotton mầm non',
          answer: 'Nệm gòn chần vải cotton 100% Thắng Lợi, ruột gòn polyester nguyên sinh ép nhiệt, có thể gấp gọn.',
          status: 'needs_review',
          public_allowed: false,
          source_refs: ['S1'],
        },
        {
          topic: 'product.spec.pillow_flat',
          question: 'Quy cách gối nằm mầm non',
          answer: 'Gối nằm kích thước 30x45cm hoặc 35x50cm, ruột gòn bi siêu êm ái, vỏ cotton có khóa kéo tiện giặt.',
          status: 'needs_review',
          public_allowed: false,
          source_refs: ['S1'],
        },
        {
          topic: 'product.spec.pillow_hug',
          question: 'Quy cách gối ôm bé',
          answer: 'Gối ôm kích thước 15x60cm, ruột gòn tơi cao cấp, vỏ tháo rời được.',
          status: 'needs_review',
          public_allowed: false,
          source_refs: ['S1'],
        },
        {
          topic: 'product.spec.blanket_cotton',
          question: 'Quy cách chăn mầm non vải cotton',
          answer: 'Chăn cotton 1 lớp hoặc chần gòn hè thu kích thước 110x140cm, mềm nhẹ, thoáng mát cho bé.',
          status: 'needs_review',
          public_allowed: false,
          source_refs: ['S1'],
        },
        {
          topic: 'product.spec.bag_canvas',
          question: 'Quy cách túi đựng nệm canvas',
          answer: 'Túi đựng nệm chất liệu vải bố canvas dày dặn, có quai xách và khóa kéo chắc chắn.',
          status: 'needs_review',
          public_allowed: false,
          source_refs: ['S1'],
        },
        {
          topic: 'product.spec.bag_waterproof',
          question: 'Quy cách túi chống thấm đựng nệm',
          answer: 'Túi vải tráng PU/PVC chống thấm nước, bảo vệ nệm gối sạch sẽ khi di chuyển trời mưa.',
          status: 'needs_review',
          public_allowed: false,
          source_refs: ['S1'],
        },
        {
          topic: 'product.spec.sheet_mesh',
          question: 'Quy cách ga trải nệm lưới',
          answer: 'Ga bọc nệm lưới chất liệu cotton chun 4 góc, giữ ấm lưng cho bé khi nằm điều hòa.',
          status: 'needs_review',
          public_allowed: false,
          source_refs: ['S1'],
        },
        {
          topic: 'product.spec.uniform_boy',
          question: 'Quy cách đồng phục bé trai',
          answer: 'Áo thun cotton cá sấu co giãn 4 chiều phối quần short kaki mềm có thun lưng.',
          status: 'needs_review',
          public_allowed: false,
          source_refs: ['S2'],
        },
        {
          topic: 'product.spec.uniform_girl',
          question: 'Quy cách đồng phục bé gái',
          answer: 'Áo thun kết hợp chân váy xòe có quần lót trong bảo hộ hoặc đầm liền cotton.',
          status: 'needs_review',
          public_allowed: false,
          source_refs: ['S2'],
        },
        {
          topic: 'product.spec.fabric_safety',
          question: 'Tiêu chuẩn an toàn vải dệt may',
          answer: 'Vải đạt chứng nhận không chứa formaldehyde và amin thơm độc hại theo quy chuẩn QCVN 01:2017/BCT.',
          status: 'needs_review',
          public_allowed: false,
          source_refs: ['S4'],
        },
      ];

      const scriptItems = [
        {
          topic: 'script.greeting',
          question: 'Lời chào ban đầu',
          answer: 'Dạ em chào anh/chị ạ! Em là {short_name}, trợ lý của ERP4U. Anh/chị đang cần tìm hiểu nệm gối mầm non hay đồng phục cho các bé ạ?',
          status: 'draft',
          public_allowed: true,
          source_refs: ['SPEC'],
        },
        {
          topic: 'script.ask_segment',
          question: 'Khảo sát phân khúc khách hàng',
          answer: 'Dạ anh/chị đang tham khảo sản phẩm cho trường mầm non, lớp học hay mua cho bé nhà mình ạ?',
          status: 'draft',
          public_allowed: true,
          source_refs: ['SPEC'],
        },
        {
          topic: 'script.ask_quantity',
          question: 'Hỏi số lượng đặt may',
          answer: 'Dạ trường mình dự kiến đặt khoảng bao nhiêu bộ ạ để em hỗ trợ kiểm tra khung giá tốt nhất cho mình ạ?',
          status: 'draft',
          public_allowed: true,
          source_refs: ['SPEC'],
        },
        {
          topic: 'script.ask_size',
          question: 'Hỏi độ tuổi hoặc kích thước',
          answer: 'Dạ các bé ở trường mình nằm giường lưới hay nằm sàn trực tiếp ạ? Bé mấy tuổi để em gợi ý kích thước chuẩn ạ?',
          status: 'draft',
          public_allowed: true,
          source_refs: ['SPEC'],
        },
        {
          topic: 'script.logo_support',
          question: 'Tư vấn in thêu logo',
          answer: 'Dạ bên em có hỗ trợ in thêu tên trường hoặc tên từng bé lên nệm gối và túi đựng ạ.',
          status: 'draft',
          public_allowed: true,
          source_refs: ['SPEC'],
        },
        {
          topic: 'script.lead_contact',
          question: 'Đề nghị liên hệ chuyên viên',
          answer: 'Dạ để gửi bảng mẫu vải và báo giá chiết khấu cụ thể, anh/chị cho em xin số điện thoại hoặc Zalo nhé ạ.',
          status: 'draft',
          public_allowed: true,
          source_refs: ['SPEC'],
        },
        {
          topic: 'script.outside_hours',
          question: 'Thông báo ngoài giờ làm việc',
          answer: 'Dạ hiện tại đang ngoài giờ làm việc của nhân viên tư vấn. Em đã ghi nhận thông tin và chuyên viên sẽ phản hồi sớm nhất vào đầu ca sáng mai ạ.',
          status: 'draft',
          public_allowed: true,
          source_refs: ['SPEC'],
        },
        {
          topic: 'script.fallback_busy',
          question: 'Nhân viên bận ca cao điểm',
          answer: 'Dạ các bạn tư vấn đang hỗ trợ khách khác. Anh/chị để lại thông tin nhu cầu, em sẽ ưu tiên chuyển thông báo ngay ạ.',
          status: 'draft',
          public_allowed: true,
          source_refs: ['SPEC'],
        },
      ];

      const allKnowledge = [...specItems, ...scriptItems];
      for (const k of allKnowledge) {
        const fullText = (k.question || '') + ' ' + k.answer;
        if (scanPii(fullText)) {
          throw new Error(`PII detected in seed knowledge item: ${k.topic}`);
        }
        const searchText = normalizeVi(fullText);
        const item = queryRunner.manager.create(ChatbotKnowledgeItem, {
          ...k,
          search_text: searchText,
        });
        await queryRunner.manager.save(ChatbotKnowledgeItem, item);
      }

      // 4. Mark CHATBOT_KB_SEED_V1 done
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
}
