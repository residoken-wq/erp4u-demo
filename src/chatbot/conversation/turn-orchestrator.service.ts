import { Injectable, Logger, Inject } from '@nestjs/common';
import { DataSource, EntityManager, Like } from 'typeorm';
import { ChatbotConversation } from '../entities/chatbot-conversation.entity';
import { ChatbotMessage } from '../entities/chatbot-message.entity';
import { ChatbotBrief } from '../entities/chatbot-brief.entity';
import { ChatbotOutbox } from '../entities/chatbot-outbox.entity';
import { ChatbotKnowledgeItem } from '../entities/chatbot-knowledge-item.entity';
import { ChatbotConfigService, renderTemplate } from '../config/chatbot-config.service';
import { CHATBOT_DEFAULTS } from '../chatbot.defaults';
import { ChatbotToolsService } from '../tools/chatbot-tools.service';
import { LlmBudgetService } from '../llm/llm-budget.service';
import { ScriptedResponderService } from './scripted-responder.service';
import { RuleUnderstanderService } from './rule-understander.service';
import {
  LLM_PROVIDER,
  LlmProvider,
  LlmRateLimitError,
  LlmUnavailableError,
} from '../llm/llm-provider';
import { redactPiiForLlm, validateReply } from './reply-validator';
import { normalizeVi } from '../security/pii';
import { ChatbotFlowService } from '../flow/chatbot-flow.service';

const STOP_WORDS = new Set([
  'a', 'o', 'oi', 'nhe', 'nha', 'thi', 'la', 'co', 'khong', 'cho', 'em', 'anh',
  'chi', 'minh', 'ben', 'cua', 'va', 'hay', 'duoc', 'voi', 'cac', 'nhung',
  'nay', 'do', 'bao', 'nhieu', 'gi', 'nao', 'the', 'ra', 'vao', 'muon', 'can',
  'toi', 'ah', 'u', 'vay', 'roi', 'luon', 'giup', 'xin',
]);

@Injectable()
export class TurnOrchestratorService {
  private readonly logger = new Logger(TurnOrchestratorService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ChatbotConfigService,
    private readonly toolsService: ChatbotToolsService,
    private readonly budgetService: LlmBudgetService,
    private readonly scriptedResponder: ScriptedResponderService,
    private readonly ruleUnderstander: RuleUnderstanderService,
    @Inject(LLM_PROVIDER) private readonly llmProvider: LlmProvider,
    private readonly flowService: ChatbotFlowService,
  ) {}

  async handleTurn(
    conv: ChatbotConversation,
    rawText: string,
    clientMsgId?: string,
  ): Promise<{
    customerMsg: ChatbotMessage;
    replies: any[];
    conversation: { state: string; human_active: boolean };
  }> {
    // Phase 1: Lock conversation & save customer message
    let customerMsg!: ChatbotMessage;
    let currentConv!: ChatbotConversation;

    const earlyExit = await this.dataSource.transaction(async (mgr) => {
      const locked = await mgr.findOne(ChatbotConversation, {
        where: { id: conv.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!locked) {
        throw new Error(`Conversation ${conv.id} not found`);
      }
      currentConv = locked;

      // Check if human active -> drop AI reply, unread_staff + 1
      if (currentConv.human_active) {
        this.logger.log('turn: human is active, dropping AI replies');
        currentConv.unread_staff += 1;
        currentConv.last_message_at = new Date();
        await mgr.save(ChatbotConversation, currentConv);

        customerMsg = mgr.create(ChatbotMessage, {
          conversation_id: currentConv.id,
          role: 'customer',
          text: rawText,
          client_msg_id: clientMsgId || null,
        });
        await mgr.save(ChatbotMessage, customerMsg);

        return true;
      }

      // Save customer message
      customerMsg = mgr.create(ChatbotMessage, {
        conversation_id: currentConv.id,
        role: 'customer',
        text: rawText,
        client_msg_id: clientMsgId || null,
      });
      await mgr.save(ChatbotMessage, customerMsg);
      currentConv.last_message_at = new Date();
      await mgr.save(ChatbotConversation, currentConv);

      return false;
    });

    if (earlyExit) {
      return {
        customerMsg,
        replies: [],
        conversation: {
          state: currentConv.state,
          human_active: currentConv.human_active,
        },
      };
    }

    // Test Hook: delay
    if (process.env.CHATBOT_TEST_HOOKS === 'true' && rawText.includes('[[delay:')) {
      const match = rawText.match(/\[\[delay:(\d+)\]\]/);
      if (match) {
        const delayMs = Math.min(parseInt(match[1], 10), 10000);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }

    // Redacted customer preview
    const redactedText = redactPiiForLlm(rawText);
    const inputPreview = redactedText.slice(0, 200);

    const config = await this.configService.get();
    const mode = config.llm?.mode || 'script_first';
    const providerEnv = (process.env.CHATBOT_LLM_PROVIDER || '').toLowerCase();
    const kbVersion = await this.toolsService.getKbVersion();

    // Load active brief
    const latestBrief = await this.dataSource.getRepository(ChatbotBrief).findOne({
      where: { conversation_id: currentConv.id },
      order: { revision: 'DESC' },
    });
    let activeRevision = latestBrief ? latestBrief.revision : 0;
    let activeData = latestBrief ? { ...latestBrief.data } : {};

    // Run RuleUnderstander
    const ruleRes = this.ruleUnderstander.understand(rawText, activeData);

    // Merge slots into activeData
    let hasNewBrief = false;
    for (const [k, v] of Object.entries(ruleRes.slots)) {
      if (v !== undefined && v !== null && activeData[k] !== v) {
        activeData[k] = v;
        hasNewBrief = true;
      }
    }
    if (ruleRes.segment && activeData.segment !== ruleRes.segment) {
      activeData.segment = ruleRes.segment;
      hasNewBrief = true;
    }
    if (ruleRes.intent && activeData.intent !== ruleRes.intent) {
      activeData.intent = ruleRes.intent;
      hasNewBrief = true;
    }

    let newBriefEntity: ChatbotBrief | null = null;
    if (hasNewBrief) {
      activeRevision += 1;
      newBriefEntity = this.dataSource.getRepository(ChatbotBrief).create({
        conversation_id: currentConv.id,
        revision: activeRevision,
        data: activeData,
        changed_by: 'customer',
      });
    }

    // Conversation flows (CMS "Sơ đồ kịch bản") answer before scripts/KB/AI in every mode.
    // Safety rules always win: complaint / infant / wants human / handoff stop the running flow.
    if (ruleRes.is_complaint || ruleRes.is_infant || ruleRes.wants_human || ruleRes.handoff) {
      await this.flowService.clearState(currentConv.id);
    } else {
      const flowTurn = await this.flowService.handleText(currentConv.id, rawText, config);
      if (flowTurn) {
        const commitRes = await this.commitTurn({
          convId: currentConv.id,
          newBriefEntity,
          targetState: null,
          targetIntent: ruleRes.intent,
          targetSegment: ruleRes.segment,
          outboxEvents: [],
          replyText: flowTurn.text,
          payload: flowTurn.payload,
          llmMeta: {
            provider: 'flow',
            model: 'flow',
            prompt_version: 'v1',
            kb_version: kbVersion,
            route: 'flow',
            flow_id: flowTurn.flow_id,
            flow_version: flowTurn.flow_version,
            node_ids: flowTurn.node_ids,
            latency_ms: { understand: 0, tools: 0, compose: 0 },
            input_preview: inputPreview,
          },
          afterSave: (mgr) => this.flowService.applyState(mgr, currentConv.id, flowTurn),
        });
        return {
          customerMsg,
          replies: commitRes.replies,
          conversation: { state: commitRes.state || currentConv.state, human_active: commitRes.humanActive },
        };
      }
    }

    if (providerEnv === 'scripted') {
      const scriptedRes = await this.runScriptedFallback(
        currentConv,
        rawText,
        inputPreview,
        undefined,
      );
      return {
        customerMsg,
        replies: scriptedRes.replies,
        conversation: {
          state: scriptedRes.state || currentConv.state,
          human_active: scriptedRes.humanActive !== undefined ? scriptedRes.humanActive : currentConv.human_active,
        },
      };
    }

    const isScriptOnly = mode === 'script_only';
    const isScriptFirst = mode === 'script_first';

    // --- Branch 1: script_first or script_only ---
    if (isScriptFirst || isScriptOnly) {
      // 1. Check special rule (complaint / infant / human / handoff / special intent)
      const hasSpecialRule =
        ruleRes.is_complaint ||
        ruleRes.is_infant ||
        ruleRes.wants_human ||
        ruleRes.suggest_ticket ||
        ruleRes.handoff ||
        ['invoice', 'payment', 'order_status', 'sample', 'reorder'].includes(ruleRes.intent);

      if (hasSpecialRule) {
        let payload: any = null;
        if (ruleRes.suggest_ticket) {
          payload = { type: 'suggest_ticket', category: ruleRes.suggest_ticket.category };
        } else if (ruleRes.is_infant) {
          payload = { type: 'handoff_suggest', reason: 'infant' };
        } else if (ruleRes.handoff) {
          payload = { type: 'handoff_suggest', reason: ruleRes.handoff_reason || 'agent_transfer' };
        }

        let targetState: string | null = null;
        const outboxEvents: ChatbotOutbox[] = [];

        if (ruleRes.wants_human) {
          targetState = 'waiting_sales';
          const inapp = this.dataSource.getRepository(ChatbotOutbox).create({
            event: 'human.requested',
            channel: 'inapp',
            ref_id: currentConv.id,
            payload: { conversation_id: currentConv.id, text: rawText },
          });
          outboxEvents.push(inapp);

          if (config.notify_emails && config.notify_emails.length > 0) {
            const email = this.dataSource.getRepository(ChatbotOutbox).create({
              event: 'human.requested',
              channel: 'email',
              ref_id: currentConv.id,
              payload: { conversation_id: currentConv.id, text: rawText, emails: config.notify_emails },
            });
            outboxEvents.push(email);
          }
        }

        // Determine reply text from knowledge base or fallback scripts
        let replyText = '';
        if (ruleRes.is_infant) {
          replyText =
            (await this.findKnowledgeAnswer('script.infant', config)) ||
            (await this.findKnowledgeAnswer('faq.infant', config)) ||
            'Dạ với độ tuổi này, em sẽ chuyển nhu cầu để chuyên viên kiểm tra sản phẩm phù hợp. Anh/chị cho em biết kích thước khung giường và yêu cầu của trường ạ?';
        } else if (ruleRes.is_complaint) {
          replyText =
            (await this.findKnowledgeAnswer('script.complaint', config)) ||
            'Dạ em rất tiếc vì sản phẩm chưa đáp ứng trải nghiệm mong muốn. Anh/chị cho em biết đơn hàng hoặc sản phẩm đang dùng; nếu tiện, gửi thêm ảnh để bộ phận hỗ trợ kiểm tra ạ.';
        } else if (ruleRes.suggest_ticket?.category === 'design_change') {
          replyText = 'Dạ em đã ghi nhận yêu cầu điều chỉnh thiết kế của anh/chị và chuyển ngay cho chuyên viên kỹ thuật hỗ trợ ạ.';
        } else if (ruleRes.suggest_ticket?.category === 'delivery') {
          replyText = 'Dạ em rất tiếc về sự bất tiện trong quá trình giao hàng. Em đã ghi nhận phản ánh để bộ phận vận chuyển rút kinh nghiệm và liên hệ hỗ trợ mình ạ.';
        } else if (ruleRes.intent === 'invoice') {
          replyText =
            (await this.findKnowledgeAnswer('faq.invoice', config)) ||
            (await this.findKnowledgeAnswer('script.handoff', config)) ||
            'Dạ về hóa đơn, chứng từ và hợp đồng, em xin phép chuyển thông tin để kế toán ERP4U liên hệ hỗ trợ mình chi tiết ạ.';
        } else if (ruleRes.intent === 'payment') {
          replyText =
            (await this.findKnowledgeAnswer('script.payment_evidence', config)) ||
            'Dạ khoản thanh toán cần bộ phận kế toán đối chiếu trước khi xác nhận ạ. Em sẽ chuyển thông tin để kế toán kiểm tra và phản hồi mình ạ.';
        } else if (ruleRes.intent === 'order_status') {
          replyText =
            (await this.findKnowledgeAnswer('faq.order_status', config)) ||
            (await this.findKnowledgeAnswer('script.no_erp', config)) ||
            'Dạ em chưa tra được tiến độ trực tiếp trong cuộc trò chuyện này. Em sẽ nhờ nhân viên phụ trách kiểm tra và liên hệ lại với anh/chị ngay ạ.';
        } else if (ruleRes.intent === 'sample') {
          replyText =
            (await this.findKnowledgeAnswer('script.sample.open', config)) ||
            'Dạ anh/chị muốn xem mẫu vải, mẫu nệm hay cả bộ ạ? Trường mình ở khu vực nào để em ghi nhận cách xem mẫu phù hợp ạ?';
        } else if (ruleRes.intent === 'reorder') {
          replyText =
            (await this.findKnowledgeAnswer('faq.reorder', config)) ||
            'Dạ em cảm ơn anh/chị đã tiếp tục tin dùng ERP4U ạ. Anh/chị cho em biết số lượng lần này và có thay đổi gì so với mẫu cũ không ạ?';
        } else if (ruleRes.wants_human) {
          replyText = this.scriptedResponder.generateHumanReply(config);
        } else {
          replyText =
            (await this.findKnowledgeAnswer('script.handoff', config)) ||
            'Dạ em đã ghi nhận thông tin và chuyển cho chuyên viên tư vấn ERP4U liên hệ hỗ trợ anh/chị ạ.';
        }

        const llmMeta: any = {
          provider: this.llmProvider.name,
          model: 'rule-engine',
          prompt_version: 'v1',
          kb_version: kbVersion,
          route: 'script',
          latency_ms: { understand: 0, tools: 0, compose: 0 },
          input_preview: inputPreview,
        };

        const commitRes = await this.commitTurn({
          convId: currentConv.id,
          newBriefEntity,
          targetState,
          targetIntent: ruleRes.intent,
          targetSegment: ruleRes.segment,
          outboxEvents,
          replyText,
          payload,
          llmMeta,
        });

        return {
          customerMsg,
          replies: commitRes.replies,
          conversation: {
            state: commitRes.state || currentConv.state,
            human_active: commitRes.humanActive,
          },
        };
      }

      // 2. Check KB retrieval for confident match
      const toolRes = await this.toolsService.retrieveForTurn(redactedText, {
        intent: ruleRes.intent,
        topic_hint: ruleRes.topic_hint,
      });

      const topItem = toolRes.items?.[0];
      const matchesTopicHint = Boolean(
        ruleRes.topic_hint &&
          topItem &&
          (topItem.topic || '').toLowerCase().includes(ruleRes.topic_hint.toLowerCase()),
      );

      let tokenCoverage = 0;
      if (topItem) {
        const normQ = normalizeVi(redactedText);
        const qWords = normQ.split(/[\s,.;:!?()\[\]"'/\\-]+/).filter(Boolean);
        const qTokens = qWords.filter(
          (w) => w.length > 1 && !/^\d+$/.test(w) && !STOP_WORDS.has(w),
        );
        if (qTokens.length > 0) {
          const itemText = normalizeVi(
            `${topItem.topic || ''} ${topItem.question || ''} ${topItem.answer || ''}`,
          );
          const itemWords = new Set(itemText.split(/[\s,.;:!?()\[\]"'/\\-]+/).filter(Boolean));
          let matchCount = 0;
          for (const tok of qTokens) {
            if (itemWords.has(tok)) matchCount++;
          }
          tokenCoverage = matchCount / qTokens.length;
        }
      }

      const hasConfidentMatch = Boolean(
        topItem && (matchesTopicHint || tokenCoverage >= 0.7),
      );

      if (hasConfidentMatch && topItem) {
        let replyText = topItem.answer;
        // Append missing slot question if applicable
        if (activeData.quantity === undefined && !rawText.includes('bao nhiêu bộ') && (replyText.match(/\?/g) || []).length < 2) {
          replyText += ' Dạ trường mình dự kiến đặt số lượng khoảng bao nhiêu bộ ạ?';
        }

        const llmMeta: any = {
          provider: this.llmProvider.name,
          model: 'knowledge-retrieval',
          prompt_version: 'v1',
          kb_version: kbVersion,
          route: 'knowledge',
          latency_ms: { understand: 0, tools: 0, compose: 0 },
          input_preview: inputPreview,
        };

        const commitRes = await this.commitTurn({
          convId: currentConv.id,
          newBriefEntity,
          targetState: null,
          targetIntent: ruleRes.intent,
          targetSegment: ruleRes.segment,
          outboxEvents: [],
          replyText,
          payload: null,
          llmMeta,
        });

        return {
          customerMsg,
          replies: commitRes.replies,
          conversation: {
            state: commitRes.state || currentConv.state,
            human_active: commitRes.humanActive,
          },
        };
      }

      // 3. No confident match: record knowledge gap
      await this.toolsService.recordKnowledgeGap(rawText, ruleRes.intent);

      // If script_only -> go straight to safe fallback
      if (isScriptOnly) {
        const fallbackText = this.renderPlaceholders(
          'Dạ em là {short_name}, trợ lý AI của ERP4U. Câu hỏi này em chưa có thông tin chính xác, em xin phép chuyển cho nhân viên tư vấn để hỗ trợ anh/chị nhé ạ.',
          config,
        );

        const llmMeta: any = {
          provider: this.llmProvider.name,
          model: 'rule-engine',
          prompt_version: 'v1',
          kb_version: kbVersion,
          route: 'fallback',
          latency_ms: { understand: 0, tools: 0, compose: 0 },
          input_preview: inputPreview,
        };

        const commitRes = await this.commitTurn({
          convId: currentConv.id,
          newBriefEntity,
          targetState: null,
          targetIntent: ruleRes.intent,
          targetSegment: ruleRes.segment,
          outboxEvents: [],
          replyText: fallbackText,
          payload: { type: 'handoff_suggest', reason: 'unanswered_question' },
          llmMeta,
        });

        return {
          customerMsg,
          replies: commitRes.replies,
          conversation: {
            state: commitRes.state || currentConv.state,
            human_active: commitRes.humanActive,
          },
        };
      }

      // If script_first -> attempt LLM call
      const allowed = await this.budgetService.tryConsume();
      if (!allowed) {
        this.logger.warn(`LLM budget exhausted in script_first, using fallback`);
        const fallbackRes = await this.runScriptedFallback(
          currentConv,
          rawText,
          inputPreview,
          'budget',
        );
        return {
          customerMsg,
          replies: fallbackRes.replies,
          conversation: {
            state: fallbackRes.state || currentConv.state,
            human_active: fallbackRes.humanActive !== undefined ? fallbackRes.humanActive : currentConv.human_active,
          },
        };
      }

      const timeoutMs = config.llm?.timeout_ms || 20000;
      try {
        const pipelineRes = await this.executePipeline(
          currentConv,
          rawText,
          redactedText,
          inputPreview,
          config,
          timeoutMs,
          kbVersion,
          'script_first',
          activeData,
          newBriefEntity,
        );

        return {
          customerMsg,
          replies: pipelineRes.replies,
          conversation: {
            state: pipelineRes.state || currentConv.state,
            human_active: pipelineRes.humanActive !== undefined ? pipelineRes.humanActive : currentConv.human_active,
          },
        };
      } catch (err: any) {
        const { fallbackType, retryAfterS } = this.classifyLlmError(err);
        this.logger.warn(`LLM pipeline ${fallbackType}: ${err?.message}, running fallback`);
        const fallbackRes = await this.runScriptedFallback(
          currentConv,
          rawText,
          inputPreview,
          fallbackType,
          retryAfterS,
        );
        return {
          customerMsg,
          replies: fallbackRes.replies,
          conversation: {
            state: fallbackRes.state || currentConv.state,
            human_active: fallbackRes.humanActive !== undefined ? fallbackRes.humanActive : currentConv.human_active,
          },
        };
      }
    }

    // --- Branch 2: llm_first ---
    const allowed = await this.budgetService.tryConsume();
    if (!allowed) {
      this.logger.warn(`LLM budget exhausted, falling back to scripted`);
      const scriptedRes = await this.runScriptedFallback(
        currentConv,
        rawText,
        inputPreview,
        'budget',
      );
      return {
        customerMsg,
        replies: scriptedRes.replies,
        conversation: {
          state: scriptedRes.state || currentConv.state,
          human_active: scriptedRes.humanActive !== undefined ? scriptedRes.humanActive : currentConv.human_active,
        },
      };
    }

    const timeoutMs = config.llm?.timeout_ms || 20000;
    try {
      const pipelineResult = await this.executePipeline(
        currentConv,
        rawText,
        redactedText,
        inputPreview,
        config,
        timeoutMs,
        kbVersion,
        'llm_first',
        activeData,
        newBriefEntity,
      );

      return {
        customerMsg,
        replies: pipelineResult.replies,
        conversation: {
          state: pipelineResult.state || currentConv.state,
          human_active: pipelineResult.humanActive !== undefined ? pipelineResult.humanActive : currentConv.human_active,
        },
      };
    } catch (err: any) {
      const { fallbackType, retryAfterS } = this.classifyLlmError(err);
      this.logger.warn(`LLM pipeline ${fallbackType}: ${err?.message}, running scripted fallback`);

      const scriptedRes = await this.runScriptedFallback(
        currentConv,
        rawText,
        inputPreview,
        fallbackType,
        retryAfterS,
      );

      return {
        customerMsg,
        replies: scriptedRes.replies,
        conversation: {
          state: scriptedRes.state || currentConv.state,
          human_active: scriptedRes.humanActive !== undefined ? scriptedRes.humanActive : currentConv.human_active,
        },
      };
    }
  }

  private classifyLlmError(err: any): { fallbackType: string; retryAfterS?: number } {
    if (err instanceof LlmRateLimitError || err?.name === 'LlmRateLimitError' || err?.message?.includes('429')) {
      return { fallbackType: 'rate_limited', retryAfterS: err.retryAfterS || 60 };
    }
    if (err instanceof LlmUnavailableError || err?.name === 'LlmUnavailableError' || err?.message?.includes('503')) {
      return { fallbackType: 'unavailable', retryAfterS: err.retryAfterS || 30 };
    }
    if (
      err?.name === 'TimeoutError' ||
      err?.message?.includes('timed out') ||
      err?.name === 'AbortError'
    ) {
      return { fallbackType: 'timeout' };
    }
    return { fallbackType: 'error' };
  }

  private async executePipeline(
    currentConv: ChatbotConversation,
    rawText: string,
    redactedText: string,
    inputPreview: string,
    config: any,
    timeoutMs: number,
    kbVersion: number,
    route: 'llm_first' | 'script_first',
    initialBriefData: Record<string, any>,
    initialNewBriefEntity: ChatbotBrief | null,
  ): Promise<{ replies: any[]; state: string; humanActive: boolean }> {
    let timer: any;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        const err = new Error(`LLM pipeline timed out after ${timeoutMs}ms`);
        err.name = 'TimeoutError';
        reject(err);
      }, timeoutMs);
      if (timer.unref) timer.unref();
    });

    const pipelineWork = async (): Promise<{ replies: any[]; state: string; humanActive: boolean }> => {
      // A. Understand (LLM #1)
      const t0 = Date.now();
      const understandRes = await this.llmProvider.generateJson<any>({
        schemaName: 'understand.v1',
        messages: [{ role: 'user', text: redactedText }],
        timeoutMs,
      });
      const understandLatency = Date.now() - t0;
      const understandData = understandRes.data || {};

      // B. Merge Brief
      let activeRevision = initialNewBriefEntity ? initialNewBriefEntity.revision : 0;
      const activeData: Record<string, any> = { ...initialBriefData };
      let newBriefEntity = initialNewBriefEntity;

      if (understandData.slots && typeof understandData.slots === 'object') {
        let hasNew = false;
        for (const [k, v] of Object.entries(understandData.slots)) {
          if (v !== undefined && v !== null && activeData[k] !== v) {
            activeData[k] = v;
            hasNew = true;
          }
        }
        if (understandData.segment && activeData.segment !== understandData.segment) {
          activeData.segment = understandData.segment;
          hasNew = true;
        }
        if (understandData.intent && activeData.intent !== understandData.intent) {
          activeData.intent = understandData.intent;
          hasNew = true;
        }
        if (hasNew) {
          activeRevision += 1;
          newBriefEntity = this.dataSource.getRepository(ChatbotBrief).create({
            conversation_id: currentConv.id,
            revision: activeRevision,
            data: activeData,
            changed_by: 'customer',
          });
        }
      }

      // C. Business Rules
      let payload: any = null;
      let targetState: string | null = null;
      const outboxEvents: ChatbotOutbox[] = [];

      const isComplaint = Boolean(understandData.is_complaint);
      const ageMonths = activeData.age_months !== undefined ? activeData.age_months : understandData.slots?.age_months;
      const isInfant =
        (ageMonths !== undefined && ageMonths < 18) ||
        understandData.topic_hint === 'infant';

      if (isComplaint) {
        payload = { type: 'suggest_ticket', category: 'complaint_quality' };
      } else if (isInfant) {
        payload = { type: 'handoff_suggest', reason: 'infant' };
      } else if (understandData.wants_human) {
        targetState = 'waiting_sales';
        const outboxInapp = this.dataSource.getRepository(ChatbotOutbox).create({
          event: 'human.requested',
          channel: 'inapp',
          ref_id: currentConv.id,
          payload: { conversation_id: currentConv.id, text: rawText },
        });
        outboxEvents.push(outboxInapp);

        if (config.notify_emails && config.notify_emails.length > 0) {
          const outboxEmail = this.dataSource.getRepository(ChatbotOutbox).create({
            event: 'human.requested',
            channel: 'email',
            ref_id: currentConv.id,
            payload: { conversation_id: currentConv.id, text: rawText, emails: config.notify_emails },
          });
          outboxEvents.push(outboxEmail);
        }
      }

      // D. Tools (retrieveForTurn)
      const t1 = Date.now();
      let factsItems: any[] = [];
      if (!isComplaint && !isInfant) {
        const toolRes = await this.toolsService.retrieveForTurn(redactedText, {
          intent: understandData.intent,
          topic_hint: understandData.topic_hint,
        });
        factsItems = toolRes.items || [];
      }
      const toolsLatency = Date.now() - t1;
      const factsText = factsItems.map((f: any) => `- ${f.answer}`).join('\n');

      // E. Compose (LLM #2)
      const t2 = Date.now();
      const systemPrompt = `Bạn là ${config.display_name}, trợ lý AI của ERP4U. Dưới đây là thông tin cần biết:
<facts>
${factsText}
</facts>
<brief>
${JSON.stringify(activeData)}
</brief>
Lượt chat này có: is_complaint: ${isComplaint}, is_infant: ${isInfant}.`;

      const composeRes = await this.llmProvider.generateJson<any>({
        schemaName: 'compose.v1',
        system: systemPrompt,
        messages: [{ role: 'user', text: redactedText }],
        timeoutMs,
      });
      const composeLatency = Date.now() - t2;
      const rawReply = composeRes.data?.reply_text || '';

      // F. ReplyValidator
      const valRes = validateReply(rawReply, {
        factsText,
        briefData: activeData,
        intent: understandData.intent,
        fallbackKnowledgeAnswer: factsItems[0]?.answer,
      });

      const finalReplyText = valRes.replyText;

      // G. Save AI message via commitTurn (Transactional with FOR UPDATE check)
      const llmMeta: any = {
        provider: this.llmProvider.name,
        model: composeRes.model || 'fake-model',
        prompt_version: 'v1',
        kb_version: kbVersion,
        route: 'llm',
        latency_ms: {
          understand: understandLatency,
          tools: toolsLatency,
          compose: composeLatency,
        },
        input_preview: inputPreview,
      };

      if (valRes.validator) {
        llmMeta.validator = valRes.validator;
      }

      const commitRes = await this.commitTurn({
        convId: currentConv.id,
        newBriefEntity,
        targetState,
        targetIntent: understandData.intent,
        targetSegment: activeData.segment,
        outboxEvents,
        replyText: finalReplyText,
        payload,
        llmMeta,
      });

      return {
        replies: commitRes.replies,
        state: commitRes.state,
        humanActive: commitRes.humanActive,
      };
    };

    try {
      return await Promise.race([pipelineWork(), timeoutPromise]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private async runScriptedFallback(
    currentConv: ChatbotConversation,
    rawText: string,
    inputPreview: string,
    fallbackReason?: string,
    retryAfterS?: number,
  ): Promise<{ replies: any[]; state: string; humanActive: boolean }> {
    const kbVersion = await this.toolsService.getKbVersion();
    const config = await this.configService.get();

    // Extract slots and update brief
    const latestBrief = await this.dataSource.getRepository(ChatbotBrief).findOne({
      where: { conversation_id: currentConv.id },
      order: { revision: 'DESC' },
    });
    const currentBriefData = latestBrief ? { ...latestBrief.data } : {};
    let activeRevision = latestBrief ? latestBrief.revision : 0;
    const activeData: Record<string, any> = { ...currentBriefData };

    const ruleRes = this.ruleUnderstander.understand(rawText, currentBriefData);
    let hasNewBrief = false;
    for (const [k, v] of Object.entries(ruleRes.slots)) {
      if (v !== undefined && v !== null && activeData[k] !== v) {
        activeData[k] = v;
        hasNewBrief = true;
      }
    }
    if (ruleRes.segment && activeData.segment !== ruleRes.segment) {
      activeData.segment = ruleRes.segment;
      hasNewBrief = true;
    }
    if (ruleRes.intent && activeData.intent !== ruleRes.intent) {
      activeData.intent = ruleRes.intent;
      hasNewBrief = true;
    }

    let newBriefEntity: ChatbotBrief | null = null;
    if (hasNewBrief) {
      activeRevision += 1;
      newBriefEntity = this.dataSource.getRepository(ChatbotBrief).create({
        conversation_id: currentConv.id,
        revision: activeRevision,
        data: activeData,
        changed_by: 'customer',
      });
    }

    const response = this.scriptedResponder.generateResponse(
      rawText,
      activeData,
      activeRevision,
      config,
    );

    let targetState: string | null = null;
    const outboxEvents: ChatbotOutbox[] = [];

    if (response.newState) {
      targetState = response.newState;
    }

    if (response.isHumanRequest) {
      const outboxInapp = this.dataSource.getRepository(ChatbotOutbox).create({
        event: 'human.requested',
        channel: 'inapp',
        ref_id: currentConv.id,
        payload: { conversation_id: currentConv.id, text: rawText },
      });
      outboxEvents.push(outboxInapp);

      if (config.notify_emails && config.notify_emails.length > 0) {
        const outboxEmail = this.dataSource.getRepository(ChatbotOutbox).create({
          event: 'human.requested',
          channel: 'email',
          ref_id: currentConv.id,
          payload: { conversation_id: currentConv.id, text: rawText, emails: config.notify_emails },
        });
        outboxEvents.push(outboxEmail);
      }
    }

    const llmMeta: any = {
      provider: this.llmProvider.name,
      model: 'fake-model',
      prompt_version: 'v1',
      kb_version: kbVersion,
      route: 'fallback',
      latency_ms: { understand: 0, tools: 0, compose: 0 },
      input_preview: inputPreview,
    };
    if (fallbackReason) {
      llmMeta.fallback = fallbackReason;
    }
    if (retryAfterS) {
      llmMeta.retry_after_s = retryAfterS;
    }

    const commitRes = await this.commitTurn({
      convId: currentConv.id,
      newBriefEntity,
      targetState,
      targetIntent: activeData.intent,
      targetSegment: activeData.segment,
      outboxEvents,
      replyText: response.replyText,
      payload: response.payload,
      llmMeta,
    });

    return {
      replies: commitRes.replies,
      state: commitRes.state,
      humanActive: commitRes.humanActive,
    };
  }

  /**
   * Transactional commit: locks conversation row, checks human_active before saving.
   * If human_active is true, drops AI reply and leaves human_active/assigned_user_id untouched.
   */
  private async commitTurn(params: {
    convId: string;
    newBriefEntity: ChatbotBrief | null;
    targetState: string | null;
    targetIntent?: string | null;
    targetSegment?: string | null;
    outboxEvents: ChatbotOutbox[];
    replyText: string | null;
    payload: any | null;
    llmMeta: any;
    /** Extra writes committed atomically with the AI reply (skipped when sales took over). */
    afterSave?: (mgr: EntityManager) => Promise<void>;
  }): Promise<{ replies: any[]; humanActive: boolean; state: string }> {
    let savedAiMsg: ChatbotMessage | null = null;
    let finalState = '';
    let finalHumanActive = false;

    await this.dataSource.transaction(async (mgr) => {
      // 1. Lock conversation row
      const locked = await mgr
        .createQueryBuilder(ChatbotConversation, 'c')
        .setLock('pessimistic_write')
        .where('c.id = :id', { id: params.convId })
        .getOne();

      if (!locked) {
        throw new Error(`Conversation ${params.convId} not found`);
      }

      finalState = locked.state;
      finalHumanActive = locked.human_active;

      // 2. Check human_active: If sales took over, DROP reply and DO NOT modify state or human_active!
      if (locked.human_active) {
        this.logger.log(`Turn ${params.convId}: sales took over, dropping AI reply`);
        return;
      }

      // 3. Save new brief revision if present
      if (params.newBriefEntity) {
        await mgr.save(ChatbotBrief, params.newBriefEntity);
      }

      // 4. Update conversation state/intent/segment if provided
      let convDirty = false;
      if (params.targetState && locked.state !== params.targetState) {
        locked.state = params.targetState;
        convDirty = true;
      }
      if (params.targetIntent && locked.intent !== params.targetIntent) {
        locked.intent = params.targetIntent;
        convDirty = true;
      }
      if (params.targetSegment && locked.segment !== params.targetSegment) {
        locked.segment = params.targetSegment;
        convDirty = true;
      }
      if (convDirty) {
        await mgr.save(ChatbotConversation, locked);
        finalState = locked.state;
      }

      // 5. Save outbox events if any
      if (params.outboxEvents && params.outboxEvents.length > 0) {
        for (const ob of params.outboxEvents) {
          await mgr.save(ChatbotOutbox, ob);
        }
      }

      // 6. Save AI message
      if (params.replyText) {
        savedAiMsg = mgr.create(ChatbotMessage, {
          conversation_id: locked.id,
          role: 'ai',
          text: params.replyText,
          payload: params.payload || null,
          llm_meta: params.llmMeta,
        });
        await mgr.save(ChatbotMessage, savedAiMsg);
      }

      if (params.afterSave) {
        await params.afterSave(mgr);
      }
    });

    if (finalHumanActive || !savedAiMsg) {
      return {
        replies: [],
        humanActive: finalHumanActive,
        state: finalState,
      };
    }

    return {
      replies: [
        {
          id: savedAiMsg.id,
          role: 'ai',
          text: savedAiMsg.text,
          payload: savedAiMsg.payload,
          created_at: savedAiMsg.created_at,
        },
      ],
      humanActive: false,
      state: finalState,
    };
  }

  private async findKnowledgeAnswer(topicPrefix: string, config: any): Promise<string | null> {
    try {
      const item = await this.dataSource.getRepository(ChatbotKnowledgeItem).findOne({
        where: [
          { topic: Like(`%${topicPrefix}%`), status: 'published' },
          { topic: Like(`%${topicPrefix}%`), status: 'needs_review' },
          { topic: Like(`%${topicPrefix}%`), status: 'draft' },
        ],
        order: { version: 'DESC' },
      });
      if (item && item.answer) {
        return this.renderPlaceholders(item.answer, config);
      }
    } catch (e: any) {
      this.logger.warn(`Could not find knowledge answer for ${topicPrefix}: ${e?.message}`);
    }
    return null;
  }

  private renderPlaceholders(template: string, config: any): string {
    const vars: Record<string, string> = {
      short_name: config.short_name || CHATBOT_DEFAULTS.short_name,
      display_name: config.display_name || CHATBOT_DEFAULTS.display_name,
      hotline: config.contact_channels?.hotline || '',
      email_public: config.contact_channels?.email_public || '',
      zalo_url: config.contact_channels?.zalo_url || '',
      working_hours_text: 'T2–T6 08:00–17:30, T7 08:00–12:00',
    };
    return renderTemplate(template, vars);
  }
}
