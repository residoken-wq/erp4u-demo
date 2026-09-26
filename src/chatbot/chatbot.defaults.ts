export const CHATBOT_DEFAULTS = {
  enabled: false,
  display_name: 'Cừu ERP4U — Trợ lý AI', // tiêu đề widget, tên trong email, tên trong prompt
  short_name: 'Cừu ERP4U', // dùng trong câu chào, subject email, aria-label
  avatar_url: '/images/chatbot/cuu-erp4u-192.webp',
  greeting: 'Dạ em là {short_name}, trợ lý AI của ERP4U. Anh/chị đang chọn sản phẩm cho bé, đặt cho trường hay cần hỗ trợ đơn đã mua ạ?',
  contact_channels: {
    hotline: '',
    zalo_url: '',
    email_public: '',
    messenger_url: '',
  },
  working_hours: {
    tz: 'Asia/Ho_Chi_Minh',
    days: {
      mon: { off: false, from: '08:00', to: '17:30' },
      tue: { off: false, from: '08:00', to: '17:30' },
      wed: { off: false, from: '08:00', to: '17:30' },
      thu: { off: false, from: '08:00', to: '17:30' },
      fri: { off: false, from: '08:00', to: '17:30' },
      sat: { off: false, from: '08:00', to: '12:00' },
      sun: { off: true, from: '08:00', to: '17:30' },
    },
    holiday_note: '',
  },
  response_sla_text: '',
  notify_emails: [] as string[],
  notify_user_ids: [] as number[],
  features: {
    price_estimate: false,
    order_lookup: false,
    attachments: false,
    sample_request: false,
  },
  limits: {
    session_per_ip_hour: 30,
    msg_per_session_5m: 20,
    msg_per_ip_5m: 150,
    submit_per_session_hour: 5,
    upload_per_session_hour: 10,
    llm_concurrency: 8,
    unassigned_alert_min: 30,
    max_message_chars: 2000,
  },
  retention_days: {
    chat: 365,
    attachment: 365,
    request: 730,
    ticket: 730,
    audit: 730,
  },
  llm: {
    daily_call_budget: 2000,
    timeout_ms: 20000,
  },
};

export type ChatbotConfigType = typeof CHATBOT_DEFAULTS;
