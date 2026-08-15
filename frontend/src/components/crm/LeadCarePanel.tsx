import React, { useEffect, useState } from 'react';
import { List, Avatar, Button, Input, message, Tag, Spin, Empty, Divider, Tooltip } from 'antd';
import { UserOutlined, RobotOutlined, SendOutlined, MessageOutlined, ShopOutlined } from '@ant-design/icons';
import api from '../../utils/api';
import dayjs from 'dayjs';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

interface LeadCarePanelProps {
    customerId: number;
    customerName: string;
}

const LeadCarePanel: React.FC<LeadCarePanelProps> = ({ customerId, customerName }) => {
    const [comments, setComments] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [text, setText] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [products, setProducts] = useState<any[]>([]);

    const fetchComments = async () => {
        if (!customerId) return;
        setLoading(true);
        try {
            const res = await api.get(`/customers/${customerId}/comments`);
            setComments(res.data);
        } catch (e) {
            setComments([]);
        }
        setLoading(false);
    };

    const fetchProducts = async () => {
        try {
            const res = await api.get(`/products?limit=20`);
            setProducts(res.data?.slice?.(0, 20) || []);
        } catch (e) { }
    };

    useEffect(() => {
        fetchComments();
        fetchProducts();
    }, [customerId]);

    const handleSend = async () => {
        const stripped = text.replace(/<[^>]+>/g, '').trim();
        if (!stripped) return message.warning('Nhập nội dung tin nhắn');

        try {
            await api.post(`/customers/${customerId}/comment`, {
                content: text,
                sender: 'STAFF',
                name: 'Nhân viên',
                comment_type: 'CUSTOMER'
            });
            setText('');
            fetchComments();
            message.success('Đã gửi');
        } catch (e) {
            message.error('Lỗi gửi tin nhắn');
        }
    };

    const handleAiSuggest = async () => {
        setAiLoading(true);
        try {
            const res = await api.post(`/ai/suggest-reply`, {
                customerId,
                customerName,
                chatHistory: comments.slice(0, 10),
                products: products.slice(0, 5)
            });
            if (res.data?.suggestion) {
                setText(res.data.suggestion);
                message.success('AI đã gợi ý nội dung!');
            }
        } catch (e) {
            message.error('Không thể gợi ý từ AI');
        }
        setAiLoading(false);
    };

    // Group comments by source
    const grouped: Record<string, any[]> = {};
    comments.forEach(c => {
        const key = c.source === 'SO' ? `Đơn #${c.order_code}` : 'Trao đổi trực tiếp';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(c);
    });

    return (
        <div>
            {/* AI Suggestion Button */}
            <div style={{ marginBottom: 16, display: 'flex', gap: 10 }}>
                <Button
                    icon={<RobotOutlined />}
                    onClick={handleAiSuggest}
                    loading={aiLoading}
                    type="primary"
                    ghost
                >
                    Gợi ý AI
                </Button>
                <span style={{ color: '#888', fontSize: 12, alignSelf: 'center' }}>
                    AI sẽ gợi ý câu trả lời dựa trên lịch sử chat và sản phẩm
                </span>
            </div>

            {/* Comments List */}
            <div style={{ maxHeight: 350, overflowY: 'auto', background: '#fafafa', padding: 12, borderRadius: 8, marginBottom: 16, border: '1px solid #eee' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
                ) : comments.length === 0 ? (
                    <Empty description="Chưa có trao đổi" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                    Object.entries(grouped).map(([source, items]) => (
                        <div key={source} style={{ marginBottom: 16 }}>
                            <Divider orientation="left" style={{ margin: '8px 0', fontSize: 12 }}>
                                {source.startsWith('Đơn') ? <><ShopOutlined /> {source}</> : <><MessageOutlined /> {source}</>}
                            </Divider>
                            <List
                                dataSource={items}
                                renderItem={(item: any) => (
                                    <List.Item style={{ padding: '8px 0', borderBottom: '1px dashed #eee' }}>
                                        <List.Item.Meta
                                            avatar={
                                                <Avatar
                                                    icon={<UserOutlined />}
                                                    style={{ backgroundColor: item.sender_type === 'STAFF' ? '#1890ff' : '#87d068' }}
                                                    size="small"
                                                />
                                            }
                                            title={
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontSize: 13 }}>
                                                        {item.sender_name}
                                                        <Tag color={item.sender_type === 'STAFF' ? 'blue' : 'green'} style={{ marginLeft: 6, fontSize: 10 }}>
                                                            {item.sender_type === 'STAFF' ? 'NV' : 'KH'}
                                                        </Tag>
                                                    </span>
                                                    <Tooltip title={dayjs(item.created_at).format('DD/MM/YYYY HH:mm')}>
                                                        <span style={{ fontSize: 11, color: '#999' }}>
                                                            {dayjs(item.created_at).format('DD/MM HH:mm')}
                                                        </span>
                                                    </Tooltip>
                                                </div>
                                            }
                                            description={
                                                <div style={{ color: '#333', fontSize: 13 }} dangerouslySetInnerHTML={{ __html: item.content }} />
                                            }
                                        />
                                    </List.Item>
                                )}
                            />
                        </div>
                    ))
                )}
            </div>

            {/* Reply Editor */}
            <div style={{ marginBottom: 10 }}>
                <ReactQuill
                    theme="snow"
                    value={text}
                    onChange={setText}
                    style={{ background: 'white', minHeight: 80 }}
                    modules={{
                        toolbar: [
                            ['bold', 'italic', 'underline'],
                            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                        ]
                    }}
                />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button type="primary" icon={<SendOutlined />} onClick={handleSend}>
                    Gửi
                </Button>
            </div>
        </div>
    );
};

export default LeadCarePanel;
