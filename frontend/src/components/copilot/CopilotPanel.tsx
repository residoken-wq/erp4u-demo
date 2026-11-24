import React, { useState, useEffect, useRef } from 'react';
import {
  FloatButton,
  Drawer,
  Input,
  Button,
  Typography,
  Tooltip,
  message as antdMessage,
} from 'antd';
import {
  RobotOutlined,
  SendOutlined,
  StopOutlined,
  UnorderedListOutlined,
  PlusOutlined,
  ArrowLeftOutlined,
  CloseOutlined,
  PaperClipOutlined,
  UploadOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { uploadScanDocument } from '../documents/documentScanApi';
import { validateScanFile } from '../documents/documentScanTransformers';
import { API_URL } from '../../config';
import useMobile from '../../hooks/useMobile';
import { useEntitlements } from '../../hooks/useEntitlements';
import { brandColors } from '../../theme/brand';
import { ConversationList } from './ConversationList';
import { MessageView } from './MessageView';
import {
  ConversationItem,
  ConversationMessage,
  CopilotToolStep,
  StreamCoordinator,
  RequestTracker,
  getConversations,
  getConversationDetail,
  updateConversationTitle,
  deleteConversation,
  sendChatMessageStream,
  getSuggestedQuestions,
} from './copilotApi';

const { Text } = Typography;

export function openCopilotWithPrompt(prompt?: string) {
  window.dispatchEvent(
    new CustomEvent('erp4u:open-copilot', { detail: { prompt } }),
  );
}

export const CopilotPanel: React.FC = () => {
  const isMobile = useMobile();
  const { isEnabled } = useEntitlements();

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'chat' | 'list'>('chat');
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState<string>('Cuộc trò chuyện mới');
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [currentSteps, setCurrentSteps] = useState<CopilotToolStep[]>([]);
  const [input, setInput] = useState('');
  const [loadingList, setLoadingList] = useState(false);
  const [loadingConv, setLoadingConv] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [uploadingScan, setUploadingScan] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const streamCoordinatorRef = useRef(new StreamCoordinator());
  const selectTrackerRef = useRef(new RequestTracker());

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      streamCoordinatorRef.current.cancelCurrent();
    };
  }, []);

  // Event listener to open Copilot externally with a pre-filled prompt (Task P9d1)
  useEffect(() => {
    const handleOpenExternal = (e: any) => {
      const prompt = e?.detail?.prompt;
      setOpen(true);
      setView('chat');
      if (prompt) {
        setInput(prompt);
      }
    };
    window.addEventListener('erp4u:open-copilot', handleOpenExternal);
    return () => {
      window.removeEventListener('erp4u:open-copilot', handleOpenExternal);
    };
  }, []);

  // Load conversations on mount or when opening
  const loadConversations = async () => {
    try {
      setLoadingList(true);
      const list = await getConversations(API_URL);
      setConversations(list);
    } catch (err: any) {
      console.warn('[Copilot] Could not load conversations:', err?.message);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadConversations();
    }
  }, [open]);

  // Load active conversation details with fast-switching race condition prevention
  const selectConversation = async (id: string) => {
    // 1. Huỷ luồng stream đang chạy (nếu có)
    streamCoordinatorRef.current.cancelCurrent();
    setIsStreaming(false);
    setCurrentSteps([]);

    // 2. Gắn mã request cho lần chọn này
    const reqId = selectTrackerRef.current.nextRequestId();
    setLoadingConv(true);
    setActiveId(id);
    setView('chat');

    try {
      const detail = await getConversationDetail(id, API_URL);
      // Chỉ áp dụng kết quả nếu request này là lần chọn mới nhất
      if (!selectTrackerRef.current.isCurrent(reqId)) {
        return;
      }
      setActiveTitle(detail.title || 'Cuộc trò chuyện');
      setMessages(detail.messages || []);
    } catch (err: any) {
      if (!selectTrackerRef.current.isCurrent(reqId)) {
        return;
      }
      antdMessage.error('Không thể tải lịch sử cuộc trò chuyện');
    } finally {
      if (selectTrackerRef.current.isCurrent(reqId)) {
        setLoadingConv(false);
      }
    }
  };

  const handleNewConversation = () => {
    streamCoordinatorRef.current.cancelCurrent();
    selectTrackerRef.current.reset();
    setIsStreaming(false);
    setActiveId(null);
    setActiveTitle('Cuộc trò chuyện mới');
    setMessages([]);
    setCurrentSteps([]);
    setView('chat');
  };

  const handleRename = async (id: string, newTitle: string) => {
    try {
      await updateConversationTitle(id, newTitle, API_URL);
      antdMessage.success('Đổi tên hội thoại thành công');
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c))
      );
      if (activeId === id) {
        setActiveTitle(newTitle);
      }
    } catch (err: any) {
      antdMessage.error('Không thể đổi tên cuộc hội thoại');
    }
  };

  const handleDelete = async (id: string) => {
    if (activeId === id || isStreaming) {
      streamCoordinatorRef.current.cancelCurrent();
      setIsStreaming(false);
      setCurrentSteps([]);
    }
    try {
      await deleteConversation(id, API_URL);
      antdMessage.success('Đã xoá cuộc hội thoại');
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) {
        handleNewConversation();
      }
    } catch (err: any) {
      antdMessage.error('Không thể xoá cuộc hội thoại');
    }
  };

  const handleStopStreaming = () => {
    streamCoordinatorRef.current.cancelCurrent();
    setIsStreaming(false);
    setCurrentSteps([]);
  };

  const handleClosePanel = () => {
    streamCoordinatorRef.current.cancelCurrent();
    setIsStreaming(false);
    setCurrentSteps([]);
    setOpen(false);
  };

  const handleFileUpload = async (file: File) => {
    const validation = validateScanFile(file);
    if (!validation.valid) {
      antdMessage.error(validation.error);
      return;
    }

    setUploadingScan(true);
    try {
      const scanResult = await uploadScanDocument(file, 'auto');
      const scanMsg: ConversationMessage = {
        id: `scan-${Date.now()}`,
        role: 'assistant',
        content: `Tôi đã nhận diện được chứng từ "${file.name}". Bạn có thể kiểm tra loại chứng từ dự kiến và mở để duyệt:`,
        scans: [scanResult],
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, scanMsg]);
      antdMessage.success('Tải lên và nhận diện chứng từ thành công');
    } catch (err: any) {
      antdMessage.error(err.message || 'Lỗi khi đọc chứng từ');
    } finally {
      setUploadingScan(false);
    }
  };

  const handleSend = async (customMessage?: string) => {
    const messageToSend = (customMessage ?? input).trim();
    if (!messageToSend || isStreaming) return;

    if (messageToSend.length > 4000) {
      antdMessage.warning('Tin nhắn vượt quá giới hạn 4.000 ký tự');
      return;
    }

    // Add user message to state
    const userMsg: ConversationMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: messageToSend,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsStreaming(true);
    setCurrentSteps([]);

    const session = streamCoordinatorRef.current.startRequest();
    const reqId = session.requestId;

    let targetConvId = activeId;

    try {
      await sendChatMessageStream({
        conversation_id: targetConvId || undefined,
        message: messageToSend,
        signal: session.signal,
        baseUrl: API_URL,
        onEvent: (event) => {
          // Bỏ qua sự kiện nếu request không còn hiện hành (đã bị huỷ hoặc chuyển hội thoại)
          if (!streamCoordinatorRef.current.isCurrent(reqId)) {
            return;
          }
          switch (event.type) {
            case 'conversation': {
              targetConvId = event.data.id;
              setActiveId(event.data.id);
              if (event.data.title) {
                setActiveTitle(event.data.title);
              }
              break;
            }
            case 'step': {
              setCurrentSteps((prev) => [...prev, event.data]);
              break;
            }
            case 'answer': {
              const assistantMsg: ConversationMessage = {
                id: event.data.message_id || `bot-${Date.now()}`,
                role: 'assistant',
                content: event.data.content,
                sources: event.data.sources,
                drafts: event.data.drafts,
                created_at: new Date().toISOString(),
              };
              setMessages((prev) => [...prev, assistantMsg]);
              setCurrentSteps([]);
              break;
            }
            case 'error': {
              const errorMsg: ConversationMessage = {
                id: `err-${Date.now()}`,
                role: 'assistant',
                content: event.data.message,
                error_code: event.data.code,
                created_at: new Date().toISOString(),
              };
              setMessages((prev) => [...prev, errorMsg]);
              setCurrentSteps([]);
              break;
            }
            case 'done': {
              setIsStreaming(false);
              loadConversations();
              break;
            }
          }
        },
      });
    } catch (err: any) {
      if (!streamCoordinatorRef.current.isCurrent(reqId)) {
        return;
      }
      if (err.name === 'AbortError') {
        antdMessage.info('Đã dừng tạo câu trả lời');
      } else {
        const errorMsg: ConversationMessage = {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: err.message || 'Mất kết nối tới máy chủ',
          error_code: 'INTERNAL',
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } finally {
      if (streamCoordinatorRef.current.isCurrent(reqId)) {
        setIsStreaming(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestedPrompts = getSuggestedQuestions(isEnabled);

  const drawerWidth = isMobile ? '100vw' : 420;

  return (
    <>
      {/* Floating Action Button */}
      <FloatButton
        icon={<RobotOutlined style={{ fontSize: 20, color: brandColors.mint }} />}
        type="primary"
        style={{ right: 24, bottom: 80, width: 48, height: 48, background: brandColors.navy }}
        onClick={() => setOpen(true)}
        tooltip="ERP4U Copilot"
      />

      {/* Copilot Drawer Panel */}
      <Drawer
        open={open}
        onClose={handleClosePanel}
        placement="right"
        width={drawerWidth}
        closable={false}
        bodyStyle={{ padding: 0, display: 'flex', flexDirection: 'column', height: '100%', background: '#f8fafc' }}
        headerStyle={{ display: 'none' }}
      >
        {/* Custom Header */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid #e2e8f0',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 54,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
            {view === 'chat' && (
              <Button
                type="text"
                size="small"
                icon={<ArrowLeftOutlined />}
                onClick={() => setView('list')}
                title="Danh sách hội thoại"
              />
            )}
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: brandColors.navy,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <RobotOutlined style={{ color: brandColors.mint, fontSize: 16 }} />
            </div>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <Text strong style={{ fontSize: 14, color: '#0f172a' }}>
                {view === 'chat' ? activeTitle : 'Lịch sử hội thoại'}
              </Text>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {view === 'chat' ? (
              <>
                <Tooltip title="Đoạn chat mới">
                  <Button
                    type="text"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={handleNewConversation}
                  />
                </Tooltip>
                <Tooltip title="Danh sách hội thoại">
                  <Button
                    type="text"
                    size="small"
                    icon={<UnorderedListOutlined />}
                    onClick={() => setView('list')}
                  />
                </Tooltip>
              </>
            ) : (
              <Tooltip title="Đoạn chat mới">
                <Button
                  type="text"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={handleNewConversation}
                />
              </Tooltip>
            )}
            <Button
              type="text"
              size="small"
              icon={<CloseOutlined />}
              onClick={handleClosePanel}
            />
          </div>
        </div>

        {/* Content Body */}
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            if (e.currentTarget === e.target) {
              setIsDragging(false);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) {
              handleFileUpload(file);
            }
          }}
        >
          {isDragging && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(39, 47, 114, 0.88)',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                pointerEvents: 'none',
              }}
            >
              <UploadOutlined style={{ fontSize: 44, marginBottom: 12, color: brandColors.mint }} />
              <Text strong style={{ color: '#ffffff', fontSize: 16 }}>
                Kéo thả file chứng từ vào đây
              </Text>
              <Text style={{ color: '#cbd5e1', fontSize: 12, marginTop: 4 }}>
                Hỗ trợ ảnh JPEG/PNG, PDF (≤ 5 trang), XML TT78 (tối đa 10 MB)
              </Text>
            </div>
          )}
          {view === 'list' ? (
            <ConversationList
              conversations={conversations}
              activeId={activeId}
              onSelect={selectConversation}
              onNew={handleNewConversation}
              onRename={handleRename}
              onDelete={handleDelete}
              loading={loadingList}
            />
          ) : (
            <>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <MessageView
                  messages={messages}
                  currentSteps={currentSteps}
                  isStreaming={isStreaming}
                  suggestedPrompts={suggestedPrompts}
                  onSelectPrompt={(p) => handleSend(p)}
                />
              </div>

              {/* Input Area */}
              <div
                style={{
                  padding: '10px 12px',
                  background: '#ffffff',
                  borderTop: '1px solid #e2e8f0',
                }}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept="image/*,application/pdf,.xml"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                      e.target.value = '';
                    }}
                  />
                  <Tooltip title="Đính kèm chứng từ (Ảnh, PDF, XML)">
                    <Button
                      type="text"
                      icon={uploadingScan ? <LoadingOutlined /> : <PaperClipOutlined />}
                      disabled={uploadingScan || isStreaming}
                      onClick={() => fileInputRef.current?.click()}
                      style={{ height: 32, borderRadius: 8, color: '#64748b' }}
                    />
                  </Tooltip>
                  <Input.TextArea
                    placeholder="Hỏi ERP4U Copilot bất cứ điều gì về ERP..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isStreaming}
                    maxLength={4000}
                    showCount={{
                      formatter: ({ count, maxLength }) => (
                        <span style={{ fontSize: 10, color: '#94a3b8' }}>{`${count}/${maxLength}`}</span>
                      ),
                    }}
                    autoSize={{ minRows: 1, maxRows: 4 }}
                    style={{ borderRadius: 8, resize: 'none' }}
                  />

                  {isStreaming ? (
                    <Button
                      danger
                      icon={<StopOutlined />}
                      onClick={handleStopStreaming}
                      title="Dừng phản hồi"
                      style={{ borderRadius: 8, height: 32 }}
                    />
                  ) : (
                    <Button
                      type="primary"
                      icon={<SendOutlined />}
                      onClick={() => handleSend()}
                      disabled={!input.trim()}
                      style={{
                        borderRadius: 8,
                        background: brandColors.navy,
                        borderColor: brandColors.navy,
                        height: 32,
                      }}
                    />
                  )}
                </div>

                {/* Fixed Disclaimer Notice */}
                <div
                  style={{
                    fontSize: 11,
                    color: '#94a3b8',
                    textAlign: 'center',
                    marginTop: 6,
                    lineHeight: '14px',
                  }}
                >
                  AI có thể sai — kiểm tra lại số liệu trước khi quyết định.
                </div>
              </div>
            </>
          )}
        </div>
      </Drawer>
    </>
  );
};

export default CopilotPanel;
