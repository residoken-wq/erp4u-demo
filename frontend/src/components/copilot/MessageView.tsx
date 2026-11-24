import React, { useRef, useEffect, useMemo } from 'react';
import { Avatar, Typography, Tag, Spin, Alert, Card } from 'antd';
import {
  RobotOutlined,
  UserOutlined,
  LoadingOutlined,
  LinkOutlined,
  CompassOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ConversationMessage,
  CopilotToolStep,
  isValidSourcePath,
  getErrorMessageByCode,
  createMarkdownComponents,
} from './copilotApi';
import DraftCard from './DraftCard';
import ScanCard from './ScanCard';
import { brandColors } from '../../theme/brand';

const { Text } = Typography;

interface MessageViewProps {
  messages: ConversationMessage[];
  currentSteps: CopilotToolStep[];
  isStreaming: boolean;
  suggestedPrompts: string[];
  onSelectPrompt: (prompt: string) => void;
}

export const MessageView: React.FC<MessageViewProps> = ({
  messages,
  currentSteps,
  isStreaming,
  suggestedPrompts,
  onSelectPrompt,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const markdownComponents = useMemo(
    () => createMarkdownComponents({ LinkComponent: Link }),
    [],
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentSteps, isStreaming]);

  const isEmpty = messages.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', padding: '16px 12px' }}>
      {/* Empty State / Welcome Screen */}
      {isEmpty && (
        <div style={{ padding: '20px 8px', textAlign: 'center' }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: brandColors.navy,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
            }}
          >
            <RobotOutlined style={{ fontSize: 28, color: brandColors.mint }} />
          </div>
          <Text strong style={{ fontSize: 16, color: brandColors.navy, display: 'block' }}>
            ERP4U Copilot
          </Text>
          <Text type="secondary" style={{ fontSize: 13, display: 'block', marginTop: 4, marginBottom: 20 }}>
            Trợ lý thông minh hỗ trợ hỏi đáp dữ liệu doanh nghiệp, tra cứu đơn hàng, công nợ, tồn kho và sản xuất.
          </Text>

          {suggestedPrompts.length > 0 && (
            <div style={{ textAlign: 'left', marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <CompassOutlined style={{ color: brandColors.navy }} />
                <Text strong style={{ fontSize: 12, color: '#475569' }}>
                  Gợi ý câu hỏi:
                </Text>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {suggestedPrompts.map((prompt, idx) => (
                  <Card
                    key={idx}
                    size="small"
                    hoverable
                    onClick={() => onSelectPrompt(prompt)}
                    style={{
                      borderRadius: 8,
                      border: '1px solid #e2e8f0',
                      background: '#f8fafc',
                      cursor: 'pointer',
                    }}
                    bodyStyle={{ padding: '8px 12px' }}
                  >
                    <Text style={{ fontSize: 13, color: '#0369a1' }}>
                      {prompt}
                    </Text>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Message List */}
      {messages.map((msg) => {
        const isUser = msg.role === 'user';
        const hasError = !!msg.error_code;

        return (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: isUser ? 'row-reverse' : 'row',
              gap: 8,
              marginBottom: 16,
              alignItems: 'flex-start',
            }}
          >
            <Avatar
              size="small"
              icon={isUser ? <UserOutlined /> : <RobotOutlined />}
              style={{
                backgroundColor: isUser ? '#10b981' : '#0284c7',
                flexShrink: 0,
                marginTop: 4,
              }}
            />

            <div style={{ maxWidth: '85%', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div
                style={{
                  background: isUser ? '#0284c7' : '#ffffff',
                  color: isUser ? '#ffffff' : '#1e293b',
                  padding: '10px 14px',
                  borderRadius: isUser ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  fontSize: 13,
                  lineHeight: 1.5,
                  border: isUser ? 'none' : '1px solid #e2e8f0',
                  wordBreak: 'break-word',
                }}
              >
                {/* Error message */}
                {hasError ? (
                  <Alert
                    type="error"
                    showIcon
                    icon={<WarningOutlined />}
                    message={getErrorMessageByCode(msg.error_code, msg.content)}
                    style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6 }}
                  />
                ) : isUser ? (
                  <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                ) : (
                  <div className="copilot-markdown">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={markdownComponents}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                )}

                {/* Sources list */}
                {msg.sources && msg.sources.length > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <LinkOutlined style={{ fontSize: 11 }} />
                      Nguồn tham khảo:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {msg.sources.map((s, sIdx) => {
                        const canLink = isValidSourcePath(s.path);
                        return canLink ? (
                          <Link key={sIdx} to={s.path}>
                            <Tag
                              color="blue"
                              style={{ cursor: 'pointer', borderRadius: 4, fontSize: 11, margin: 0 }}
                            >
                              {s.label || s.id}
                            </Tag>
                          </Link>
                        ) : (
                          <Tag key={sIdx} style={{ borderRadius: 4, fontSize: 11, margin: 0, color: '#64748b' }}>
                            {s.label || s.id}
                          </Tag>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Drafts list */}
                {msg.drafts && msg.drafts.length > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
                    {msg.drafts.map((draft) => (
                      <DraftCard key={draft.id} draft={draft} />
                    ))}
                  </div>
                )}

                {/* Scans list */}
                {msg.scans && msg.scans.length > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
                    {msg.scans.map((scan) => (
                      <ScanCard key={scan.id} scan={scan} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Streaming step progress */}
      {isStreaming && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 16 }}>
          <Avatar
            size="small"
            icon={<RobotOutlined />}
            style={{ backgroundColor: '#0284c7', flexShrink: 0, marginTop: 4 }}
          />
          <div
            style={{
              background: '#f8fafc',
              border: '1px dashed #cbd5e1',
              borderRadius: '14px 14px 14px 2px',
              padding: '10px 14px',
              fontSize: 12,
              color: '#475569',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {currentSteps.length > 0 ? (
              currentSteps.map((step, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#0284c7' }}>
                  <Spin indicator={<LoadingOutlined style={{ fontSize: 14 }} spin />} />
                  <span>{step.label}</span>
                </div>
              ))
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#0284c7' }}>
                <Spin indicator={<LoadingOutlined style={{ fontSize: 14 }} spin />} />
                <span>AI đang xử lý yêu cầu…</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageView;
