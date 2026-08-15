import React, { useState, useRef, useEffect } from 'react';
import { FloatButton, Drawer, Input, Button, List, Avatar, Tag, Card, Typography, Spin, Tooltip, message as antdMessage } from 'antd';
import { 
    RobotOutlined, 
    SendOutlined, 
    UserOutlined, 
    LikeOutlined, 
    DislikeOutlined, 
    AudioOutlined, 
    LoadingOutlined,
    SafetyCertificateOutlined,
    CheckOutlined,
    CloseOutlined,
    CopyOutlined,
    ClearOutlined,
    FullscreenOutlined,
    FullscreenExitOutlined
} from '@ant-design/icons';
import { API_URL } from '../../config';

interface PermissionRequest {
    requestId: string;
    toolName: string;
    args: any;
    title: string;
    description: string;
    scope: string;
}

interface Message {
    id: string;
    sender: 'USER' | 'BOT';
    text: string;
    timestamp: Date;
    status?: string;
    permissionRequest?: PermissionRequest;
    permissionResolved?: 'APPROVED' | 'REJECTED';
}

const formatInline = (text: string): React.ReactNode => {
    if (!text) return '';
    // Format bold **text**, code `code`, italic *text*
    const parts = text.split(/(\*\*.*?\*\*|`.*?`|\*.*?\*)/g);
    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={index} style={{ color: '#111827', fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
            return <code key={index} style={{ background: '#f3f4f6', padding: '1px 5px', borderRadius: '4px', fontSize: '12px', color: '#b91c1c', fontFamily: 'monospace' }}>{part.slice(1, -1)}</code>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
            return <em key={index}>{part.slice(1, -1)}</em>;
        }
        return part;
    });
};

const renderMarkdown = (text: string): React.ReactNode => {
    if (!text) return null;

    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        // 1. Markdown Table Detection
        if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
            const tableLines: string[] = [];
            while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
                tableLines.push(lines[i].trim());
                i++;
            }

            if (tableLines.length >= 2) {
                const headerLine = tableLines[0];
                const isSeparator = (str: string) => str.includes('---') || str.includes(':-');
                const hasSeparator = tableLines.length > 1 && isSeparator(tableLines[1]);

                const parseRow = (rowStr: string) => {
                    return rowStr
                        .slice(1, -1)
                        .split('|')
                        .map(cell => cell.trim());
                };

                const headers = parseRow(headerLine);
                const bodyRows = (hasSeparator ? tableLines.slice(2) : tableLines.slice(1)).map(parseRow);

                elements.push(
                    <div key={`table-${i}`} style={{ overflowX: 'auto', margin: '8px 0', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', background: '#fff' }}>
                            <thead>
                                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                                    {headers.map((h, idx) => (
                                        <th key={idx} style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>
                                            {formatInline(h)}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {bodyRows.map((row, rIdx) => (
                                    <tr key={rIdx} style={{ borderBottom: '1px solid #f3f4f6', background: rIdx % 2 === 1 ? '#f9fafb' : '#fff' }}>
                                        {row.map((cell, cIdx) => (
                                            <td key={cIdx} style={{ padding: '6px 8px', color: '#4b5563' }}>
                                                {formatInline(cell)}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
                continue;
            }
        }

        // 2. Headings
        if (line.startsWith('### ')) {
            elements.push(<h4 key={`h3-${i}`} style={{ margin: '8px 0 4px', fontSize: '13px', fontWeight: 700, color: '#1d4ed8' }}>{formatInline(line.slice(4))}</h4>);
            i++;
            continue;
        }
        if (line.startsWith('## ')) {
            elements.push(<h3 key={`h2-${i}`} style={{ margin: '10px 0 4px', fontSize: '14px', fontWeight: 700, color: '#1e40af' }}>{formatInline(line.slice(3))}</h3>);
            i++;
            continue;
        }
        if (line.startsWith('# ')) {
            elements.push(<h2 key={`h1-${i}`} style={{ margin: '12px 0 6px', fontSize: '15px', fontWeight: 700, color: '#172554' }}>{formatInline(line.slice(2))}</h2>);
            i++;
            continue;
        }

        // 3. Bullet points
        if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
            const listItems: string[] = [];
            while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))) {
                listItems.push(lines[i].trim().replace(/^[-*]\s+/, ''));
                i++;
            }
            elements.push(
                <ul key={`ul-${i}`} style={{ paddingLeft: '18px', margin: '4px 0' }}>
                    {listItems.map((item, idx) => (
                        <li key={idx} style={{ marginBottom: '2px', color: '#374151' }}>{formatInline(item)}</li>
                    ))}
                </ul>
            );
            continue;
        }

        // 4. Numbered list
        if (/^\d+\.\s/.test(line.trim())) {
            const listItems: string[] = [];
            while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
                listItems.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
                i++;
            }
            elements.push(
                <ol key={`ol-${i}`} style={{ paddingLeft: '18px', margin: '4px 0' }}>
                    {listItems.map((item, idx) => (
                        <li key={idx} style={{ marginBottom: '2px', color: '#374151' }}>{formatInline(item)}</li>
                    ))}
                </ol>
            );
            continue;
        }

        // 5. Normal line / paragraph
        if (line.trim() === '') {
            elements.push(<div key={`empty-${i}`} style={{ height: '4px' }} />);
        } else {
            elements.push(
                <div key={`p-${i}`} style={{ margin: '2px 0', color: '#1f2937' }}>
                    {formatInline(line)}
                </div>
            );
        }
        i++;
    }

    return <>{elements}</>;
};

const AiChatWidget: React.FC = () => {
    const [open, setOpen] = useState(false);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '0',
            sender: 'BOT',
            text: 'Xin chào! Tôi là **ERP4U Copilot**. Tôi có thể phân tích 360° khách hàng, doanh thu, đơn hàng, công nợ và kế hoạch sản xuất MRP. Hãy thử một trong các gợi ý bên dưới hoặc hỏi tôi bất cứ điều gì!',
            timestamp: new Date()
        }
    ]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const [isExpanded, setIsExpanded] = useState(false);
    const [drawerWidth, setDrawerWidth] = useState<string | number>(() => {
        if (typeof window !== 'undefined') {
            if (window.innerWidth >= 992) return '50vw';
            if (window.innerWidth >= 640) return '75vw';
            return '100vw';
        }
        return '50vw';
    });

    useEffect(() => {
        const handleResize = () => {
            if (isExpanded) {
                setDrawerWidth('90vw');
            } else if (window.innerWidth >= 992) {
                setDrawerWidth('50vw'); // 50% width trên Desktop
            } else if (window.innerWidth >= 640) {
                setDrawerWidth('75vw');
            } else {
                setDrawerWidth('100vw');
            }
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isExpanded]);

    useEffect(() => {
        scrollToBottom();
    }, [messages, open]);

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
                        } else if (parsed.permission_request) {
                            setMessages(prev => prev.map(m =>
                                m.id === botMsgId ? { ...m, permissionRequest: parsed.permission_request, status: undefined } : m
                            ));
                        } else if (parsed.error) {
                            setMessages(prev => prev.map(m =>
                                m.id === botMsgId ? { ...m, text: m.text + '\n\n❌ **[Lỗi hệ thống: ' + parsed.error + ']**', status: undefined } : m
                            ));
                        }
                    } catch (e) {
                        // ignore JSON parse errors for incomplete chunks
                    }
                }
            }
        }
    };

    const handleSend = async (customText?: string) => {
        const queryText = customText || input;
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
                    message: userMsg.text,
                    contextUrl: window.location.pathname,
                    activeContext: {
                        pathname: window.location.pathname,
                        search: window.location.search,
                        title: document.title
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

    const handleApprovePermission = async (perm: PermissionRequest, messageId: string) => {
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, permissionResolved: 'APPROVED' } : m));

        const botMsgId = (Date.now() + 1).toString();
        setMessages(prev => [...prev, { id: botMsgId, sender: 'BOT', text: '', timestamp: new Date() }]);
        setLoading(true);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/ai/chat-stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    message: '',
                    contextUrl: window.location.pathname,
                    activeContext: {
                        pathname: window.location.pathname,
                        search: window.location.search
                    },
                    approvedPermission: {
                        approved: true,
                        toolName: perm.toolName,
                        requestId: perm.requestId,
                        args: perm.args
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
                m.id === botMsgId ? { ...m, text: m.text + `\n\n❌ [Lỗi thực thi sau khi cấp quyền: ${error.message || 'Lỗi mạng'}]` } : m
            ));
        } finally {
            setLoading(false);
        }
    };

    const handleRejectPermission = (perm: PermissionRequest, messageId: string) => {
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, permissionResolved: 'REJECTED' } : m));
        const botMsgId = (Date.now() + 1).toString();
        setMessages(prev => [
            ...prev,
            {
                id: botMsgId,
                sender: 'BOT',
                text: `Đã huỷ truy cập theo yêu cầu của bạn. Tôi có thể hỗ trợ bạn tác vụ nào khác?`,
                timestamp: new Date()
            }
        ]);
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        antdMessage.success('Đã sao chép nội dung câu trả lời!');
    };

    const handleClearChat = () => {
        setMessages([
            {
                id: '0',
                sender: 'BOT',
                text: 'Cuộc trò chuyện đã được làm mới. Tôi sẵn sàng hỗ trợ phân tích dữ liệu ERP tiếp theo!',
                timestamp: new Date()
            }
        ]);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const toggleListen = async () => {
        if (isListening) {
            setIsListening(false);
            return;
        }

        try {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                await navigator.mediaDevices.getUserMedia({ audio: true });
            }
        } catch (err) {
            antdMessage.error('Bạn cần cấp quyền Microphone cho trình duyệt để dùng tính năng này.');
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
        recognition.maxAlternatives = 1;

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onerror = (event: any) => {
            console.error('Speech recognition error', event.error);
            setIsListening(false);
        };
        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setInput(prev => prev ? `${prev} ${transcript}` : transcript);
        };

        recognition.start();
    };

    const handleFeedback = async (msgId: string, rating: 'GOOD' | 'BAD') => {
        try {
            const token = localStorage.getItem('token');
            const botMsg = messages.find(m => m.id === msgId);
            const userMsg = messages.slice().reverse().find((m) => m.sender === 'USER' && messages.indexOf(m) < messages.indexOf(botMsg!));

            if (!botMsg || !userMsg) return;

            let correction = undefined;
            if (rating === 'BAD') {
                correction = prompt('Bạn mong đợi AI trả lời như thế nào?');
                if (!correction && correction !== "") return;
            }

            await fetch(`${API_URL}/ai/feedback`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    messageId: msgId,
                    rating,
                    question: userMsg.text,
                    answer: botMsg.text,
                    correction
                })
            });
            antdMessage.success('Cảm ơn bạn đã đóng góp ý kiến để hoàn thiện AI!');
        } catch (e) {
            console.error('Error sending feedback:', e);
        }
    };

    return (
        <>
            <FloatButton
                icon={<RobotOutlined style={{ fontSize: 20 }} />}
                type="primary"
                style={{ right: 24, bottom: 80, width: 48, height: 48 }}
                onClick={() => setOpen(true)}
                tooltip="ERP4U Smart AI Copilot"
            />

            <Drawer
                title={
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <RobotOutlined style={{ color: '#0284c7', fontSize: 16 }} />
                            </div>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>ERP4U AI Copilot</div>
                                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 400 }}>Smart ERP Business Intelligence</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Button 
                                type="text" 
                                size="small" 
                                icon={isExpanded ? <FullscreenExitOutlined /> : <FullscreenOutlined />} 
                                onClick={() => setIsExpanded(!isExpanded)}
                                title={isExpanded ? "Thu về 50% màn hình" : "Mở rộng 90% màn hình"}
                                style={{ color: '#64748b' }}
                            />
                            <Button 
                                type="text" 
                                size="small" 
                                icon={<ClearOutlined />} 
                                onClick={handleClearChat}
                                title="Xóa đoạn chat"
                                style={{ color: '#64748b' }}
                            />
                        </div>
                    </div>
                }
                placement="right"
                onClose={() => setOpen(false)}
                open={open}
                width={drawerWidth}
                bodyStyle={{ padding: 0, display: 'flex', flexDirection: 'column', background: '#f8fafc' }}
                mask={false}
            >
                {/* Chat Message List */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px' }}>
                    <List
                        dataSource={messages}
                        renderItem={item => (
                            <List.Item style={{ border: 'none', padding: '6px 0', justifyContent: item.sender === 'USER' ? 'flex-end' : 'flex-start' }}>
                                <div style={{
                                    maxWidth: '92%',
                                    display: 'flex',
                                    flexDirection: item.sender === 'USER' ? 'row-reverse' : 'row',
                                    gap: 8,
                                    alignItems: 'flex-start'
                                }}>
                                    <Avatar
                                        size="small"
                                        icon={item.sender === 'USER' ? <UserOutlined /> : <RobotOutlined />}
                                        style={{ backgroundColor: item.sender === 'USER' ? '#10b981' : '#0284c7', flexShrink: 0, marginTop: 4 }}
                                    />
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
                                        {/* Message Bubble */}
                                        <div style={{
                                            background: item.sender === 'USER' ? '#0284c7' : '#ffffff',
                                            color: item.sender === 'USER' ? '#ffffff' : '#1e293b',
                                            padding: '10px 14px',
                                            borderRadius: item.sender === 'USER' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                                            fontSize: 13,
                                            lineHeight: 1.5,
                                            border: item.sender === 'USER' ? 'none' : '1px solid #e2e8f0'
                                        }}>
                                            {/* Step Progress / Status Indicator */}
                                            {item.status && !item.text && (
                                                <div style={{ color: '#0284c7', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                                                    <Spin indicator={<LoadingOutlined style={{ fontSize: 16 }} spin />} />
                                                    <span>{item.status}</span>
                                                </div>
                                            )}

                                            {/* Markdown Content */}
                                            {item.text && (
                                                <div>
                                                    {item.sender === 'USER' ? (
                                                        <div style={{ whiteSpace: 'pre-wrap' }}>{item.text}</div>
                                                    ) : (
                                                        renderMarkdown(item.text)
                                                    )}
                                                </div>
                                            )}

                                            {/* Interactive Permission Card (Human-in-the-loop) */}
                                            {item.permissionRequest && (
                                                <Card
                                                    size="small"
                                                    style={{
                                                        marginTop: 10,
                                                        background: '#f0fdf4',
                                                        borderColor: '#86efac',
                                                        borderRadius: 8,
                                                        boxShadow: '0 2px 6px rgba(16, 185, 129, 0.1)'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                                        <SafetyCertificateOutlined style={{ color: '#16a34a', fontSize: 18 }} />
                                                        <span style={{ fontWeight: 700, color: '#15803d', fontSize: 13 }}>
                                                            {item.permissionRequest.title}
                                                        </span>
                                                    </div>
                                                    <p style={{ margin: '4px 0 8px', fontSize: 12, color: '#166534', lineHeight: 1.4 }}>
                                                        {item.permissionRequest.description}
                                                    </p>
                                                    <div style={{ background: '#dcfce7', padding: '4px 8px', borderRadius: 4, fontSize: 11, color: '#14532d', marginBottom: 10 }}>
                                                        <strong>Phạm vi truy cập:</strong> {item.permissionRequest.scope}
                                                    </div>

                                                    {item.permissionResolved ? (
                                                        <Tag color={item.permissionResolved === 'APPROVED' ? 'green' : 'red'}>
                                                            {item.permissionResolved === 'APPROVED' ? '✓ Đã đồng ý cấp quyền' : '✕ Đã từ chối'}
                                                        </Tag>
                                                    ) : (
                                                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                                            <Button 
                                                                size="small" 
                                                                icon={<CloseOutlined />} 
                                                                onClick={() => handleRejectPermission(item.permissionRequest!, item.id)}
                                                                disabled={loading}
                                                            >
                                                                Từ chối
                                                            </Button>
                                                            <Button 
                                                                size="small" 
                                                                type="primary" 
                                                                style={{ background: '#16a34a', borderColor: '#16a34a' }}
                                                                icon={<CheckOutlined />} 
                                                                onClick={() => handleApprovePermission(item.permissionRequest!, item.id)}
                                                                disabled={loading}
                                                            >
                                                                Cho phép & Phân tích
                                                            </Button>
                                                        </div>
                                                    )}
                                                </Card>
                                            )}
                                        </div>

                                        {/* Action Bar for Bot Messages */}
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
                                                <Tooltip title="Câu trả lời hữu ích">
                                                    <Button 
                                                        type="text" 
                                                        size="small" 
                                                        icon={<LikeOutlined />} 
                                                        style={{ color: '#94a3b8', fontSize: 12, height: 22, padding: '0 4px' }}
                                                        onClick={() => handleFeedback(item.id, 'GOOD')} 
                                                    />
                                                </Tooltip>
                                                <Tooltip title="Chưa chính xác">
                                                    <Button 
                                                        type="text" 
                                                        size="small" 
                                                        icon={<DislikeOutlined />} 
                                                        style={{ color: '#94a3b8', fontSize: 12, height: 22, padding: '0 4px' }}
                                                        onClick={() => handleFeedback(item.id, 'BAD')} 
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

                {/* Quick Suggestion Chips */}
                <div style={{ padding: '8px 12px', background: '#f1f5f9', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 6, overflowX: 'auto', whiteSpace: 'nowrap' }}>
                    <Tag 
                        color="blue" 
                        style={{ cursor: 'pointer', borderRadius: 12, padding: '2px 8px' }} 
                        onClick={() => handleSend('Tóm tắt phân tích khách hàng Trường Mầm Non Đức Trí Plus')}
                    >
                        🔍 KH Đức Trí Plus
                    </Tag>
                    <Tag 
                        color="purple" 
                        style={{ cursor: 'pointer', borderRadius: 12, padding: '2px 8px' }} 
                        onClick={() => handleSend('Báo cáo doanh thu, chi phí và công nợ năm nay')}
                    >
                        📊 Báo cáo Tài chính
                    </Tag>
                    <Tag 
                        color="orange" 
                        style={{ cursor: 'pointer', borderRadius: 12, padding: '2px 8px' }} 
                        onClick={() => handleSend('Đơn hàng nào trong tháng này chưa thanh toán?')}
                    >
                        ⚠️ Đơn nợ quá hạn
                    </Tag>
                    <Tag 
                        color="green" 
                        style={{ cursor: 'pointer', borderRadius: 12, padding: '2px 8px' }} 
                        onClick={() => handleSend('Kiểm tra kế hoạch sản xuất MRP')}
                    >
                        ⚙️ Kế hoạch MRP
                    </Tag>
                </div>

                {/* Chat Input Bar */}
                <div style={{ padding: 12, background: '#ffffff', borderTop: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Input.TextArea
                            placeholder="Hỏi ERP4U Copilot bất cứ điều gì về ERP..."
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={loading}
                            autoSize={{ minRows: 1, maxRows: 4 }}
                            style={{ borderRadius: 8, resize: 'none' }}
                        />
                        <Button 
                            type={isListening ? "primary" : "default"} 
                            danger={isListening}
                            icon={<AudioOutlined />} 
                            onClick={toggleListen} 
                            disabled={loading} 
                            title="Nhập bằng giọng nói"
                            style={{ borderRadius: 8 }}
                        />
                        <Button 
                            type="primary" 
                            icon={<SendOutlined />} 
                            onClick={() => handleSend()} 
                            loading={loading}
                            style={{ borderRadius: 8, background: '#0284c7', borderColor: '#0284c7' }}
                        />
                    </div>
                </div>
            </Drawer>
        </>
    );
};

export default AiChatWidget;

