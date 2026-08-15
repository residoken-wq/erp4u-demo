import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Button, message, Spin, Tag, Space, Tooltip, Dropdown, MenuProps, Typography, Divider, Empty, Badge } from 'antd';
import {
    SaveOutlined,
    RobotOutlined,
    ThunderboltOutlined,
    CopyOutlined,
    ExportOutlined,
    FileTextOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    WarningOutlined,
    DollarOutlined,
    ShoppingCartOutlined,
    ToolOutlined,
    BulbOutlined,
    ReloadOutlined,
    FileAddOutlined,
    FireOutlined,
    ApartmentOutlined,
    ProfileOutlined
} from '@ant-design/icons';
import api from '../../utils/api';
import RichTextEditor from '../common/RichTextEditor';

const { Text, Title, Paragraph } = Typography;

interface CustomerPortrait360TabProps {
    customerId: number;
    customerName?: string;
}

// Helpers
const formatMoney = (amount: number): string => {
    return Number(amount || 0).toLocaleString('vi-VN');
};

const NOTE_TEMPLATES = {
    BUYING_BEHAVIOR: `<h3>🛒 1. Thói quen & Hành vi Đặt hàng</h3>
<ul>
  <li><strong>Người ra quyết định chính:</strong> [Tên / Chức danh / Số điện thoại]</li>
  <li><strong>Chu kỳ đặt hàng:</strong> [Định kỳ hàng tháng / Theo mùa khai giảng / Đột xuất khi thiếu]</li>
  <li><strong>Mức độ nhạy cảm về giá:</strong> [Ưu tiên giá rẻ / Ưu tiên chất lượng cao / Cần chiết khấu đại lý]</li>
  <li><strong>Yêu cầu xem mẫu:</strong> [Luôn cần mẫu duyệt trước / Chỉ cần ảnh chụp thực tế]</li>
</ul>`,
    PRODUCTION_STANDARDS: `<h3>🏭 2. Tiêu chuẩn Kỹ thuật & Gia công Sản xuất</h3>
<ul>
  <li><strong>Quy cách đặc thù:</strong> [Kích thước phi tiêu chuẩn, độ dày nệm, loại bông/foam]</li>
  <li><strong>Thêu / In Logo:</strong> [Vị trí thêu, màu chỉ, kích thước logo theo thương hiệu]</li>
  <li><strong>Bao bì & Nhãn mác:</strong> [Tem phụ tiếng Việt, túi PE dán decal riêng, thùng carton]</li>
  <li><strong>Mức độ kiểm tra QC:</strong> [Khách kiểm tra 100% khi nhận / Kiểm tra xác suất]</li>
</ul>`,
    DELIVERY_PAYMENT: `<h3>🚚 3. Quy định Giao nhận & Công nợ</h3>
<ul>
  <li><strong>Khung giờ nhận hàng:</strong> [8h00 - 11h30 hoặc 14h00 - 17h00 / Tránh giờ cao điểm]</li>
  <li><strong>Người ký biên bản bàn giao:</strong> [Thủ kho / Quản lý cơ sở]</li>
  <li><strong>Hóa đơn VAT (eInvoice):</strong> [Gửi email kế toán ngay sau khi giao hàng]</li>
  <li><strong>Thời hạn thanh toán:</strong> [Thanh toán 100% trước giao / Gối đầu 15 ngày kể từ ngày giao]</li>
</ul>`
};

export const CustomerPortrait360Tab: React.FC<CustomerPortrait360TabProps> = ({ customerId, customerName }) => {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [data, setData] = useState<any>(null);
    const [notes, setNotes] = useState<string>('');
    const [aiSummary, setAiSummary] = useState<string>('');
    const [aiGeneratedAt, setAiGeneratedAt] = useState<string | null>(null);
    const [lastSaved, setLastSaved] = useState<string | null>(null);

    // Fetch 360 data
    const fetch360Data = async () => {
        if (!customerId) return;
        setLoading(true);
        try {
            const res = await api.get(`/customers/${customerId}/portrait-360`);
            setData(res.data);
            if (res.data?.customer?.portrait_notes) {
                setNotes(res.data.customer.portrait_notes);
            }
        } catch (e) {
            message.error('Không thể tải dữ liệu chân dung 360°');
        }
        setLoading(false);
    };

    useEffect(() => {
        fetch360Data();
    }, [customerId]);

    // Save notes
    const handleSaveNotes = async () => {
        if (!customerId) return;
        setSaving(true);
        try {
            await api.put(`/customers/${customerId}/portrait-notes`, { notes });
            setLastSaved(new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
            message.success('Đã lưu ghi chú chân dung 360° thành công!');
        } catch (e) {
            message.error('Lỗi khi lưu ghi chú');
        }
        setSaving(false);
    };

    // AI Summarize
    const handleAiSummarize = async () => {
        if (!customerId) return;
        setAiLoading(true);
        try {
            const res = await api.post('/ai/customer-360-summary', { customerId });
            if (res.data?.summary) {
                setAiSummary(res.data.summary);
                setAiGeneratedAt(new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
                message.success('AI đã tổng hợp chân dung 360° thành công!');
            }
        } catch (e: any) {
            message.error(e.response?.data?.message || 'Không thể tổng hợp từ AI lúc này');
        }
        setAiLoading(false);
    };

    // Copy AI Summary to Clipboard
    const handleCopySummary = () => {
        if (!aiSummary) return;
        navigator.clipboard.writeText(aiSummary);
        message.success('Đã sao chép nội dung AI vào clipboard!');
    };

    // Insert AI insights into user notes
    const handleAppendToNotes = () => {
        if (!aiSummary) return;
        const formattedAiBlock = `
            <div style="background:#f6ffed; border:1px solid #b7eb8f; padding:12px; border-radius:6px; margin:12px 0;">
                <h4 style="color:#389e0d; margin-top:0;">🤖 Ghi chú trích xuất từ AI 360° (${aiGeneratedAt || 'Mới nhất'}):</h4>
                ${aiSummary.replace(/\n\n/g, '<br/>').replace(/\n/g, '<br/>')}
            </div>
        `;
        setNotes(prev => (prev ? prev + '<br/>' + formattedAiBlock : formattedAiBlock));
        message.success('Đã chèn nội dung AI vào phần Ghi chú bên trái!');
    };

    // Template menu items
    const templateMenuItems: MenuProps['items'] = [
        {
            key: '1',
            label: '🛒 Mẫu 1: Thói quen & Hành vi Đặt hàng',
            icon: <ShoppingCartOutlined style={{ color: '#1890ff' }} />,
            onClick: () => setNotes(prev => (prev ? prev + '<hr/>' + NOTE_TEMPLATES.BUYING_BEHAVIOR : NOTE_TEMPLATES.BUYING_BEHAVIOR))
        },
        {
            key: '2',
            label: '🏭 Mẫu 2: Tiêu chuẩn Kỹ thuật & Gia công SX',
            icon: <ToolOutlined style={{ color: '#722ed1' }} />,
            onClick: () => setNotes(prev => (prev ? prev + '<hr/>' + NOTE_TEMPLATES.PRODUCTION_STANDARDS : NOTE_TEMPLATES.PRODUCTION_STANDARDS))
        },
        {
            key: '3',
            label: '🚚 Mẫu 3: Quy định Giao nhận & Công nợ',
            icon: <DollarOutlined style={{ color: '#52c41a' }} />,
            onClick: () => setNotes(prev => (prev ? prev + '<hr/>' + NOTE_TEMPLATES.DELIVERY_PAYMENT : NOTE_TEMPLATES.DELIVERY_PAYMENT))
        },
        {
            type: 'divider'
        },
        {
            key: 'all',
            label: '📋 Chèn đầy đủ trọn bộ Mẫu 360°',
            icon: <FileAddOutlined style={{ color: '#fa8c16' }} />,
            onClick: () => {
                const fullTemplate = `${NOTE_TEMPLATES.BUYING_BEHAVIOR}<hr/>${NOTE_TEMPLATES.PRODUCTION_STANDARDS}<hr/>${NOTE_TEMPLATES.DELIVERY_PAYMENT}`;
                setNotes(prev => (prev ? prev + '<hr/>' + fullTemplate : fullTemplate));
            }
        }
    ];

    // Markdown inline formatter helper
    const renderMarkdownContent = (text: string) => {
        if (!text) return null;
        const lines = text.split('\n');

        return lines.map((line, idx) => {
            const trimmed = line.trim();
            if (!trimmed) return <div key={idx} style={{ height: 6 }} />;

            // Headings
            if (trimmed.startsWith('### ')) {
                const title = trimmed.replace('### ', '');
                return (
                    <div key={idx} style={{
                        marginTop: 14,
                        marginBottom: 8,
                        paddingBottom: 4,
                        borderBottom: '1px solid #e8e8e8',
                        fontWeight: 700,
                        fontSize: 14,
                        color: '#1d39c4',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                    }}>
                        {title}
                    </div>
                );
            }
            if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
                const title = trimmed.replace(/^#+\s*/, '');
                return (
                    <div key={idx} style={{
                        marginTop: 16,
                        marginBottom: 10,
                        fontWeight: 700,
                        fontSize: 15,
                        color: '#092b00',
                        background: '#f6ffed',
                        padding: '6px 10px',
                        borderRadius: 6,
                        borderLeft: '4px solid #52c41a'
                    }}>
                        {title}
                    </div>
                );
            }

            // Bullet points
            if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                const content = trimmed.slice(2);
                // Bold highlights
                const parts = content.split(/(\*\*.*?\*\*)/g);
                return (
                    <div key={idx} style={{ paddingLeft: 14, marginBottom: 5, position: 'relative', fontSize: 13, lineHeight: '1.6', color: '#262626' }}>
                        <span style={{ position: 'absolute', left: 2, top: 0, color: '#1890ff', fontWeight: 'bold' }}>•</span>
                        {parts.map((p, pIdx) => {
                            if (p.startsWith('**') && p.endsWith('**')) {
                                return <strong key={pIdx} style={{ color: '#1f1f1f' }}>{p.slice(2, -2)}</strong>;
                            }
                            return p;
                        })}
                    </div>
                );
            }

            // Normal text with bold parsing
            const parts = trimmed.split(/(\*\*.*?\*\*)/g);
            return (
                <p key={idx} style={{ marginBottom: 6, fontSize: 13, lineHeight: '1.6', color: '#333' }}>
                    {parts.map((p, pIdx) => {
                        if (p.startsWith('**') && p.endsWith('**')) {
                            return <strong key={pIdx}>{p.slice(2, -2)}</strong>;
                        }
                        return p;
                    })}
                </p>
            );
        });
    };

    const summary = data?.summary || {
        total_quotations: 0,
        total_quotations_amount: 0,
        total_orders: 0,
        total_revenue: 0,
        total_paid: 0,
        total_debt: 0,
        win_rate: 0,
        avg_order_value: 0,
        pfo_summary: { total: 0, in_production: 0, completed: 0, risk_count: 0 },
        top_products: []
    };

    return (
        <Spin spinning={loading} tip="Đang tải dữ liệu Chân dung 360°...">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* TOP QUICK KPI STATS BANNER */}
                <div style={{
                    background: 'linear-gradient(135deg, #f0f5ff 0%, #f9f0ff 50%, #fcffe6 100%)',
                    border: '1px solid #d6e4ff',
                    borderRadius: 10,
                    padding: '12px 18px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                }}>
                    <Row gutter={[16, 8]} align="middle">
                        <Col xs={24} sm={12} md={5}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ background: '#e6f7ff', padding: 8, borderRadius: 8, color: '#1890ff', fontSize: 18 }}>
                                    <FileTextOutlined />
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: '#8c8c8c' }}>Báo giá (BG)</div>
                                    <div style={{ fontWeight: 700, fontSize: 14, color: '#1890ff' }}>
                                        {summary.total_quotations} phiếu <span style={{ fontSize: 11, fontWeight: 'normal', color: '#595959' }}>({formatMoney(summary.total_quotations_amount)} đ)</span>
                                    </div>
                                </div>
                            </div>
                        </Col>

                        <Col xs={24} sm={12} md={5}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ background: '#f6ffed', padding: 8, borderRadius: 8, color: '#52c41a', fontSize: 18 }}>
                                    <ShoppingCartOutlined />
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: '#8c8c8c' }}>Đơn hàng (SO)</div>
                                    <div style={{ fontWeight: 700, fontSize: 14, color: '#389e0d' }}>
                                        {summary.total_orders} đơn <span style={{ fontSize: 11, fontWeight: 'normal', color: '#595959' }}>({formatMoney(summary.total_revenue)} đ)</span>
                                    </div>
                                </div>
                            </div>
                        </Col>

                        <Col xs={24} sm={12} md={5}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ background: '#f9f0ff', padding: 8, borderRadius: 8, color: '#722ed1', fontSize: 18 }}>
                                    <ToolOutlined />
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: '#8c8c8c' }}>Lệnh SX (PFO)</div>
                                    <div style={{ fontWeight: 700, fontSize: 14, color: '#722ed1' }}>
                                        {summary.pfo_summary?.total || 0} lệnh
                                        {summary.pfo_summary?.in_production > 0 && (
                                            <Tag color="processing" style={{ marginLeft: 4, fontSize: 10, padding: '0 4px' }}>
                                                {summary.pfo_summary.in_production} đang chạy
                                            </Tag>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Col>

                        <Col xs={24} sm={12} md={5}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ background: '#fff2e8', padding: 8, borderRadius: 8, color: '#fa541c', fontSize: 18 }}>
                                    <DollarOutlined />
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: '#8c8c8c' }}>Thu / Nợ</div>
                                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                                        <span style={{ color: '#52c41a' }}>{formatMoney(summary.total_paid)} đ</span>
                                        {summary.total_debt > 0 && (
                                            <span style={{ color: '#f5222d', marginLeft: 4, fontSize: 12 }}>
                                                (Nợ {formatMoney(summary.total_debt)} đ)
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Col>

                        <Col xs={24} sm={12} md={4}>
                            <div style={{ textAlign: 'right' }}>
                                <Tag color={summary.win_rate >= 50 ? 'green' : 'orange'} style={{ fontSize: 12, padding: '3px 8px', borderRadius: 12 }}>
                                    🎯 Chốt: {summary.win_rate}%
                                </Tag>
                            </div>
                        </Col>
                    </Row>
                </div>

                {/* 2 PARALLEL SECTIONS */}
                <Row gutter={16}>
                    {/* SECTION 1 (LEFT): GHI CHÚ CHÂN DUNG CKEDITOR (USER INPUT) */}
                    <Col xs={24} lg={12}>
                        <Card
                            size="small"
                            style={{
                                borderRadius: 10,
                                border: '1px solid #d9d9d9',
                                height: '100%',
                                display: 'flex',
                                flexDirection: 'column'
                            }}
                            bodyStyle={{ padding: 12, flex: 1, display: 'flex', flexDirection: 'column' }}
                            title={
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#1890ff' }}>
                                    <FileTextOutlined /> Ghi chú Chân dung Khách hàng (User Input)
                                </div>
                            }
                            extra={
                                <Space size={8}>
                                    <Dropdown menu={{ items: templateMenuItems }} placement="bottomRight">
                                        <Button size="small" icon={<ProfileOutlined />}>
                                            Mẫu ghi chú
                                        </Button>
                                    </Dropdown>
                                    <Button
                                        type="primary"
                                        size="small"
                                        icon={<SaveOutlined />}
                                        loading={saving}
                                        onClick={handleSaveNotes}
                                        style={{ background: '#1890ff', borderColor: '#1890ff' }}
                                    >
                                        Lưu ghi chú
                                    </Button>
                                </Space>
                            }
                        >
                            <div style={{ marginBottom: 8, fontSize: 11, color: '#8c8c8c', display: 'flex', justifyContent: 'space-between' }}>
                                <span>Nhập các lưu ý đặc thù về thói quen, quy cách may/in/thêu, thanh toán, giao nhận...</span>
                                {lastSaved && <span style={{ color: '#52c41a' }}>✓ Đã lưu lúc {lastSaved}</span>}
                            </div>

                            <div style={{ flex: 1, minHeight: 440 }}>
                                <RichTextEditor
                                    value={notes}
                                    onChange={setNotes}
                                    placeholder="Soạn thảo ghi chú chi tiết chân dung khách hàng..."
                                    minHeight={420}
                                />
                            </div>
                        </Card>
                    </Col>

                    {/* SECTION 2 (RIGHT): AI SUMMARIZE 360 (BG, SO, PFO) */}
                    <Col xs={24} lg={12}>
                        <Card
                            size="small"
                            style={{
                                borderRadius: 10,
                                border: '1px solid #d3adf7',
                                height: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                background: '#faf8ff'
                            }}
                            bodyStyle={{ padding: 12, flex: 1, display: 'flex', flexDirection: 'column' }}
                            title={
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#722ed1' }}>
                                    <RobotOutlined /> AI Summarize 360° (BG, SO, PFO Scope)
                                </div>
                            }
                            extra={
                                <Space size={6}>
                                    {aiSummary && (
                                        <>
                                            <Tooltip title="Sao chép toàn bộ bản tổng hợp AI">
                                                <Button size="small" icon={<CopyOutlined />} onClick={handleCopySummary}>
                                                    Sao chép
                                                </Button>
                                            </Tooltip>
                                            <Tooltip title="Chèn bản tóm tắt này vào khung Ghi chú bên trái">
                                                <Button size="small" icon={<ExportOutlined />} onClick={handleAppendToNotes}>
                                                    Chèn vào Ghi chú
                                                </Button>
                                            </Tooltip>
                                        </>
                                    )}
                                    <Button
                                        type="primary"
                                        size="small"
                                        icon={<ThunderboltOutlined />}
                                        loading={aiLoading}
                                        onClick={handleAiSummarize}
                                        style={{
                                            background: 'linear-gradient(135deg, #722ed1 0%, #9254de 100%)',
                                            borderColor: '#722ed1'
                                        }}
                                    >
                                        {aiSummary ? 'Tái tạo AI 360°' : '⚡ AI Phân tích 360°'}
                                    </Button>
                                </Space>
                            }
                        >
                            <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={{ fontSize: 11, color: '#722ed1' }}>
                                    ✨ Tự động tổng hợp và đánh giá thông minh từ tất cả Báo giá, Đơn hàng, Lệnh sản xuất và CRM.
                                </Text>
                                {aiGeneratedAt && (
                                    <Tag color="purple" style={{ fontSize: 10, marginRight: 0 }}>
                                        Cập nhật: {aiGeneratedAt}
                                    </Tag>
                                )}
                            </div>

                            <div style={{
                                flex: 1,
                                minHeight: 420,
                                maxHeight: 520,
                                overflowY: 'auto',
                                background: '#fff',
                                border: '1px solid #efdbff',
                                borderRadius: 8,
                                padding: '12px 16px'
                            }}>
                                {aiLoading ? (
                                    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                                        <Spin size="large" />
                                        <div style={{ marginTop: 16, color: '#722ed1', fontWeight: 600, fontSize: 14 }}>
                                            🤖 AI đang quét toàn bộ dữ liệu BG, SO, PFO & phân tích chân dung...
                                        </div>
                                        <div style={{ marginTop: 6, fontSize: 12, color: '#8c8c8c' }}>
                                            Vui lòng chờ trong giây lát để hệ thống tạo báo cáo 360° chuyên sâu.
                                        </div>
                                    </div>
                                ) : aiSummary ? (
                                    <div>
                                        {renderMarkdownContent(aiSummary)}
                                    </div>
                                ) : (
                                    <div style={{ textAlign: 'center', padding: '40px 10px' }}>
                                        <div style={{ fontSize: 40, color: '#9254de', marginBottom: 12 }}>
                                            <ThunderboltOutlined />
                                        </div>
                                        <Title level={5} style={{ color: '#531dab', marginBottom: 6 }}>
                                            Chưa có bản tổng hợp AI 360°
                                        </Title>
                                        <Paragraph style={{ color: '#595959', fontSize: 12, maxWidth: 360, margin: '0 auto 16px auto' }}>
                                            Nhấn nút <strong>"⚡ AI Phân tích 360°"</strong> ở góc phải để AI tổng hợp tự động hành vi mua sắm, hiệu quả báo giá, rủi ro sản xuất và gợi ý chiến lược chăm sóc khách hàng.
                                        </Paragraph>
                                        <Button
                                            type="primary"
                                            icon={<ThunderboltOutlined />}
                                            onClick={handleAiSummarize}
                                            style={{
                                                background: 'linear-gradient(135deg, #722ed1 0%, #9254de 100%)',
                                                borderColor: '#722ed1',
                                                borderRadius: 20,
                                                padding: '0 20px',
                                                height: 36
                                            }}
                                        >
                                            Phân tích Chân dung 360° ngay
                                        </Button>

                                        {/* FAST DATA PREVIEW CARDS */}
                                        <Divider style={{ margin: '20px 0 14px 0', fontSize: 11, color: '#bfbfbf' }}>Dữ liệu sẵn có trong hệ thống</Divider>
                                        <div style={{ textAlign: 'left', background: '#fafafa', padding: 10, borderRadius: 6, fontSize: 12, color: '#595959' }}>
                                            <div>📄 <strong>{summary.total_quotations}</strong> Báo giá đã tạo</div>
                                            <div>📦 <strong>{summary.total_orders}</strong> Đơn hàng SO đã chốt ({formatMoney(summary.total_revenue)} đ)</div>
                                            <div>🏭 <strong>{summary.pfo_summary?.total || 0}</strong> Lệnh sản xuất PFO</div>
                                            <div>💬 <strong>{data?.comments?.length || 0}</strong> Lượt trao đổi chăm sóc</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </Col>
                </Row>
            </div>
        </Spin>
    );
};

export default CustomerPortrait360Tab;
