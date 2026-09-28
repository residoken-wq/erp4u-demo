import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ChatbotKnowledgeItem } from '../entities/chatbot-knowledge-item.entity';
import { ChatbotProductFact } from '../entities/chatbot-product-fact.entity';
import { ChatbotPriceRule } from '../entities/chatbot-price-rule.entity';
import { ChatbotConfigService } from '../config/chatbot-config.service';
import { normalizeVi } from '../security/pii';
import { renderKnowledgeAnswer } from './knowledge-template';
import { detectTopicHint } from '../llm/fake.provider';
import { redactPiiForLlm } from '../conversation/reply-validator';

const STOP_WORDS = new Set([
  'a', 'o', 'oi', 'nhe', 'nha', 'thi', 'la', 'co', 'khong', 'cho', 'em', 'anh',
  'chi', 'minh', 'ben', 'cua', 'va', 'hay', 'duoc', 'voi', 'cac', 'nhung',
  'nay', 'do', 'bao', 'nhieu', 'gi', 'nao', 'the', 'ra', 'vao', 'muon', 'can',
  'toi', 'ah', 'u', 'vay', 'roi', 'luon', 'giup', 'xin',
]);

@Injectable()
export class ChatbotToolsService {
  private readonly logger = new Logger(ChatbotToolsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ChatbotConfigService,
  ) {}

  private getVietnamToday(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  }

  // --- 1. searchKnowledge ---
  async searchKnowledge(args: { query: string; intent?: string; limit?: number }) {
    if (!args || !args.query) {
      return { items: [] };
    }

    const today = this.getVietnamToday();
    const limit = Math.min(5, Math.max(1, args.limit || 5));
    const normQuery = normalizeVi(args.query).trim();

    const repo = this.dataSource.getRepository(ChatbotKnowledgeItem);

    // 1. Try FTS using plainto_tsquery('simple', :normQuery)
    const ftsQb = repo.createQueryBuilder('item')
      .where('item.status = :status', { status: 'published' })
      .andWhere('item.public_allowed = true')
      .andWhere('(item.effective_from IS NULL OR item.effective_from <= :today)', { today })
      .andWhere('(item.effective_to IS NULL OR item.effective_to >= :today)', { today });

    if (args.intent) {
      ftsQb.andWhere('item.intent = :intent', { intent: args.intent });
    }

    ftsQb.andWhere(
      "to_tsvector('simple', item.search_text) @@ plainto_tsquery('simple', :normQuery)",
      { normQuery },
    );
    ftsQb.take(limit);

    let items = await ftsQb.getMany();

    // 2. If no results, fallback to ILIKE for each word (AND logic)
    if (!items || items.length === 0) {
      const words = normQuery.split(/\s+/).filter(Boolean);
      if (words.length > 0) {
        const fallbackQb = repo.createQueryBuilder('item')
          .where('item.status = :status', { status: 'published' })
          .andWhere('item.public_allowed = true')
          .andWhere('(item.effective_from IS NULL OR item.effective_from <= :today)', { today })
          .andWhere('(item.effective_to IS NULL OR item.effective_to >= :today)', { today });

        if (args.intent) {
          fallbackQb.andWhere('item.intent = :intent', { intent: args.intent });
        }

        words.forEach((word, idx) => {
          fallbackQb.andWhere(`item.search_text ILIKE :w${idx}`, { [`w${idx}`]: `%${word}%` });
        });

        fallbackQb.take(limit);
        items = await fallbackQb.getMany();
      }
    }

    // Map strictly without leaking source_refs or internal URLs
    const publicView = await this.configService.publicView();
    const resultItems = (items || []).map((it) => ({
      id: it.id,
      item_key: it.item_key,
      version: it.version,
      topic: it.topic,
      question: it.question,
      answer: renderKnowledgeAnswer(it.answer, publicView),
    }));

    return { items: resultItems };
  }

  // --- 2. searchCatalog ---
  async searchCatalog(args: { keywords?: string; skus?: string[] }) {
    const today = this.getVietnamToday();

    // Query published facts in publicScope
    const factsSql = `
      SELECT f.sku, f.fact_key, f.value, f.unit
      FROM chatbot_product_facts f
      JOIN products p ON p.sku = f.sku
      WHERE f.status = 'published'
        AND (f.effective_from IS NULL OR f.effective_from <= $1)
        AND (f.effective_to IS NULL OR f.effective_to >= $1)
        AND p.show_on_website = true
    `;
    const factsRows: any[] = await this.dataSource.query(factsSql, [today]);

    // Group facts by SKU
    const factsBySku = new Map<string, Array<{ fact_key: string; value: string; unit: string | null }>>();
    for (const r of factsRows) {
      if (!factsBySku.has(r.sku)) {
        factsBySku.set(r.sku, []);
      }
      factsBySku.get(r.sku)!.push({
        fact_key: r.fact_key,
        value: r.value,
        unit: r.unit || null,
      });
    }

    // Only products with at least 1 fact in publicScope
    const eligibleSkus = Array.from(factsBySku.keys());
    if (eligibleSkus.length === 0) {
      return { items: [] };
    }

    let prodSql = `
      SELECT sku, name, website_display_name, image_url
      FROM products
      WHERE show_on_website = true
        AND sku = ANY($1)
    `;
    const params: any[] = [eligibleSkus];

    if (args.skus && Array.isArray(args.skus) && args.skus.length > 0) {
      prodSql += ` AND sku = ANY($${params.length + 1})`;
      params.push(args.skus);
    }

    if (args.keywords) {
      prodSql += ` AND (name ILIKE $${params.length + 1} OR sku ILIKE $${params.length + 1})`;
      params.push(`%${args.keywords}%`);
    }

    prodSql += ' ORDER BY website_order ASC, name ASC LIMIT 5';

    const products: any[] = await this.dataSource.query(prodSql, params);

    const items = products.map((p) => ({
      sku: p.sku,
      name: p.website_display_name || p.name,
      image_url: p.image_url,
      facts: factsBySku.get(p.sku) || [],
    }));

    return { items };
  }

  // --- 3. getProductDetails ---
  async getProductDetails(args: { sku: string }) {
    if (!args || !args.sku) {
      return { product: null };
    }

    const today = this.getVietnamToday();

    // Verify sku is on website
    const prodRows: any[] = await this.dataSource.query(
      `SELECT sku, name, website_display_name, image_url
       FROM products
       WHERE sku = $1 AND show_on_website = true
       LIMIT 1`,
      [args.sku],
    );

    if (!prodRows || prodRows.length === 0) {
      return { product: null };
    }

    const prod = prodRows[0];

    // Get facts in publicScope
    const factRepo = this.dataSource.getRepository(ChatbotProductFact);
    const facts = await factRepo
      .createQueryBuilder('f')
      .where('f.sku = :sku', { sku: args.sku })
      .andWhere('f.status = :status', { status: 'published' })
      .andWhere('(f.effective_from IS NULL OR f.effective_from <= :today)', { today })
      .andWhere('(f.effective_to IS NULL OR f.effective_to >= :today)', { today })
      .orderBy('f.created_at', 'ASC')
      .getMany();

    return {
      product: {
        sku: prod.sku,
        name: prod.website_display_name || prod.name,
        image_url: prod.image_url,
        facts: facts.map((f) => ({
          fact_key: f.fact_key,
          value: f.value,
          unit: f.unit || null,
        })),
      },
    };
  }

  // --- 4. compareProducts ---
  async compareProducts(args: { skus: string[] }) {
    if (!args || !Array.isArray(args.skus) || args.skus.length < 2 || args.skus.length > 3) {
      throw new BadRequestException('skus must contain between 2 and 3 items');
    }

    const today = this.getVietnamToday();
    const skus = args.skus;

    // Get facts for all requested skus in publicScope
    const facts: any[] = await this.dataSource.query(
      `SELECT sku, fact_key, value, unit
       FROM chatbot_product_facts
       WHERE status = 'published'
         AND sku = ANY($1)
         AND (effective_from IS NULL OR effective_from <= $2)
         AND (effective_to IS NULL OR effective_to >= $2)
       ORDER BY created_at ASC`,
      [skus, today],
    );

    // Group facts by sku and fact_key
    const factMap = new Map<string, Map<string, string>>();
    const allFactKeys = new Set<string>();

    for (const f of facts) {
      if (!factMap.has(f.sku)) {
        factMap.set(f.sku, new Map());
      }
      const valStr = f.unit ? `${f.value} ${f.unit}` : f.value;
      factMap.get(f.sku)!.set(f.fact_key, valStr);
      allFactKeys.add(f.fact_key);
    }

    const rows: Array<{ fact_key: string; values: Record<string, string> }> = [];
    for (const fk of allFactKeys) {
      const values: Record<string, string> = {};
      for (const sku of skus) {
        const skuFacts = factMap.get(sku);
        if (skuFacts && skuFacts.has(fk)) {
          values[sku] = skuFacts.get(fk)!;
        } else {
          values[sku] = 'chưa xác nhận';
        }
      }
      rows.push({ fact_key: fk, values });
    }

    return { skus, rows };
  }

  // --- 5. getPriceEstimate ---
  async getPriceEstimate(
    args: {
      target_type: string;
      target_code: string;
      quantity: number;
      fabric?: string;
      services?: Array<{ code: string; quantity?: number }>;
      requested_tier_qty?: number;
      ignore_feature_flag?: boolean;
    },
    ignoreFlagParam?: boolean,
  ) {
    const ignoreFeatureFlag =
      args.ignore_feature_flag === true || ignoreFlagParam === true;

    // 1. Check feature flag
    if (!ignoreFeatureFlag) {
      const config = await this.configService.get();
      if (!config.features?.price_estimate) {
        return { status: 'disabled' };
      }
    }

    // 2. requested_tier_qty > quantity check
    if (args.requested_tier_qty !== undefined && args.requested_tier_qty > args.quantity) {
      return { status: 'needs_sales', reason: 'discount_request' };
    }

    const today = this.getVietnamToday();
    const priceRepo = this.dataSource.getRepository(ChatbotPriceRule);

    // 3. Find rule for main target
    const targetRules = await priceRepo
      .createQueryBuilder('r')
      .where('r.status = :status', { status: 'published' })
      .andWhere('r.customer_scope = :scope', { scope: 'PUBLIC' })
      .andWhere('r.target_type = :target_type', { target_type: args.target_type })
      .andWhere('r.target_code = :target_code', { target_code: args.target_code })
      .andWhere('r.qty_min <= :qty', { qty: args.quantity })
      .andWhere('(r.qty_max IS NULL OR r.qty_max >= :qty)', { qty: args.quantity })
      .andWhere('(r.effective_from IS NULL OR r.effective_from <= :today)', { today })
      .andWhere('(r.effective_to IS NULL OR r.effective_to >= :today)', { today })
      .getMany();

    // Fabric filter: if fabric specified, prioritize exact match over null
    let candidateRules = targetRules;
    if (args.fabric) {
      const exactFabric = targetRules.filter((r) => r.fabric === args.fabric);
      if (exactFabric.length > 0) {
        candidateRules = exactFabric;
      } else {
        candidateRules = targetRules.filter((r) => !r.fabric);
      }
    } else {
      candidateRules = targetRules.filter((r) => !r.fabric);
    }

    if (candidateRules.length === 0) {
      return { status: 'needs_sales', reason: 'no_rule' };
    }
    if (candidateRules.length > 1) {
      return { status: 'needs_sales', reason: 'conflicting_rules' };
    }

    const mainRule = candidateRules[0];
    const missing: string[] = [];
    const lines: any[] = [];

    // Calculate main line
    const unitPrice = Number(mainRule.unit_price);
    const subtotal = unitPrice * args.quantity;
    let tax: number | null = null;

    if (mainRule.tax_included) {
      tax = 0;
    } else if (mainRule.tax_rate !== null && mainRule.tax_rate !== undefined) {
      tax = Math.round((subtotal * Number(mainRule.tax_rate)) / 100);
    } else {
      missing.push(`tax:${mainRule.target_code}`);
    }

    const mainLineTotal = tax !== null ? subtotal + tax : null;
    lines.push({
      target_type: mainRule.target_type,
      target_code: mainRule.target_code,
      quantity: args.quantity,
      unit_price: unitPrice,
      subtotal,
      tax,
      total: mainLineTotal,
    });

    // 4. Calculate services
    if (args.services && Array.isArray(args.services)) {
      for (const svc of args.services) {
        const svcQty = svc.quantity !== undefined ? svc.quantity : 1;
        const svcRules = await priceRepo
          .createQueryBuilder('r')
          .where('r.status = :status', { status: 'published' })
          .andWhere('r.customer_scope = :scope', { scope: 'PUBLIC' })
          .andWhere('r.target_type = :target_type', { target_type: 'service' })
          .andWhere('r.target_code = :target_code', { target_code: svc.code })
          .andWhere('r.qty_min <= :qty', { qty: svcQty })
          .andWhere('(r.qty_max IS NULL OR r.qty_max >= :qty)', { qty: svcQty })
          .andWhere('(r.effective_from IS NULL OR r.effective_from <= :today)', { today })
          .andWhere('(r.effective_to IS NULL OR r.effective_to >= :today)', { today })
          .getMany();

        if (svcRules.length === 0) {
          missing.push(`service:${svc.code}`);
        } else if (svcRules.length > 1) {
          missing.push(`service:${svc.code}`);
        } else {
          const sRule = svcRules[0];
          const sUnitPrice = Number(sRule.unit_price);
          const sSubtotal = sUnitPrice * svcQty;
          let sTax: number | null = null;
          if (sRule.tax_included) {
            sTax = 0;
          } else if (sRule.tax_rate !== null && sRule.tax_rate !== undefined) {
            sTax = Math.round((sSubtotal * Number(sRule.tax_rate)) / 100);
          } else {
            missing.push(`tax:${sRule.target_code}`);
          }
          const sLineTotal = sTax !== null ? sSubtotal + sTax : null;
          lines.push({
            target_type: 'service',
            target_code: sRule.target_code,
            quantity: svcQty,
            unit_price: sUnitPrice,
            subtotal: sSubtotal,
            tax: sTax,
            total: sLineTotal,
          });
        }
      }
    }

    if (missing.length > 0) {
      return {
        status: 'partial',
        missing,
        lines,
        currency: 'VND',
      };
    }

    const grandTotal = lines.reduce((acc, cur) => acc + (cur.total || 0), 0);
    return {
      status: 'available',
      lines,
      total: grandTotal,
      missing: [],
      currency: 'VND',
    };
  }

  // --- 6. retrieveForTurn (P3.4) ---
  async retrieveForTurn(
    text: string,
    options: { intent?: string; topic_hint?: string } = {},
  ) {
    if (!text || !text.trim()) {
      return { items: [] };
    }

    const today = this.getVietnamToday();
    const norm = normalizeVi(text);
    const words = norm.split(/[\s,.;:!?()\[\]"'/\\-]+/).filter(Boolean);
    const tokens = words.filter((w) => {
      if (w.length <= 1) return false;
      if (/^\d+$/.test(w)) return false;
      if (STOP_WORDS.has(w)) return false;
      return true;
    });

    const topicHint = options.topic_hint || detectTopicHint(norm);

    const repo = this.dataSource.getRepository(ChatbotKnowledgeItem);
    const qb = repo
      .createQueryBuilder('item')
      .where('item.status = :status', { status: 'published' })
      .andWhere('item.public_allowed = true')
      .andWhere("item.topic NOT LIKE 'script.%'")
      .andWhere('(item.effective_from IS NULL OR item.effective_from <= :today)', { today })
      .andWhere('(item.effective_to IS NULL OR item.effective_to >= :today)', { today });

    const candidates = await qb.getMany();
    const publicView = await this.configService.publicView();

    const scored: Array<{ item: ChatbotKnowledgeItem; score: number }> = [];

    for (const item of candidates) {
      const lowerTopic = (item.topic || '').toLowerCase();
      const matchesTopicHint = Boolean(topicHint && lowerTopic.includes(topicHint.toLowerCase()));

      const itemNormSearch = normalizeVi(`${item.topic} ${item.question || ''} ${item.answer}`);
      const itemWords = new Set(itemNormSearch.split(/[\s,.;:!?()\[\]"'/\\-]+/).filter(Boolean));
      let matchingTokenCount = 0;
      for (const tok of tokens) {
        if (itemWords.has(tok)) {
          matchingTokenCount++;
        }
      }

      const meetsTokenThreshold =
        tokens.length > 0 && matchingTokenCount >= Math.ceil(tokens.length * 0.5);

      if (matchesTopicHint || meetsTokenThreshold) {
        let score = tokens.length > 0 ? matchingTokenCount / tokens.length : 0;
        if (matchesTopicHint) score += 1.0;
        if (options.intent && item.intent === options.intent) score += 0.5;

        scored.push({ item, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    const top3 = scored.slice(0, 3).map((s) => ({
      id: s.item.id,
      item_key: s.item.item_key,
      version: s.item.version,
      topic: s.item.topic,
      question: s.item.question,
      answer: renderKnowledgeAnswer(s.item.answer, publicView),
    }));

    if (top3.length === 0) {
      await this.recordKnowledgeGap(text, options.intent);
    }

    return { items: top3 };
  }

  async recordKnowledgeGap(text: string, intent?: string): Promise<void> {
    const questionNorm = normalizeVi(text).trim();
    if (!questionNorm) return;
    const cleanSample = redactPiiForLlm(text).slice(0, 300);

    try {
      await this.dataSource.query(
        `INSERT INTO chatbot_knowledge_gaps (id, question_norm, sample_text, intent, count, status, first_seen_at, last_seen_at)
         VALUES (gen_random_uuid(), $1, $2, $3, 1, 'open', now(), now())
         ON CONFLICT (question_norm)
         DO UPDATE SET count = chatbot_knowledge_gaps.count + 1, last_seen_at = now()`,
        [questionNorm, cleanSample, intent || null],
      );
    } catch (err: any) {
      this.logger.warn(`Could not record knowledge gap: ${err?.message}`);
    }
  }

  async getKbVersion(): Promise<number> {
    try {
      const res = await this.dataSource.query(
        `SELECT value FROM system_configs WHERE key = 'CHATBOT_KB_VERSION'`,
      );
      return Number(res[0]?.value) || 1;
    } catch {
      return 1;
    }
  }
}
