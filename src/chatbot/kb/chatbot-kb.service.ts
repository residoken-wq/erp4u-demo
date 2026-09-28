import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { ChatbotKnowledgeItem } from '../entities/chatbot-knowledge-item.entity';
import { ChatbotProductFact } from '../entities/chatbot-product-fact.entity';
import { ChatbotBundle } from '../entities/chatbot-bundle.entity';
import { ChatbotPriceRule } from '../entities/chatbot-price-rule.entity';
import { ChatbotConflict } from '../entities/chatbot-conflict.entity';
import { ChatbotSource } from '../entities/chatbot-source.entity';
import { ChatbotAuditEvent } from '../entities/chatbot-audit-event.entity';
import { SystemConfig } from '../../system/system-config.entity';
import { normalizeVi } from '../security/pii';
import { randomUUID } from 'crypto';

export const FACT_TOPIC_MAP: Record<string, string> = {
  size: 'product.spec.size',
  structure: 'product.spec.structure',
  finished_thickness: 'product.thickness.finished',
  material: 'product.material_claim',
  care_instruction: 'product.care',
  age_guidance: 'product.age',
  anti_slip: 'product.spec.anti_slip',
  bag_fit: 'bundle.bag_fit',
  other: 'product.other',
};

const ALLOWED_TYPES = ['knowledge', 'facts', 'bundles', 'prices'] as const;
type KbType = (typeof ALLOWED_TYPES)[number];

@Injectable()
export class ChatbotKbService {
  private readonly logger = new Logger(ChatbotKbService.name);

  constructor(private readonly dataSource: DataSource) {}

  getEntityClass(type: string) {
    switch (type) {
      case 'knowledge':
        return ChatbotKnowledgeItem;
      case 'facts':
        return ChatbotProductFact;
      case 'bundles':
        return ChatbotBundle;
      case 'prices':
        return ChatbotPriceRule;
      default:
        throw new BadRequestException({ code: 'INVALID_TYPE', message: `Invalid KB type: ${type}` });
    }
  }

  getVietnamDate(d: Date = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(d);
  }

  // --- 1. Find List ---
  async findList(type: string, query: any) {
    const entityClass = this.getEntityClass(type);
    const repo = this.dataSource.getRepository(entityClass);
    const qb = repo.createQueryBuilder('item');

    if (query.status) {
      qb.andWhere('item.status = :status', { status: query.status });
    }
    if (query.topic) {
      qb.andWhere('item.topic = :topic', { topic: query.topic });
    }
    if (query.sku && (type === 'facts' || type === 'knowledge')) {
      if (type === 'facts') {
        qb.andWhere('item.sku = :sku', { sku: query.sku });
      } else {
        qb.andWhere('item.product_sku = :sku', { sku: query.sku });
      }
    }
    if (query.q) {
      const qNorm = normalizeVi(query.q);
      if (type === 'knowledge') {
        qb.andWhere('item.search_text ILIKE :q', { q: `%${qNorm}%` });
      } else if (type === 'facts') {
        qb.andWhere('(item.sku ILIKE :q OR item.value ILIKE :q)', { q: `%${query.q}%` });
      } else if (type === 'bundles') {
        qb.andWhere('(item.code ILIKE :q OR item.name ILIKE :q)', { q: `%${query.q}%` });
      } else if (type === 'prices') {
        qb.andWhere('item.target_code ILIKE :q', { q: `%${query.q}%` });
      }
    }

    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(query.limit || '50', 10)));
    qb.skip((page - 1) * limit).take(limit);
    qb.orderBy('item.created_at', 'DESC');

    const [items, total] = await qb.getManyAndCount();

    const mappedItems = items.map((it: any) => {
      if (type === 'prices') {
        return {
          ...it,
          valid_from: it.effective_from,
          valid_to: it.effective_to,
        };
      }
      return it;
    });

    return { items: mappedItems, total };
  }

  // --- 2. Find One with Versions & Previous Published ---
  async findOne(type: string, id: string) {
    if (!id || !/^[0-9a-fA-F-]{36}$/.test(id)) {
      throw new BadRequestException({ code: 'INVALID_ID', message: `Invalid UUID: ${id}` });
    }
    const entityClass = this.getEntityClass(type);
    const repo = this.dataSource.getRepository(entityClass);
    const item = (await repo.findOne({ where: { id } as any })) as any;
    if (!item) {
      throw new NotFoundException(`Item ${id} not found in ${type}`);
    }

    // Versions with same item_key
    const allVersions = (await repo.find({
      where: { item_key: item.item_key } as any,
      order: { version: 'ASC' } as any,
    })) as any[];

    const versions = allVersions.map((v) => ({
      id: v.id,
      version: v.version,
      status: v.status,
      updated_at: v.updated_at,
    }));

    // Previous published (the published version, or highest version retired)
    const prevPublished =
      allVersions.find((v) => v.status === 'published' && v.id !== item.id) ||
      allVersions
        .filter((v) => v.status === 'retired' && v.id !== item.id)
        .sort((a, b) => b.version - a.version)[0] ||
      null;

    let resItem = { ...item };
    if (type === 'prices') {
      resItem.valid_from = item.effective_from;
      resItem.valid_to = item.effective_to;
    }

    return {
      ...resItem,
      versions,
      previous_published: prevPublished,
    };
  }

  // --- Validation Helpers ---
  private validateKnowledge(dto: any) {
    const allowed = [
      'topic',
      'question',
      'answer',
      'product_sku',
      'public_allowed',
      'source_refs',
      'conflict_code',
      'effective_from',
      'effective_to',
      'intent',
    ];
    for (const k of Object.keys(dto)) {
      if (!allowed.includes(k)) {
        throw new BadRequestException({ code: 'UNKNOWN_FIELD', message: `Unknown field: ${k}` });
      }
    }
    if (!dto.topic || typeof dto.topic !== 'string') {
      throw new BadRequestException('Topic is required');
    }
    if (!/^[a-z0-9_.]+$/.test(dto.topic)) {
      throw new BadRequestException('Topic must match ^[a-z0-9_.]+$');
    }
    if (!dto.answer || typeof dto.answer !== 'string' || !dto.answer.trim()) {
      throw new BadRequestException('Answer is required');
    }
  }

  private async validateFacts(dto: any) {
    const allowed = [
      'sku',
      'fact_key',
      'value',
      'unit',
      'source_refs',
      'conflict_code',
      'effective_from',
      'effective_to',
    ];
    for (const k of Object.keys(dto)) {
      if (!allowed.includes(k)) {
        throw new BadRequestException({ code: 'UNKNOWN_FIELD', message: `Unknown field: ${k}` });
      }
    }
    if (!dto.sku) throw new BadRequestException('SKU is required');
    if (!dto.fact_key || !FACT_TOPIC_MAP[dto.fact_key]) {
      throw new BadRequestException({ code: 'INVALID_FACT_KEY', message: `Invalid fact_key: ${dto.fact_key}` });
    }
    if (dto.value === undefined || dto.value === null) {
      throw new BadRequestException('Value is required');
    }

    // Verify sku on website
    const prodRes = await this.dataSource.query(
      'SELECT id, sku FROM products WHERE sku = $1 AND show_on_website = true LIMIT 1',
      [dto.sku],
    );
    if (!prodRes || prodRes.length === 0) {
      throw new BadRequestException({ code: 'SKU_NOT_ON_WEBSITE', message: `SKU not on website: ${dto.sku}` });
    }
  }

  private async validateBundles(dto: any) {
    const allowed = [
      'code',
      'name',
      'items',
      'source_refs',
      'conflict_code',
      'effective_from',
      'effective_to',
    ];
    for (const k of Object.keys(dto)) {
      if (!allowed.includes(k)) {
        throw new BadRequestException({ code: 'UNKNOWN_FIELD', message: `Unknown field: ${k}` });
      }
    }
    if (!dto.code || typeof dto.code !== 'string') throw new BadRequestException('Code is required');
    if (!dto.name || typeof dto.name !== 'string') throw new BadRequestException('Name is required');
    if (!Array.isArray(dto.items) || dto.items.length === 0) {
      throw new BadRequestException('Items array must have at least 1 item');
    }

    for (const it of dto.items) {
      if (!it.sku || typeof it.sku !== 'string') throw new BadRequestException('Item sku is required');
      if (!it.qty || it.qty < 1) throw new BadRequestException('Item qty must be >= 1');
      const prodRes = await this.dataSource.query(
        'SELECT id FROM products WHERE sku = $1 AND show_on_website = true LIMIT 1',
        [it.sku],
      );
      if (!prodRes || prodRes.length === 0) {
        throw new BadRequestException({ code: 'SKU_NOT_ON_WEBSITE', message: `Item SKU not on website: ${it.sku}` });
      }
    }
  }

  private validatePrices(dto: any) {
    const allowed = [
      'target_type',
      'target_code',
      'fabric',
      'qty_min',
      'qty_max',
      'qty_scope',
      'unit_price',
      'currency',
      'tax_rate',
      'tax_included',
      'shipping_included',
      'included_services',
      'excluded_services',
      'customer_scope',
      'is_fixture',
      'source_refs',
      'conflict_code',
      'effective_from',
      'effective_to',
      'valid_from',
      'valid_to',
    ];
    for (const k of Object.keys(dto)) {
      if (!allowed.includes(k)) {
        throw new BadRequestException({ code: 'UNKNOWN_FIELD', message: `Unknown field: ${k}` });
      }
    }

    if (!dto.target_type || !['sku', 'bundle', 'service'].includes(dto.target_type)) {
      throw new BadRequestException('target_type must be sku, bundle, or service');
    }
    if (!dto.target_code) throw new BadRequestException('target_code is required');
    if (dto.qty_min === undefined || dto.qty_min < 1 || !Number.isInteger(dto.qty_min)) {
      throw new BadRequestException('qty_min must be an integer >= 1');
    }
    if (dto.qty_max !== undefined && dto.qty_max !== null) {
      if (!Number.isInteger(dto.qty_max) || dto.qty_max < dto.qty_min) {
        throw new BadRequestException('qty_max must be an integer >= qty_min');
      }
    }
    if (
      dto.unit_price === undefined ||
      dto.unit_price < 0 ||
      !Number.isInteger(dto.unit_price)
    ) {
      throw new BadRequestException('unit_price must be an integer >= 0');
    }
    const validFrom = dto.valid_from || dto.effective_from;
    if (!validFrom) {
      throw new BadRequestException('valid_from (or effective_from) is required');
    }
    const customerScope = dto.customer_scope || 'PUBLIC';
    if (!/^(PUBLIC|CUSTOMER:\d+)$/.test(customerScope)) {
      throw new BadRequestException('customer_scope must match ^(PUBLIC|CUSTOMER:\\d+)$');
    }
  }

  // --- 3. Create (Draft, v1) ---
  async create(type: string, dto: any, userId?: number) {
    const entityClass = this.getEntityClass(type);
    const repo = this.dataSource.getRepository(entityClass);

    let topic = dto.topic;
    let searchText = '';

    if (type === 'knowledge') {
      this.validateKnowledge(dto);
      searchText = normalizeVi((dto.question || '') + ' ' + dto.answer);
    } else if (type === 'facts') {
      await this.validateFacts(dto);
      topic = FACT_TOPIC_MAP[dto.fact_key] || `product.fact.${dto.fact_key}`;
    } else if (type === 'bundles') {
      await this.validateBundles(dto);
      topic = `bundle.${dto.code}`;
    } else if (type === 'prices') {
      this.validatePrices(dto);
      topic = `price.${dto.target_type}.${dto.target_code}`;
      if (dto.valid_from && !dto.effective_from) dto.effective_from = dto.valid_from;
      if (dto.valid_to && !dto.effective_to) dto.effective_to = dto.valid_to;
    }

    const item = repo.create({
      ...dto,
      item_key: dto.item_key || randomUUID(),
      topic,
      search_text: searchText,
      version: 1,
      status: 'draft',
      author_id: userId || null,
    });

    return await repo.save(item);
  }

  // --- 4. Update ---
  async update(type: string, id: string, dto: any, userId?: number) {
    if (!id || !/^[0-9a-fA-F-]{36}$/.test(id)) {
      throw new BadRequestException({ code: 'INVALID_ID', message: `Invalid UUID: ${id}` });
    }

    const entityClass = this.getEntityClass(type);
    const repo = this.dataSource.getRepository(entityClass);
    const existing = (await repo.findOne({ where: { id } as any })) as any;
    if (!existing) {
      throw new NotFoundException(`Item ${id} not found in ${type}`);
    }

    if (existing.status === 'retired') {
      throw new BadRequestException({ code: 'INVALID_STATE', message: 'Cannot edit retired item' });
    }

    // Validate fields according to type
    if (type === 'knowledge') {
      const allowed = [
        'topic',
        'question',
        'answer',
        'product_sku',
        'public_allowed',
        'source_refs',
        'conflict_code',
        'effective_from',
        'effective_to',
        'intent',
      ];
      for (const k of Object.keys(dto)) {
        if (!allowed.includes(k)) {
          throw new BadRequestException({ code: 'UNKNOWN_FIELD', message: `Unknown field: ${k}` });
        }
      }
      if (dto.topic !== undefined) {
        if (!dto.topic || typeof dto.topic !== 'string' || !/^[a-z0-9_.]+$/.test(dto.topic)) {
          throw new BadRequestException('Topic must match ^[a-z0-9_.]+$');
        }
      }
      if (dto.answer !== undefined) {
        if (!dto.answer || typeof dto.answer !== 'string' || !dto.answer.trim()) {
          throw new BadRequestException('Answer is required');
        }
      }
    } else if (type === 'facts') {
      const allowed = [
        'sku',
        'fact_key',
        'value',
        'unit',
        'source_refs',
        'conflict_code',
        'effective_from',
        'effective_to',
      ];
      for (const k of Object.keys(dto)) {
        if (!allowed.includes(k)) {
          throw new BadRequestException({ code: 'UNKNOWN_FIELD', message: `Unknown field: ${k}` });
        }
      }
      if (dto.fact_key && !FACT_TOPIC_MAP[dto.fact_key]) {
        throw new BadRequestException({ code: 'INVALID_FACT_KEY', message: `Invalid fact_key: ${dto.fact_key}` });
      }
      if (dto.sku) {
        const prodRes = await this.dataSource.query(
          'SELECT id, sku FROM products WHERE sku = $1 AND show_on_website = true LIMIT 1',
          [dto.sku],
        );
        if (!prodRes || prodRes.length === 0) {
          throw new BadRequestException({ code: 'SKU_NOT_ON_WEBSITE', message: `SKU not on website: ${dto.sku}` });
        }
      }
    } else if (type === 'bundles') {
      const allowed = [
        'code',
        'name',
        'items',
        'source_refs',
        'conflict_code',
        'effective_from',
        'effective_to',
      ];
      for (const k of Object.keys(dto)) {
        if (!allowed.includes(k)) {
          throw new BadRequestException({ code: 'UNKNOWN_FIELD', message: `Unknown field: ${k}` });
        }
      }
      if (dto.items !== undefined) {
        if (!Array.isArray(dto.items) || dto.items.length === 0) {
          throw new BadRequestException('Items array must have at least 1 item');
        }
        for (const it of dto.items) {
          if (!it.sku || typeof it.sku !== 'string') throw new BadRequestException('Item sku is required');
          if (!it.qty || it.qty < 1) throw new BadRequestException('Item qty must be >= 1');
          const prodRes = await this.dataSource.query(
            'SELECT id FROM products WHERE sku = $1 AND show_on_website = true LIMIT 1',
            [it.sku],
          );
          if (!prodRes || prodRes.length === 0) {
            throw new BadRequestException({ code: 'SKU_NOT_ON_WEBSITE', message: `Item SKU not on website: ${it.sku}` });
          }
        }
      }
    } else if (type === 'prices') {
      const allowed = [
        'target_type',
        'target_code',
        'fabric',
        'qty_min',
        'qty_max',
        'qty_scope',
        'unit_price',
        'currency',
        'tax_rate',
        'tax_included',
        'shipping_included',
        'included_services',
        'excluded_services',
        'customer_scope',
        'is_fixture',
        'source_refs',
        'conflict_code',
        'effective_from',
        'effective_to',
        'valid_from',
        'valid_to',
      ];
      for (const k of Object.keys(dto)) {
        if (!allowed.includes(k)) {
          throw new BadRequestException({ code: 'UNKNOWN_FIELD', message: `Unknown field: ${k}` });
        }
      }
      if (dto.target_type && !['sku', 'bundle', 'service'].includes(dto.target_type)) {
        throw new BadRequestException('target_type must be sku, bundle, or service');
      }
      if (dto.qty_min !== undefined && (dto.qty_min < 1 || !Number.isInteger(dto.qty_min))) {
        throw new BadRequestException('qty_min must be an integer >= 1');
      }
      if (dto.qty_max !== undefined && dto.qty_max !== null) {
        const min = dto.qty_min ?? existing.qty_min;
        if (!Number.isInteger(dto.qty_max) || dto.qty_max < min) {
          throw new BadRequestException('qty_max must be an integer >= qty_min');
        }
      }
      if (dto.unit_price !== undefined && (dto.unit_price < 0 || !Number.isInteger(dto.unit_price))) {
        throw new BadRequestException('unit_price must be an integer >= 0');
      }
      if (dto.customer_scope && !/^(PUBLIC|CUSTOMER:\d+)$/.test(dto.customer_scope)) {
        throw new BadRequestException('customer_scope must match ^(PUBLIC|CUSTOMER:\\d+)$');
      }
      if (dto.valid_from && !dto.effective_from) dto.effective_from = dto.valid_from;
      if (dto.valid_to && !dto.effective_to) dto.effective_to = dto.valid_to;
    }

    // If draft or needs_review: update in-place
    if (existing.status === 'draft' || existing.status === 'needs_review') {
      Object.assign(existing, dto);
      if (type === 'knowledge') {
        existing.search_text = normalizeVi((existing.question || '') + ' ' + existing.answer);
      }
      return await repo.save(existing);
    }

    // If published: create new draft version
    if (existing.status === 'published') {
      const { id: _oldId, created_at: _c, updated_at: _u, ...rest } = existing;
      let newTopic = rest.topic;
      if (type === 'facts' && dto.fact_key) {
        newTopic = FACT_TOPIC_MAP[dto.fact_key] || newTopic;
      }
      if (type === 'bundles' && dto.code) {
        newTopic = `bundle.${dto.code}`;
      }
      if (type === 'prices' && (dto.target_type || dto.target_code)) {
        newTopic = `price.${dto.target_type || rest.target_type}.${dto.target_code || rest.target_code}`;
      }

      let newSearchText = rest.search_text;
      if (type === 'knowledge') {
        const q = dto.question !== undefined ? dto.question : rest.question;
        const a = dto.answer !== undefined ? dto.answer : rest.answer;
        newSearchText = normalizeVi((q || '') + ' ' + a);
      }

      const newVersionItem = repo.create({
        ...rest,
        ...dto,
        topic: newTopic,
        search_text: newSearchText,
        version: existing.version + 1,
        status: 'draft',
        author_id: userId || null,
        approver_id: null,
        approved_at: null,
      });

      return await repo.save(newVersionItem);
    }
  }

  // --- 5. Submit ---
  async submit(type: string, id: string, userId?: number) {
    if (!id || !/^[0-9a-fA-F-]{36}$/.test(id)) {
      throw new BadRequestException({ code: 'INVALID_ID', message: `Invalid UUID: ${id}` });
    }
    const entityClass = this.getEntityClass(type);
    const repo = this.dataSource.getRepository(entityClass);
    const item = (await repo.findOne({ where: { id } as any })) as any;
    if (!item) {
      throw new NotFoundException(`Item ${id} not found in ${type}`);
    }

    item.status = 'needs_review';
    return await repo.save(item);
  }

  // --- 6. Publish ---
  async publish(type: string, id: string, userId?: number) {
    if (!id || !/^[0-9a-fA-F-]{36}$/.test(id)) {
      throw new BadRequestException({ code: 'INVALID_ID', message: `Invalid UUID: ${id}` });
    }
    const entityClass = this.getEntityClass(type);
    const repo = this.dataSource.getRepository(entityClass);
    const item = (await repo.findOne({ where: { id } as any })) as any;
    if (!item) {
      throw new NotFoundException(`Item ${id} not found in ${type}`);
    }

    // 1. Conflict lock check
    const conflictRepo = this.dataSource.getRepository(ChatbotConflict);
    const openConflicts = await conflictRepo.find({ where: { status: 'open' } });
    const matchedConflictCodes: string[] = [];

    for (const c of openConflicts) {
      // Direct conflict_code match
      if (item.conflict_code && item.conflict_code === c.code) {
        matchedConflictCodes.push(c.code);
        continue;
      }
      // Topic match against locked_topics patterns
      if (Array.isArray(c.locked_topics) && item.topic) {
        for (const pattern of c.locked_topics) {
          if (pattern.endsWith('*')) {
            const prefix = pattern.slice(0, -1);
            if (item.topic.startsWith(prefix)) {
              matchedConflictCodes.push(c.code);
              break;
            }
          } else if (item.topic === pattern) {
            matchedConflictCodes.push(c.code);
            break;
          }
        }
      }
    }

    if (matchedConflictCodes.length > 0) {
      throw new ConflictException({
        code: 'CONFLICT_LOCKED',
        conflicts: Array.from(new Set(matchedConflictCodes)),
      });
    }

    // 2. Prices specific checks
    if (type === 'prices') {
      if (item.is_fixture && process.env.CHATBOT_ALLOW_FIXTURES !== 'true') {
        throw new BadRequestException({ code: 'FIXTURE_NOT_ALLOWED' });
      }

      // Check price overlap
      const priceRepo = this.dataSource.getRepository(ChatbotPriceRule);
      const existingRules = await priceRepo.find({
        where: {
          status: 'published',
          target_type: item.target_type,
          target_code: item.target_code,
          customer_scope: item.customer_scope || 'PUBLIC',
        },
      });

      const overlappingRules: string[] = [];
      const itemFrom = item.effective_from || '1970-01-01';
      const itemTo = item.effective_to || '9999-12-31';

      for (const r of existingRules) {
        // Compare fabric (null equals null)
        const sameFabric = (item.fabric || null) === (r.fabric || null);
        if (!sameFabric) continue;

        // Skip if same item_key (updating itself)
        if (r.item_key === item.item_key) continue;

        // Quantity overlap
        const rMax = r.qty_max ?? Infinity;
        const itemMax = item.qty_max ?? Infinity;
        const qtyOverlap = item.qty_min <= rMax && itemMax >= r.qty_min;

        // Date overlap
        const rFrom = r.effective_from || '1970-01-01';
        const rTo = r.effective_to || '9999-12-31';
        const dateOverlap = itemFrom <= rTo && itemTo >= rFrom;

        if (qtyOverlap && dateOverlap) {
          overlappingRules.push(r.id);
        }
      }

      if (overlappingRules.length > 0) {
        throw new ConflictException({
          code: 'PRICE_CONFLICT',
          rule_ids: overlappingRules,
        });
      }
    }

    // 3. Execute publish in transaction
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      // Retire old published item with same item_key
      await qr.manager.update(
        entityClass,
        { item_key: item.item_key, status: 'published' } as any,
        { status: 'retired' } as any,
      );

      // Publish current item
      item.status = 'published';
      item.approver_id = userId || null;
      item.approved_at = new Date();
      const savedItem = await qr.manager.save(entityClass, item);

      // Bump CHATBOT_KB_VERSION
      await qr.manager.query(`
        INSERT INTO system_configs (key, value, description)
        VALUES ('CHATBOT_KB_VERSION', '1', 'Chatbot Knowledge Base version')
        ON CONFLICT (key) DO UPDATE
        SET value = (COALESCE(system_configs.value::int, 0) + 1)::text;
      `);

      // Record audit event
      const audit = qr.manager.create(ChatbotAuditEvent, {
        actor_type: userId ? 'user' : 'system',
        actor_user_id: userId || null,
        op: 'kb.publish',
        object_type: type,
        object_id: item.id,
        after_ref: { item_key: item.item_key, version: item.version, topic: item.topic },
      });
      await qr.manager.save(ChatbotAuditEvent, audit);

      await qr.commitTransaction();
      return savedItem;
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  // --- 7. Retire ---
  async retire(type: string, id: string, userId?: number) {
    if (!id || !/^[0-9a-fA-F-]{36}$/.test(id)) {
      throw new BadRequestException({ code: 'INVALID_ID', message: `Invalid UUID: ${id}` });
    }
    const entityClass = this.getEntityClass(type);
    const repo = this.dataSource.getRepository(entityClass);
    const item = (await repo.findOne({ where: { id } as any })) as any;
    if (!item) {
      throw new NotFoundException(`Item ${id} not found in ${type}`);
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      item.status = 'retired';
      const savedItem = await qr.manager.save(entityClass, item);

      await qr.manager.query(`
        INSERT INTO system_configs (key, value, description)
        VALUES ('CHATBOT_KB_VERSION', '1', 'Chatbot Knowledge Base version')
        ON CONFLICT (key) DO UPDATE
        SET value = (COALESCE(system_configs.value::int, 0) + 1)::text;
      `);

      const audit = qr.manager.create(ChatbotAuditEvent, {
        actor_type: userId ? 'user' : 'system',
        actor_user_id: userId || null,
        op: 'kb.retire',
        object_type: type,
        object_id: item.id,
        after_ref: { item_key: item.item_key, version: item.version },
      });
      await qr.manager.save(ChatbotAuditEvent, audit);

      await qr.commitTransaction();
      return savedItem;
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  // --- 8. Conflicts Management ---
  async getConflicts() {
    const repo = this.dataSource.getRepository(ChatbotConflict);
    const items = await repo.find({ order: { code: 'ASC' } });
    return { items };
  }

  async resolveConflict(code: string, dto: any, userId?: number) {
    const repo = this.dataSource.getRepository(ChatbotConflict);
    const conflict = await repo.findOne({ where: { code } });
    if (!conflict) {
      throw new NotFoundException(`Conflict ${code} not found`);
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      conflict.status = dto.status || 'resolved';
      conflict.resolution = dto.resolution || null;
      if (conflict.status === 'resolved') {
        conflict.resolved_by = userId || null;
        conflict.resolved_at = new Date();
      } else {
        conflict.resolved_by = null;
        conflict.resolved_at = null;
      }
      const saved = await qr.manager.save(ChatbotConflict, conflict);

      await qr.manager.query(`
        INSERT INTO system_configs (key, value, description)
        VALUES ('CHATBOT_KB_VERSION', '1', 'Chatbot Knowledge Base version')
        ON CONFLICT (key) DO UPDATE
        SET value = (COALESCE(system_configs.value::int, 0) + 1)::text;
      `);

      const audit = qr.manager.create(ChatbotAuditEvent, {
        actor_type: userId ? 'user' : 'system',
        actor_user_id: userId || null,
        op: 'kb.conflict',
        object_type: 'conflict',
        object_id: conflict.code,
        after_ref: { status: conflict.status, resolution: conflict.resolution },
      });
      await qr.manager.save(ChatbotAuditEvent, audit);

      await qr.commitTransaction();
      return saved;
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  // --- 9. Sources ---
  async getSources() {
    const repo = this.dataSource.getRepository(ChatbotSource);
    const items = await repo.find({ order: { code: 'ASC' } });
    return { items };
  }

  // --- 10. Website Products ---
  async getWebsiteProducts(q?: string) {
    let sql = 'SELECT sku, name, website_display_name, image_url FROM products WHERE show_on_website = true';
    const params: any[] = [];
    if (q) {
      sql += ' AND (sku ILIKE $1 OR name ILIKE $1)';
      params.push(`%${q}%`);
    }
    sql += ' ORDER BY website_order ASC, name ASC LIMIT 50';
    const rows = await this.dataSource.query(sql, params);
    const items = rows.map((r: any) => ({
      sku: r.sku,
      name: r.name,
      display_name: r.website_display_name || r.name,
      image_url: r.image_url,
    }));
    return { items };
  }

  // --- 11. Version ---
  async getVersion() {
    const configRepo = this.dataSource.getRepository(SystemConfig);
    const cfg = await configRepo.findOne({ where: { key: 'CHATBOT_KB_VERSION' } });
    const kbVersion = cfg && cfg.value ? parseInt(cfg.value, 10) : 0;
    return {
      kb_version: kbVersion,
      allow_fixtures: process.env.CHATBOT_ALLOW_FIXTURES === 'true',
    };
  }
}
