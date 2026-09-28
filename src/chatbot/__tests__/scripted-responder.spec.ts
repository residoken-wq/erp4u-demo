import { ScriptedResponderService } from '../conversation/scripted-responder.service';
import { CHATBOT_DEFAULTS } from '../chatbot.defaults';

describe('ScriptedResponderService - SPEC §6.7 & Tone Compliance (M3 / m1)', () => {
  let service: ScriptedResponderService;
  const config = JSON.parse(JSON.stringify(CHATBOT_DEFAULTS));
  const BANNED_REGEX = /chống thấm|kháng khuẩn|cao su|chính sách|ngay|giây lát|tốt nhất|miễn phí/i;

  beforeEach(() => {
    service = new ScriptedResponderService();
  });

  it('no start replies contain banned words or promised policies', () => {
    const actions = ['school', 'parent', 'sample', 'support', 'other'];
    for (const act of actions) {
      const res = service.generateStartReply(act, config);
      expect(res.replyText).not.toMatch(BANNED_REGEX);
      expect(res.replyText).toMatch(/em chào anh\/chị/i);
    }
  });

  it('no human replies contain banned words or time commitments', () => {
    const reply1 = service.generateHumanReply(config);
    expect(reply1).not.toMatch(BANNED_REGEX);

    // Outside working hours
    const offConfig = {
      ...config,
      working_hours: {
        tz: 'Asia/Ho_Chi_Minh',
        days: {
          mon: null,
          tue: null,
          wed: null,
          thu: null,
          fri: null,
          sat: null,
          sun: null,
        },
      },
    };
    const reply2 = service.generateHumanReply(offConfig);
    expect(reply2).not.toMatch(BANNED_REGEX);
  });

  it('no conversational replies contain banned words or unauthorized claims', () => {
    const testCases: Array<{ text: string; brief: Record<string, any> }> = [
      { text: 'Chào shop', brief: {} },
      { text: 'Tôi muốn mua nệm', brief: { items: ['nệm'] } },
      { text: 'Cần 30 bộ', brief: { quantity: 30 } },
      { text: '30 bộ nệm màu be', brief: { quantity: 30, items: ['nệm'], colors: 'be' } },
      { text: 'cho tôi gặp nhân viên', brief: {} },
    ];

    for (const tc of testCases) {
      const res = service.generateResponse(tc.text, tc.brief, 1, config);
      expect(res.replyText).not.toMatch(BANNED_REGEX);
    }
  });
});
