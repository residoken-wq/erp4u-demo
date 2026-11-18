import React, { useState, useRef, useEffect } from 'react';
import { Card, Input, Button, List, Avatar, Tag, Typography, Spin, Tooltip, message as antdMessage } from 'antd';
import {
    RobotOutlined,
    SendOutlined,
    UserOutlined,
    CopyOutlined,
    ClearOutlined,
    AudioOutlined,
    LoadingOutlined,
    ThunderboltOutlined,
    BookOutlined
} from '@ant-design/icons';
import { API_URL } from '../../config';

const { Title, Paragraph, Text } = Typography;

interface HelpAiAssistantProps {
    initialQuestion?: string;
    onSelectTopic?: (topicId: string) => void;
}

interface Message {
    id: string;
    sender: 'USER' | 'BOT';
    text: string;
    timestamp: Date;
    status?: string;
}

export const HelpAiAssistant: React.FC<HelpAiAssistantProps> = ({
    initialQuestion,
    onSelectTopic
}) => {
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '0',
            sender: 'BOT',
            text: 'Xin chào! Tôi là **ERP4U Help Copilot** - Trợ lý giải đáp quy trình và cẩm nang thao tác hệ thống ERP4U. Bạn có thể hỏi tôi bất kỳ điều gì về: quy trình tạo đơn, xuất hóa đơn EasyInvoice, xếp sơ đồ 2D Nesting, quản lý thiết kế in thêu hoặc hạch toán lợi nhuận đơn hàng!',
            timestamp: new Date()
        }
    ]);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (initialQuestion) {
            handleSend(`Hướng dẫn tôi về: ${initialQuestion}`);
        }
    }, [initialQuestion]);

    const processChatStream = async (response: Response, botMsgId: string) => {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        if (!reader) return;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.replace('data: ', '').trim();
                    if (dataStr === '[DONE]') continue;
                    try {
                        const parsed = JSON.parse(dataStr);
                        if (parsed.text) {
                            setMessages(prev => prev.map(m =>
                                m.id === botMsgId ? { ...m, text: m.text + parsed.text, status: undefined } : m
                            ));
                        } else if (parsed.status) {
                            setMessages(prev => prev.map(m =>
                                m.id === botMsgId ? { ...m, status: parsed.status } : m
                            ));
                        } else if (parsed.error) {
                            setMessages(prev => prev.map(m =>
                                m.id === botMsgId ? { ...m, text: m.text + '\n\n❌ **[Lỗi hệ thống: ' + parsed.error + ']**', status: undefined } : m
                            ));
                        }
                    } catch (e) {
                        // ignore incomplete chunks
                    }
                }
            }
        }
    };

    const handleSend = async (customQuery?: string) => {
        const queryText = customQuery || input;
        if (!queryText.trim()) return;

        const userMsg: Message = { id: Date.now().toString(), sender: 'USER', text: queryText, timestamp: new Date() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        const botMsgId = (Date.now() + 1).toString();
        setMessages(prev => [...prev, { id: botMsgId, sender: 'BOT', text: '', timestamp: new Date() }]);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/ai/chat-stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    message: queryText,
                    contextUrl: '/help',
                    activeContext: {
                        pathname: '/help',
                        screen: 'Help Center & SOP Knowledge Base',
                        purpose: 'Hỗ trợ giải đáp quy trình SOP, cẩm nang thao tác và hướng dẫn nghiệp vụ ERP4U'
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`Lỗi kết nối máy chủ (${response.status})`);
            }

            await processChatStream(response, botMsgId);
        } catch (error: any) {
            console.error(error);
            setMessages(prev => prev.map(m =>
                m.id === botMsgId ? { ...m, text: m.text + `\n\n❌ [Không thể kết nối máy chủ AI: ${error.message || 'Lỗi mạng'}]` } : m
            ));
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        antdMessage.success('Đã sao chép nội dung câu trả lời!');
    };

    const handleClear = () => {
        setMessages([
            {
                id: '0',
                sender: 'BOT',
                text: 'Cuộc trò chuyện đã được làm mới. Hãy đặt câu hỏi về quy trình hoặc tính năng bạn muốn tìm hiểu!',
                timestamp: new Date()
            }
        ]);
    };

    const toggleListen = async () => {
        if (isListening) {
            setIsListening(false);
            return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            antdMessage.warning('Trình duyệt không hỗ trợ Web Speech API.');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'vi-VN';
        recognition.interimResults = false;
        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setInput(prev => (prev ? `${prev} ${transcript}` : transcript));
        };
        recognition.start();
    };

    const QUICK_QUESTIONS = [
        'Quy trình xuất hóa đơn VAT EasyInvoice từ đơn hàng SO?',
        'Cách dùng công cụ 2D Nesting để xếp rập cắt vải?',
        'Quy trình tải file thiết kế in ấn và chia sẻ cho khách duyệt?',
        'Hệ thống tự động hạch toán chi phí vào Lợi nhuận SO như thế nào?',
        'Lập đơn hàng nội bộ giá 0 đồng để xuất dùng thì làm sao?'
    ];

    return (
        <Card
            style={{
                maxWidth: 960,
                margin: '0 auto',
                borderRadius: 16,
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
                overflow: 'hidden'
            }}
            bodyStyle={{ padding: 0, display: 'flex', flexDirection: 'column', height: 680 }}
        >
            {/* Header */}
            <div
                style={{
                    padding: '16px 20px',
                    background: 'linear-gradient(135deg, #090e1a 0%, #1e293b 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            background: '#0284c7',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 0 12px rgba(2, 132, 199, 0.5)'
                        }}
                    >
                        <RobotOutlined style={{ fontSize: 20 }} />
                    </div>
                    <div>
                        <div style={{ color: '#ffffff', fontWeight: 700, fontSize: 15 }}>
                            ERP4U Help Copilot (AI SOP Specialist)
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: 12 }}>
                            Trợ lý ảo giải đáp quy trình, thao tác nghiệp vụ và xử lý lỗi ERP
                        </div>
                    </div>
                </div>

                <Button
                    type="text"
                    icon={<ClearOutlined />}
                    onClick={handleClear}
                    style={{ color: '#94a3b8' }}
                    title="Làm mới đoạn chat"
                >
                    Làm mới
                </Button>
            </div>

            {/* Chat Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: '#f8fafc' }}>
                <List
                    dataSource={messages}
                    renderItem={item => (
                        <List.Item style={{ border: 'none', padding: '8px 0', justifyContent: item.sender === 'USER' ? 'flex-end' : 'flex-start' }}>
                            <div
                                style={{
                                    maxWidth: '85%',
                                    display: 'flex',
                                    flexDirection: item.sender === 'USER' ? 'row-reverse' : 'row',
                                    gap: 10,
                                    alignItems: 'flex-start'
                                }}
                            >
                                <Avatar
                                    size="small"
                                    icon={item.sender === 'USER' ? <UserOutlined /> : <RobotOutlined />}
                                    style={{
                                        backgroundColor: item.sender === 'USER' ? '#10b981' : '#0284c7',
                                        flexShrink: 0,
                                        marginTop: 4
                                    }}
                                />

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <div
                                        style={{
                                            background: item.sender === 'USER' ? '#0284c7' : '#ffffff',
                                            color: item.sender === 'USER' ? '#ffffff' : '#1e293b',
                                            padding: '12px 16px',
                                            borderRadius: item.sender === 'USER' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                                            fontSize: 14,
                                            lineHeight: 1.6,
                                            border: item.sender === 'USER' ? 'none' : '1px solid #e2e8f0',
                                            whiteSpace: 'pre-wrap'
                                        }}
                                    >
                                        {item.status && !item.text && (
                                            <div style={{ color: '#0284c7', display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <Spin indicator={<LoadingOutlined spin />} />
                                                <span>{item.status}</span>
                                            </div>
                                        )}
                                        {item.text}
                                    </div>

                                    {item.sender === 'BOT' && item.id !== '0' && item.text && (
                                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', paddingLeft: 4 }}>
                                            <Tooltip title="Sao chép câu trả lời">
                                                <Button
                                                    type="text"
                                                    size="small"
                                                    icon={<CopyOutlined />}
                                                    style={{ color: '#94a3b8', fontSize: 12, height: 22, padding: '0 4px' }}
                                                    onClick={() => handleCopy(item.text)}
                                                />
                                            </Tooltip>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </List.Item>
                    )}
                />
                <div ref={messagesEndRef} />
            </div>

            {/* Suggested Question Chips */}
            <div
                style={{
                    padding: '10px 16px',
                    background: '#ffffff',
                    borderTop: '1px solid #e2e8f0',
                    display: 'flex',
                    gap: 6,
                    overflowX: 'auto',
                    whiteSpace: 'nowrap'
                }}
            >
                <span style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, marginRight: 4 }}>
                    <ThunderboltOutlined style={{ color: '#f59e0b' }} /> Câu hỏi phổ biến:
                </span>
                {QUICK_QUESTIONS.map((q, idx) => (
                    <Tag
                        key={idx}
                        color="blue"
                        style={{
                            cursor: 'pointer',
                            borderRadius: 12,
                            padding: '3px 10px',
                            fontSize: 12,
                            background: '#f0f9ff',
                            borderColor: '#bae6fd',
                            color: '#0369a1'
                        }}
                        onClick={() => handleSend(q)}
                    >
                        {q}
                    </Tag>
                ))}
            </div>

            {/* Input Bar */}
            <div style={{ padding: '14px 18px', background: '#ffffff', borderTop: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Input.TextArea
                        placeholder="Hỏi ERP4U Help Copilot về quy trình hoặc cách thao tác..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        disabled={loading}
                        autoSize={{ minRows: 1, maxRows: 3 }}
                        style={{ borderRadius: 8, resize: 'none', fontSize: 14 }}
                    />
                    <Button
                        type={isListening ? 'primary' : 'default'}
                        danger={isListening}
                        icon={<AudioOutlined />}
                        onClick={toggleListen}
                        disabled={loading}
                        title="Nhập bằng giọng nói"
                        style={{ borderRadius: 8, height: 40 }}
                    />
                    <Button
                        type="primary"
                        icon={<SendOutlined />}
                        onClick={() => handleSend()}
                        loading={loading}
                        style={{
                            borderRadius: 8,
                            height: 40,
                            background: '#0284c7',
                            borderColor: '#0284c7',
                            fontWeight: 600
                        }}
                    >
                        Gửi
                    </Button>
                </div>
            </div>
        </Card>
    );
};
