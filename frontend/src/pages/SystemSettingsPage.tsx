import React, { useEffect, useState } from 'react';
import { 
    Card, Form, Input, InputNumber, Button, Switch, message, Spin, Row, Col, 
    Divider, Alert, Tabs, Table, Modal, Popconfirm, Tooltip, Tag, Space, 
    Typography, Checkbox, Upload, Badge, Radio 
} from 'antd';
import { 
    SaveOutlined, MailOutlined, ShopOutlined, FileTextOutlined, PlusOutlined, 
    EditOutlined, DeleteOutlined, CopyOutlined, SettingOutlined, MinusCircleOutlined, 
    InfoCircleOutlined, KeyOutlined, UploadOutlined, AuditOutlined, PrinterOutlined, 
    QrcodeOutlined, BgColorsOutlined, CheckCircleOutlined, ReloadOutlined, 
    SafetyCertificateOutlined, EyeOutlined, ProjectOutlined, DollarOutlined,
    GlobalOutlined, BankOutlined, PhoneOutlined, PictureOutlined, CarOutlined, ThunderboltOutlined,
    SendOutlined, MessageOutlined, RobotOutlined
} from '@ant-design/icons';
import api from '../utils/api';
import { SketchPicker } from 'react-color';
import { getVietQRBankCode } from '../utils/vietqr';
import ReactQuill from 'react-quill';
import { API_URL } from '../config';
import dayjs from 'dayjs';
import RichTextEditor from '../components/common/RichTextEditor';
import { DEFAULT_DELIVERY_NOTICE_TEMPLATES, PLACEHOLDER_GUIDE, DeliveryNoticeTemplate } from '../utils/deliveryNoticeHelper';
import { ZnsConfigTab } from '../components/settings/ZnsConfigTab';
import { ChatbotConfigTab } from '../components/system/ChatbotConfigTab';

const { Title, Text, Paragraph } = Typography;

const SystemSettingsPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState('company');

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 40 }}>
            {/* Top Page Header Banner */}
            <div 
                style={{ 
                    background: 'linear-gradient(135deg, #003a8c 0%, #0050b3 50%, #0958d9 100%)',
                    borderRadius: 16,
                    padding: '24px 32px',
                    marginBottom: 24,
                    color: '#fff',
                    boxShadow: '0 8px 24px rgba(0,80,179,0.18)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 16
                }}
            >
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <span style={{ fontSize: 28 }}>⚙️</span>
                        <h1 style={{ color: '#fff', margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>
                            Cài Đặt Hệ Thống & Quản Lý Mẫu In
                        </h1>
                    </div>
                    <p style={{ color: 'rgba(255,255,255,0.85)', margin: 0, fontSize: 13, maxWidth: 680, lineHeight: 1.5 }}>
                        Thiết lập thông tin thương hiệu doanh nghiệp, tùy biến giao diện in ấn & nhận diện thương hiệu cho Portal Báo Giá, mẫu Hợp đồng, Email thông báo và phân quyền API Bot.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Tag color="cyan" style={{ padding: '6px 12px', fontSize: 12, borderRadius: 20, border: 'none' }}>
                        <ShopOutlined /> Portal B2B Engine
                    </Tag>
                    <Tag color="green" style={{ padding: '6px 12px', fontSize: 12, borderRadius: 20, border: 'none' }}>
                        <PrinterOutlined /> 4 Mẫu In Chuẩn
                    </Tag>
                </div>
            </div>

            {/* Main Tabs Container */}
            <Card bordered={false} bodyStyle={{ padding: 0 }} style={{ borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                <Tabs 
                    activeKey={activeTab} 
                    onChange={setActiveTab} 
                    tabPosition="left" 
                    style={{ minHeight: 650 }}
                    tabBarStyle={{ width: 260, background: '#fafafa', borderRight: '1px solid #f0f0f0', padding: '12px 0' }}
                    items={[
                        {
                            key: 'company',
                            label: (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                                    <ShopOutlined style={{ fontSize: 16 }} />
                                    <span>Doanh Nghiệp & Ngân Hàng</span>
                                </div>
                            ),
                            children: <div style={{ padding: '24px 32px' }}><CompanyConfigTab /></div>
                        },
                        {
                            key: 'print_branding',
                            label: (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                                    <PrinterOutlined style={{ fontSize: 16 }} />
                                    <span>Mẫu In & Nhận Diện Portal</span>
                                </div>
                            ),
                            children: <div style={{ padding: '24px 32px' }}><PrintBrandingTab /></div>
                        },
                        {
                            key: 'contracts',
                            label: (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                                    <FileTextOutlined style={{ fontSize: 16 }} />
                                    <span>Mẫu Hợp Đồng</span>
                                </div>
                            ),
                            children: <div style={{ padding: '24px 32px' }}><ContractTemplatesTab /></div>
                        },
                        {
                            key: 'terms',
                            label: (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                                    <AuditOutlined style={{ fontSize: 16 }} />
                                    <span>Điều Khoản & Ghi Chú</span>
                                </div>
                            ),
                            children: <div style={{ padding: '24px 32px' }}><TermsAndNotesTab /></div>
                        },
                        {
                            key: 'delivery_notice',
                            label: (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                                    <SendOutlined style={{ fontSize: 16 }} />
                                    <span>Mẫu Thông Báo Giao Hàng</span>
                                </div>
                            ),
                            children: <div style={{ padding: '24px 32px' }}><DeliveryNoticeTemplatesTab /></div>
                        },
                        {
                            key: 'email',
                            label: (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                                    <MailOutlined style={{ fontSize: 16 }} />
                                    <span>Email (SMTP) & Mẫu Thư</span>
                                </div>
                            ),
                            children: <div style={{ padding: '24px 32px' }}><EmailSettingsTab /></div>
                        },
                        {
                            key: 'easyinvoice',
                            label: (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                                    <FileTextOutlined style={{ fontSize: 16 }} />
                                    <span>Xuất Hóa Đơn (EasyInvoice)</span>
                                </div>
                            ),
                            children: <div style={{ padding: '24px 32px' }}><EasyInvoiceConfigTab /></div>
                        },
                        {
                            key: 'shipping',
                            label: (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                                    <CarOutlined style={{ fontSize: 16 }} />
                                    <span>Vận Chuyển (GHTK & Lalamove)</span>
                                </div>
                            ),
                            children: <div style={{ padding: '24px 32px' }}><ShippingCarriersTab /></div>
                        },
                        {
                            key: 'zns',
                            label: (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                                    <MessageOutlined style={{ fontSize: 16, color: '#0068ff' }} />
                                    <span>Zalo ZNS (OA)</span>
                                </div>
                            ),
                            children: <div style={{ padding: '24px 32px' }}><ZnsConfigTab /></div>
                        },
                        {
                            key: 'operations',
                            label: (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                                    <ProjectOutlined style={{ fontSize: 16 }} />
                                    <span>Quy Trình & Dòng Tiền</span>
                                </div>
                            ),
                            children: <div style={{ padding: '24px 32px' }}><OperationsConfigTab /></div>
                        },
                        {
                            key: 'chatbot',
                            label: (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                                    <RobotOutlined style={{ fontSize: 16 }} />
                                    <span>Trợ lý AI website</span>
                                </div>
                            ),
                            children: <div style={{ padding: '24px 32px' }}><ChatbotConfigTab /></div>
                        },
                        {
                            key: 'api_keys',
                            label: (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                                    <KeyOutlined style={{ fontSize: 16 }} />
                                    <span>Tích Hợp API Keys</span>
                                </div>
                            ),
                            children: <div style={{ padding: '24px 32px' }}><ApiKeysTab /></div>
                        }
                    ]}
                />
            </Card>
        </div>
    );
};

// =========================================================================
// TAB 1: THÔNG TIN DOANH NGHIỆP & NGÂN HÀNG
// =========================================================================
const CompanyConfigTab: React.FC = () => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [bankValues, setBankValues] = useState<{ bank: string, account: string, holder: string }>({
        bank: 'ACB - TP.HCM',
        account: '141847859',
        holder: 'CTY TNHH TM DV TUONG LINH'
    });

    const fetchCompanyInfo = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/system/company`);
            form.setFieldsValue(res.data);
            if (res.data) {
                setBankValues({
                    bank: res.data.COMPANY_BANK_NAME || 'ACB - TP.HCM',
                    account: res.data.COMPANY_BANK_ACCOUNT || '141847859',
                    holder: res.data.COMPANY_BANK_HOLDER || 'CTY TNHH TM DV TUONG LINH'
                });
            }
        } catch (e) {
            message.error('Lỗi khi tải thông tin doanh nghiệp');
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchCompanyInfo();
    }, []);

    const onFinish = async (values: any) => {
        setSaving(true);
        try {
            await api.post(`/system/company`, values);
            message.success('Đã lưu thông tin doanh nghiệp thành công!');
            setBankValues({
                bank: values.COMPANY_BANK_NAME || '',
                account: values.COMPANY_BANK_ACCOUNT || '',
                holder: values.COMPANY_BANK_HOLDER || ''
            });
        } catch (e) {
            message.error('Lỗi khi lưu thông tin');
        }
        setSaving(false);
    };

    const rawBankCode = getVietQRBankCode(bankValues.bank);
    const qrTestUrl = bankValues.account 
        ? `https://img.vietqr.io/image/${rawBankCode}-${bankValues.account}-compact2.jpg?amount=100000&addInfo=TEST_PAYMENT&accountName=${encodeURIComponent(bankValues.holder)}`
        : '';

    if (loading) return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" tip="Đang tải dữ liệu..." /></div>;

    return (
        <div>
            <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#1a1a1a' }}>🏢 Hồ Sơ Doanh Nghiệp & Tài Khoản Ngân Hàng</h3>
                <p style={{ color: '#888', margin: 0, fontSize: 13 }}>
                    Thông tin này sẽ tự động xuất hiện trên tất cả các Báo giá, Xác nhận đơn hàng, Hợp đồng kinh tế và Mã VietQR thanh toán.
                </p>
            </div>

            <Form form={form} layout="vertical" onFinish={onFinish}>
                <Row gutter={24}>
                    <Col xs={24} lg={15}>
                        <Card title="Thông Tin Pháp Nhân Bên Bán" size="small" bordered style={{ marginBottom: 20, borderRadius: 8 }}>
                            <Row gutter={16}>
                                <Col span={24}>
                                    <Form.Item name="COMPANY_NAME" label="Tên Doanh Nghiệp (In trên hóa đơn & báo giá)" rules={[{ required: true, message: 'Nhập tên doanh nghiệp' }]}>
                                        <Input placeholder="VD: CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ TƯỜNG LINH" />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="COMPANY_TAX_CODE" label="Mã Số Thuế (MST)">
                                        <Input placeholder="VD: 0311874522" />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="COMPANY_REPRESENTATIVE" label="Người Đại Diện Pháp Luật">
                                        <Input placeholder="VD: Nguyễn Văn A" />
                                    </Form.Item>
                                </Col>
                                <Col span={24}>
                                    <Form.Item name="COMPANY_ADDRESS" label="Địa Chỉ Trụ Sở Chính">
                                        <Input.TextArea rows={2} placeholder="VD: 74/21/24 Nguyễn Khuyến, Phường 12, Quận Bình Thạnh, TP. Hồ Chí Minh" />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="COMPANY_PHONE" label="Hotline / Số Điện Thoại">
                                        <Input placeholder="VD: 0983.882210 - 0983.796654" />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="COMPANY_EMAIL" label="Email Liên Hệ / Nhận Đơn">
                                        <Input placeholder="VD: nemmanonerp4u@gmail.com" />
                                    </Form.Item>
                                </Col>
                                <Col span={24}>
                                    <Form.Item name="COMPANY_WEBSITE" label="Website Doanh Nghiệp">
                                        <Input placeholder="VD: https://erp4u.vn" />
                                    </Form.Item>
                                </Col>
                            </Row>
                        </Card>

                        <Card title="🏦 Tài Khoản Ngân Hàng Nhận Chuyển Khoản (VietQR)" size="small" bordered style={{ marginBottom: 20, borderRadius: 8 }}>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="COMPANY_BANK_NAME" label="Tên Ngân Hàng (Kèm Chi nhánh)">
                                        <Input 
                                            placeholder="VD: ACB - TP.HCM hoặc Vietcombank" 
                                            onChange={(e) => setBankValues(prev => ({ ...prev, bank: e.target.value }))}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="COMPANY_BANK_ACCOUNT" label="Số Tài Khoản">
                                        <Input 
                                            placeholder="VD: 141847859" 
                                            onChange={(e) => setBankValues(prev => ({ ...prev, account: e.target.value }))}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col span={24}>
                                    <Form.Item name="COMPANY_BANK_HOLDER" label="Tên Chủ Tài Khoản (In hoa không dấu)">
                                        <Input 
                                            placeholder="VD: CTY TNHH TM DV TUONG LINH" 
                                            onChange={(e) => setBankValues(prev => ({ ...prev, holder: e.target.value }))}
                                        />
                                    </Form.Item>
                                </Col>
                            </Row>
                        </Card>

                        <Button type="primary" htmlType="submit" icon={<SaveOutlined />} size="large" loading={saving} style={{ width: 220, borderRadius: 8 }}>
                            Lưu Thông Tin
                        </Button>
                    </Col>

                    <Col xs={24} lg={9}>
                        <Card 
                            title={<span><QrcodeOutlined /> Live Preview Mã Thanh Toán VietQR</span>} 
                            size="small" 
                            bordered 
                            style={{ borderRadius: 8, background: '#fcfdff', borderColor: '#d6e4ff' }}
                        >
                            <Alert
                                type="info"
                                showIcon
                                message="Tự Động Sinh Mã VietQR Chuẩn Napas247"
                                description="Khi khách hàng truy cập Portal Báo Giá hoặc in Đơn hàng, mã QR sẽ tự động điền số tiền cọc/thanh toán và mã đơn hàng vào nội dung chuyển khoản."
                                style={{ marginBottom: 16 }}
                            />

                            <div style={{ textAlign: 'center', padding: '16px 0' }}>
                                {qrTestUrl ? (
                                    <div>
                                        <img 
                                            src={qrTestUrl} 
                                            alt="VietQR Preview" 
                                            style={{ width: 200, height: 200, objectFit: 'contain', borderRadius: 8, border: '1px solid #eee', background: '#fff', padding: 6 }} 
                                        />
                                        <div style={{ marginTop: 12, fontSize: 12, color: '#666', lineHeight: 1.6 }}>
                                            <div><b>Ngân hàng:</b> {bankValues.bank || '-'}</div>
                                            <div><b>Số TK:</b> <span style={{ color: '#0050b3', fontWeight: 700 }}>{bankValues.account || '-'}</span></div>
                                            <div><b>Chủ TK:</b> {bankValues.holder || '-'}</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ color: '#999', padding: 30 }}>Chưa có thông tin tài khoản ngân hàng</div>
                                )}
                            </div>
                        </Card>
                    </Col>
                </Row>
            </Form>
        </div>
    );
};

// =========================================================================
// TAB 2: MẪU IN & NHẬN DIỆN PORTAL (PRINT BRANDING & TEMPLATES)
// =========================================================================
const PrintBrandingTab: React.FC = () => {
    const [bannerUrl, setBannerUrl] = useState('');
    const [stampUrl, setStampUrl] = useState('');
    const [watermarkUrl, setWatermarkUrl] = useState('');
    const [primaryColor, setPrimaryColor] = useState('#0050b3');
    const [footerNote, setFooterNote] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Preset color options
    const colorPresets = [
        { label: 'Xanh Navy ERP4U (Mặc định)', value: '#0050b3' },
        { label: 'Xanh Dương Hiện Đại', value: '#1677ff' },
        { label: 'Đỏ Đô Sang Trọng', value: '#a8071a' },
        { label: 'Xanh Lá Tươi Mới', value: '#135200' },
        { label: 'Cam ERP4U Năng Động', value: '#d46b08' },
        { label: 'Tím Hoàng Gia', value: '#531dab' },
        { label: 'Xám Đen Tối Giản', value: '#1f1f1f' }
    ];

    const fetchPrintConfigs = async () => {
        setLoading(true);
        try {
            const [bRes, sRes, wRes, cRes, fRes] = await Promise.all([
                api.get(`/system/config/PRINT_HEADER_BANNER`).catch(() => ({ data: null })),
                api.get(`/system/config/COMPANY_STAMP_IMAGE`).catch(() => ({ data: null })),
                api.get(`/system/config/PORTAL_WATERMARK_IMAGE`).catch(() => ({ data: null })),
                api.get(`/system/config/PRINT_PRIMARY_COLOR`).catch(() => ({ data: null })),
                api.get(`/system/config/PRINT_CUSTOM_NOTE_FOOTER`).catch(() => ({ data: null })),
            ]);

            if (bRes.data?.value) setBannerUrl(bRes.data.value);
            if (sRes.data?.value) setStampUrl(sRes.data.value);
            if (wRes.data?.value) setWatermarkUrl(wRes.data.value);
            if (cRes.data?.value) setPrimaryColor(cRes.data.value);
            if (fRes.data?.value) setFooterNote(fRes.data.value);
        } catch (e) {
            message.error('Lỗi tải cấu hình mẫu in');
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchPrintConfigs();
    }, []);

    const handleSaveGlobalPrintConfig = async () => {
        setSaving(true);
        try {
            await Promise.all([
                api.post(`/system/config`, {
                    key: 'PRINT_PRIMARY_COLOR',
                    value: primaryColor,
                    description: 'Màu chủ đạo cho bản in Báo giá & Đơn hàng'
                }),
                api.post(`/system/config`, {
                    key: 'PRINT_CUSTOM_NOTE_FOOTER',
                    value: footerNote,
                    description: 'Ghi chú chân trang bản in'
                })
            ]);
            message.success('Đã lưu cấu hình màu sắc & chân trang mẫu in!');
        } catch (e) {
            message.error('Lỗi khi lưu cấu hình');
        }
        setSaving(false);
    };

    const handleUploadImage = async (file: File, targetConfigKey: string, setLocalState: (url: string) => void) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('source', 'erp');

        const hide = message.loading('Đang tải file lên...', 0);
        try {
            const uploadRes = await api.post(`/upload/image`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const url = uploadRes.data?.url || uploadRes.data?.data?.url;
            if (url) {
                await api.post(`/system/config`, {
                    key: targetConfigKey,
                    value: url,
                    description: `Cấu hình ảnh ${targetConfigKey}`
                });
                setLocalState(url);
                message.success('Tải ảnh và lưu cấu hình thành công!');
            }
        } catch (e) {
            message.error('Lỗi khi upload ảnh');
        } finally {
            hide();
        }
    };

    const handleResetImage = async (targetConfigKey: string, setLocalState: (url: string) => void) => {
        try {
            await api.post(`/system/config`, {
                key: targetConfigKey,
                value: '',
                description: `Xóa cấu hình ảnh ${targetConfigKey}`
            });
            setLocalState('');
            message.success('Đã khôi phục về mặc định!');
        } catch (e) {
            message.error('Lỗi khi xóa cấu hình');
        }
    };

    const getFullImageUrl = (val: string) => {
        if (!val) return '';
        if (val.startsWith('http') || val.startsWith('data:')) return val;
        if (val.startsWith('/uploads/')) return `${API_URL}/upload/files/${val.replace('/uploads/', '')}`;
        return `${API_URL}${val}`;
    };

    if (loading) return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" tip="Đang tải dữ liệu..." /></div>;

    return (
        <div>
            <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#1a1a1a' }}>🖨️ Quản Lý Mẫu In & Nhận Diện Thương Hiệu Portal</h3>
                <p style={{ color: '#888', margin: 0, fontSize: 13 }}>
                    Upload banner header, con dấu chữ ký, watermark và tùy biến màu sắc áp dụng cho toàn bộ các mẫu in trong trang <b>Portal Báo Giá / Đơn Hàng</b>.
                </p>
            </div>

            <Row gutter={[24, 24]}>
                {/* 1. Header Banner Mẫu In */}
                <Col xs={24} lg={12}>
                    <Card 
                        title={<span style={{ fontWeight: 700 }}><PictureOutlined /> 1. Header Banner Mẫu In (Báo giá & Đơn hàng)</span>} 
                        bordered 
                        size="small"
                        style={{ height: '100%', borderRadius: 8 }}
                    >
                        <p style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
                            Ảnh banner hiển thị trên đầu bản in A4 và giao diện Portal Báo giá khách hàng.
                            <br />📐 <i>Kích thước khuyến nghị: <b>1200 x 240 px</b> (Tỷ lệ 5:1, nền trong suốt hoặc trắng).</i>
                        </p>

                        <div style={{ 
                            border: '1px dashed #d9d9d9', 
                            borderRadius: 8, 
                            padding: 12, 
                            background: '#fafafa', 
                            textAlign: 'center',
                            minHeight: 110,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 12
                        }}>
                            <img 
                                src={bannerUrl ? getFullImageUrl(bannerUrl) : `${window.location.origin}/b2b_header_banner.png`} 
                                alt="Header Banner" 
                                style={{ maxWidth: '100%', maxHeight: 90, objectFit: 'contain' }}
                                onError={(e: any) => { e.target.src = `${window.location.origin}/company_header.png`; }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
                            <Upload 
                                beforeUpload={(file) => { handleUploadImage(file, 'PRINT_HEADER_BANNER', setBannerUrl); return false; }} 
                                showUploadList={false} 
                                accept="image/*"
                            >
                                <Button icon={<UploadOutlined />} type="primary">Tải Banner Mới Lên</Button>
                            </Upload>
                            {bannerUrl && (
                                <Popconfirm title="Khôi phục về banner mặc định?" onConfirm={() => handleResetImage('PRINT_HEADER_BANNER', setBannerUrl)}>
                                    <Button danger type="text" icon={<ReloadOutlined />}>Dùng Mặc Định</Button>
                                </Popconfirm>
                            )}
                        </div>
                    </Card>
                </Col>

                {/* 2. Con Dấu & Chữ Ký */}
                <Col xs={24} lg={12}>
                    <Card 
                        title={<span style={{ fontWeight: 700 }}><SafetyCertificateOutlined /> 2. Con Dấu Tròn & Chữ Ký Doanh Nghiệp</span>} 
                        bordered 
                        size="small"
                        style={{ height: '100%', borderRadius: 8 }}
                    >
                        <p style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
                            Con dấu đỏ & chữ ký số tự động xuất hiện tại ô "Đại diện bên bán" trên bản in và Hợp đồng.
                            <br />📐 <i>Khuyến nghị: File ảnh <b>PNG trong suốt</b> (kích thước khoảng 400 x 300 px).</i>
                        </p>

                        <div style={{ 
                            border: '1px dashed #d9d9d9', 
                            borderRadius: 8, 
                            padding: 12, 
                            background: '#fafafa', 
                            textAlign: 'center',
                            minHeight: 110,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 12
                        }}>
                            {stampUrl ? (
                                <img 
                                    src={getFullImageUrl(stampUrl)} 
                                    alt="Company Stamp" 
                                    style={{ maxHeight: 90, maxWidth: 160, objectFit: 'contain' }}
                                />
                            ) : (
                                <div style={{ color: '#aaa', fontSize: 12 }}>Chưa tải con dấu / chữ ký (Để trống ô ký khi in)</div>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
                            <Upload 
                                beforeUpload={(file) => { handleUploadImage(file, 'COMPANY_STAMP_IMAGE', setStampUrl); return false; }} 
                                showUploadList={false} 
                                accept="image/png,image/jpeg,image/webp"
                            >
                                <Button icon={<UploadOutlined />} type="primary">Tải Con Dấu Lên</Button>
                            </Upload>
                            {stampUrl && (
                                <Popconfirm title="Xóa con dấu này?" onConfirm={() => handleResetImage('COMPANY_STAMP_IMAGE', setStampUrl)}>
                                    <Button danger type="text" icon={<DeleteOutlined />}>Xóa Ảnh</Button>
                                </Popconfirm>
                            )}
                        </div>
                    </Card>
                </Col>

                {/* 3. Watermark Bảo Mật */}
                <Col xs={24} lg={12}>
                    <Card 
                        title={<span style={{ fontWeight: 700 }}><SafetyCertificateOutlined /> 3. Watermark Chống Sao Chép (Portal Báo Giá)</span>} 
                        bordered 
                        size="small"
                        style={{ height: '100%', borderRadius: 8 }}
                    >
                        <p style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
                            Hình ảnh / Logo mờ bảo mật hiển thị lặp lại trên nền Portal Báo giá khách hàng.
                            <br />📐 <i>Khuyến nghị: Logo dạng <b>PNG mờ nhẹ</b> (kích thước 200 x 200 px).</i>
                        </p>

                        <div style={{ 
                            border: '1px dashed #d9d9d9', 
                            borderRadius: 8, 
                            padding: 12, 
                            background: '#fafafa', 
                            textAlign: 'center',
                            minHeight: 110,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 12
                        }}>
                            {watermarkUrl ? (
                                <img 
                                    src={getFullImageUrl(watermarkUrl)} 
                                    alt="Watermark" 
                                    style={{ maxHeight: 80, maxWidth: 120, objectFit: 'contain', opacity: 0.7 }}
                                />
                            ) : (
                                <div style={{ color: '#aaa', fontSize: 12 }}>Đang dùng watermark mặc định chữ "ERP4U"</div>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
                            <Upload 
                                beforeUpload={(file) => { handleUploadImage(file, 'PORTAL_WATERMARK_IMAGE', setWatermarkUrl); return false; }} 
                                showUploadList={false} 
                                accept="image/*"
                            >
                                <Button icon={<UploadOutlined />} type="primary">Tải Logo Watermark</Button>
                            </Upload>
                            {watermarkUrl && (
                                <Popconfirm title="Xóa watermark tùy chỉnh?" onConfirm={() => handleResetImage('PORTAL_WATERMARK_IMAGE', setWatermarkUrl)}>
                                    <Button danger type="text" icon={<ReloadOutlined />}>Dùng Mặc Định</Button>
                                </Popconfirm>
                            )}
                        </div>
                    </Card>
                </Col>

                {/* 4. Tùy Chọn Màu Sắc & Chân Trang Bản In */}
                <Col xs={24} lg={12}>
                    <Card 
                        title={<span style={{ fontWeight: 700 }}><BgColorsOutlined /> 4. Màu Sắc Chủ Đạo & Ghi Chú Bản In</span>} 
                        bordered 
                        size="small"
                        style={{ height: '100%', borderRadius: 8 }}
                    >
                        <div style={{ marginBottom: 14 }}>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                                Màu Sắc Nhận Diện Thương Hiệu Trên Bản In:
                            </label>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                                {colorPresets.map(c => (
                                    <Tag 
                                        key={c.value} 
                                        color={primaryColor === c.value ? 'blue' : 'default'}
                                        style={{ 
                                            cursor: 'pointer', 
                                            padding: '4px 10px', 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: 6,
                                            borderColor: primaryColor === c.value ? '#1890ff' : '#d9d9d9',
                                            fontWeight: primaryColor === c.value ? 700 : 400
                                        }}
                                        onClick={() => setPrimaryColor(c.value)}
                                    >
                                        <span style={{ width: 12, height: 12, borderRadius: '50%', background: c.value, display: 'inline-block' }} />
                                        {c.label}
                                    </Tag>
                                ))}
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <span style={{ fontSize: 12, color: '#888' }}>Mã màu tùy chọn:</span>
                                <Input 
                                    value={primaryColor} 
                                    onChange={e => setPrimaryColor(e.target.value)} 
                                    style={{ width: 120, fontFamily: 'monospace' }} 
                                />
                                <div style={{ width: 28, height: 28, borderRadius: 4, background: primaryColor, border: '1px solid #ccc' }} />
                            </div>
                        </div>

                        <Divider style={{ margin: '12px 0' }} />

                        <div style={{ marginBottom: 14 }}>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                                Ghi Chú Chân Trang Bản In (Footer Note):
                            </label>
                            <Input 
                                value={footerNote} 
                                onChange={e => setFooterNote(e.target.value)} 
                                placeholder="VD: ERP4U - Hệ thống quản lý bán hàng và xưởng sản xuất may mặc" 
                            />
                        </div>

                        <Button 
                            type="primary" 
                            icon={<SaveOutlined />} 
                            loading={saving} 
                            onClick={handleSaveGlobalPrintConfig}
                            block
                        >
                            Lưu Màu Sắc & Chân Trang
                        </Button>
                    </Card>
                </Col>
            </Row>

            {/* 5. CÁC MẪU IN PORTAL ĐƯỢC TÍCH HỢP */}
            <Divider style={{ margin: '32px 0 24px 0' }} orientation="left">
                <span style={{ fontSize: 15, fontWeight: 700, color: '#0050b3' }}>
                    📑 Danh Sách 4 Mẫu In Chuẩn Trong Portal Báo Giá / Đơn Hàng
                </span>
            </Divider>

            <Row gutter={[16, 16]}>
                {[
                    {
                        title: '1. Mẫu Công Ty B2B (Standard A4)',
                        badge: 'Mặc định',
                        badgeColor: 'blue',
                        desc: 'Mẫu in A4 đầy đủ thông tin pháp lý bên bán & mua, bảng chi tiết sản phẩm kèm ảnh, giá sỉ bậc thang, tổng tiền, thuế VAT, tài khoản VietQR và 2 chữ ký.',
                        icon: '🏢'
                    },
                    {
                        title: '2. Mẫu B2B Không Tổng Tiền (No Total)',
                        badge: 'Xưởng SX / Bàn giao',
                        badgeColor: 'orange',
                        desc: 'Mẫu in A4 lược bỏ hoàn toàn phần đơn giá và tổng số tiền thanh toán. Phù hợp bàn giao nội bộ xưởng may, kiểm đếm hàng hoặc gửi thợ gia công.',
                        icon: '📋'
                    },
                    {
                        title: '3. Mẫu Khách Lẻ Rút Gọn (Retail A4)',
                        badge: 'Khách Lẻ',
                        badgeColor: 'green',
                        desc: 'Lược bỏ khung thông tin pháp nhân phức tạp, tập trung thể hiện danh sách sản phẩm, địa chỉ giao hàng và mã quét thanh toán nhanh chóng.',
                        icon: '🛍️'
                    },
                    {
                        title: '4. Mẫu Hóa Đơn Nhiệt POS (80mm)',
                        badge: 'Bill POS',
                        badgeColor: 'purple',
                        desc: 'Mẫu bill dạng dọc in trực tiếp ra các dòng máy in nhiệt POS 80mm tại quầy bán lẻ, showroom trưng bày hoặc dán ngoài kiện hàng.',
                        icon: '📠'
                    }
                ].map(item => (
                    <Col xs={24} sm={12} lg={6} key={item.title}>
                        <Card 
                            size="small" 
                            bordered 
                            style={{ height: '100%', borderRadius: 8, background: '#fafafa', border: '1px solid #e8e8e8' }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <span style={{ fontSize: 22 }}>{item.icon}</span>
                                <Tag color={item.badgeColor}>{item.badge}</Tag>
                            </div>
                            <h4 style={{ margin: '0 0 6px 0', fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>{item.title}</h4>
                            <p style={{ margin: 0, fontSize: 12, color: '#666', lineHeight: 1.5 }}>{item.desc}</p>
                        </Card>
                    </Col>
                ))}
            </Row>
        </div>
    );
};

// =========================================================================
// TAB 3: MẪU HỢP ĐỒNG (CONTRACT TEMPLATES)
// =========================================================================
const ContractTemplatesTab: React.FC = () => {
    const [templates, setTemplates] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<any>(null);
    const [form] = Form.useForm();

    const [customPlaceholders, setCustomPlaceholders] = useState<{key: string, desc: string}[]>([]);
    const [placeholderModalOpen, setPlaceholderModalOpen] = useState(false);
    const [placeholderForm] = Form.useForm();

    const fetchPlaceholders = async () => {
        try {
            const res = await api.get(`/system/config/CONTRACT_CUSTOM_PLACEHOLDERS`);
            if (res.data && res.data.value) {
                const parsed = JSON.parse(res.data.value);
                setCustomPlaceholders(parsed);
                placeholderForm.setFieldsValue({ placeholders: parsed });
            }
        } catch (e) { }
    };

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/system/templates`);
            setTemplates(res.data);
        } catch (e) { message.error('Lỗi tải danh sách mẫu'); }
        setLoading(false);
    };

    useEffect(() => { 
        fetchTemplates(); 
        fetchPlaceholders();
    }, []);

    const handleSavePlaceholders = async (values: any) => {
        try {
            await api.post(`/system/config`, {
                key: 'CONTRACT_CUSTOM_PLACEHOLDERS',
                value: JSON.stringify(values.placeholders || []),
                description: 'Danh sách Placeholder Hợp đồng tự tạo'
            });
            message.success('Đã lưu danh sách Placeholder');
            setPlaceholderModalOpen(false);
            fetchPlaceholders();
        } catch (e) {
            message.error('Lỗi khi lưu Placeholder');
        }
    };

    const handleSave = async (values: any) => {
        try {
            await api.post(`/system/templates`, { ...values, id: editingTemplate?.id });
            message.success('Đã lưu mẫu hợp đồng');
            setModalOpen(false);
            fetchTemplates();
        } catch (e) { message.error('Lỗi lưu mẫu'); }
    };

    const handleDelete = async (id: number) => {
        try {
            await api.delete(`/system/templates/${id}`);
            message.success('Đã xóa mẫu');
            fetchTemplates();
        } catch (e) { message.error('Lỗi xóa mẫu'); }
    };

    const columns = [
        { title: 'Tên Mẫu Hợp Đồng', dataIndex: 'name', key: 'name', width: '35%', render: (t: string) => <b>{t}</b> },
        { title: 'Cập nhật lần cuối', dataIndex: 'updated_at', key: 'updated_at', render: (t: string) => dayjs(t).format('DD/MM/YYYY HH:mm') },
        {
            title: 'Hành động', key: 'action', width: 150, render: (_: any, r: any) => (
                <div style={{ display: 'flex', gap: 8 }}>
                    <Button icon={<EditOutlined />} size="small" onClick={() => { setEditingTemplate(r); form.setFieldsValue(r); setModalOpen(true); }}>Sửa</Button>
                    <Popconfirm title="Xóa mẫu này?" onConfirm={() => handleDelete(r.id)}>
                        <Button icon={<DeleteOutlined />} danger size="small">Xóa</Button>
                    </Popconfirm>
                </div>
            )
        }
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>📜 Danh Sách Mẫu Hợp Đồng Kinh Tế</h3>
                    <p style={{ color: '#888', margin: 0, fontSize: 13 }}>Soạn thảo và quản lý các biểu mẫu Hợp đồng nguyên tắc, Hợp đồng gia công, Đơn hàng B2B.</p>
                </div>
                <Space>
                    <Button icon={<SettingOutlined />} onClick={() => setPlaceholderModalOpen(true)}>Cấu Hình Nhãn (Placeholders)</Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingTemplate(null); form.resetFields(); setModalOpen(true); }}>Tạo Mẫu Mới</Button>
                </Space>
            </div>

            <Table dataSource={templates} columns={columns} rowKey="id" loading={loading} pagination={false} size="small" />

            <Modal
                title={editingTemplate ? "Chỉnh Sửa Mẫu Hợp Đồng" : "Tạo Mẫu Mới"}
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                onOk={form.submit}
                width={1200}
                style={{ top: 20 }}
                maskClosable={false}
            >
                <Row gutter={24}>
                    <Col span={17}>
                        <Form form={form} layout="vertical" onFinish={handleSave}>
                            <Form.Item name="name" label={<span style={{fontWeight: 600}}>Tên mẫu hợp đồng</span>} rules={[{ required: true, message: 'Nhập tên mẫu' }]}>
                                <Input placeholder="VD: Hợp đồng nguyên tắc may mặc 2026" size="large" />
                            </Form.Item>
                            <Form.Item name="content" label={<span style={{fontWeight: 600}}>Nội dung hợp đồng (Trình soạn thảo HTML trực quan)</span>} rules={[{ required: true }]}>
                                <RichTextEditor minHeight={500} />
                            </Form.Item>
                        </Form>
                    </Col>
                    <Col span={7}>
                        <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, height: '100%' }}>
                            <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Danh Sách Placeholder</div>
                            <p style={{ fontSize: 12, color: '#666', marginBottom: 16, lineHeight: 1.4 }}>
                                Click để copy biến và DÁN (<code>Ctrl+V</code>) vào vị trí cần thiết.
                            </p>
                            <div style={{ maxHeight: 520, overflowY: 'auto', paddingRight: 4 }}>
                                <Space size={[8, 12]} wrap direction="vertical" style={{ width: '100%' }}>
                                    <div style={{ fontWeight: 600, fontSize: 11, color: '#999', textTransform: 'uppercase' }}>🔹 Khách hàng & Đơn hàng</div>
                                    {[
                                        { key: 'customer_name', desc: 'Tên Khách hàng' },
                                        { key: 'customer_address', desc: 'Địa chỉ Khách hàng' },
                                        { key: 'customer_tax_code', desc: 'Mã số thuế Khách hàng' },
                                        { key: 'customer_legal_name', desc: 'Tên pháp nhân (Hóa đơn)' },
                                        { key: 'customer_legal_address', desc: 'Địa chỉ pháp lý' },
                                        { key: 'customer_legal_representative', desc: 'Người đại diện pháp luật' },
                                        { key: 'customer_einvoice_email', desc: 'Email nhận hóa đơn điện tử' },
                                        { key: 'order_code', desc: 'Mã Đơn hàng (Của PM)' },
                                        { key: 'contract_code', desc: 'Mã số Hợp đồng tự động' },
                                        { key: 'order_date', desc: 'Ngày tạo đơn' },
                                        { key: 'total_amount_text', desc: 'Tổng tiền bằng chữ' },
                                        { key: 'items_table', desc: 'Bảng chi tiết mặt hàng' }
                                    ].map(p => (
                                        <div key={p.key} style={{ display: 'flex', flexDirection: 'column' }}>
                                            <Tag color="blue" style={{ cursor: 'pointer', padding: '4px 8px', fontSize: 12, width: 'fit-content' }} onClick={() => {
                                                navigator.clipboard.writeText(`{{${p.key}}}`);
                                                message.success(`Đã copy: {{${p.key}}}`);
                                            }}>
                                                <Space size={4}><CopyOutlined style={{ opacity: 0.6 }} />{`{{${p.key}}}`}</Space>
                                            </Tag>
                                            <span style={{ fontSize: 11, color: '#888', marginTop: 2, marginLeft: 4 }}>{p.desc}</span>
                                        </div>
                                    ))}

                                    <Divider style={{ margin: '8px 0' }} orientation="left" plain><span style={{fontSize: 11, color: '#aaa'}}>🔸 Bên Bán</span></Divider>
                                    {[
                                        { key: 'seller_company_name', desc: 'Tên công ty' },
                                        { key: 'seller_address', desc: 'Địa chỉ' },
                                        { key: 'seller_phone', desc: 'Số điện thoại' },
                                        { key: 'seller_email', desc: 'Email' },
                                        { key: 'seller_website', desc: 'Website' },
                                        { key: 'seller_tax_code', desc: 'Mã số thuế' },
                                        { key: 'seller_representative', desc: 'Người đại diện' },
                                        { key: 'seller_bank_name', desc: 'Ngân hàng' },
                                        { key: 'seller_bank_account', desc: 'Số tài khoản' },
                                        { key: 'seller_bank_holder', desc: 'Chủ tài khoản' },
                                    ].map(p => (
                                        <div key={p.key} style={{ display: 'flex', flexDirection: 'column' }}>
                                            <Tag color="orange" style={{ cursor: 'pointer', padding: '4px 8px', fontSize: 12, width: 'fit-content' }} onClick={() => {
                                                navigator.clipboard.writeText(`{{${p.key}}}`);
                                                message.success(`Đã copy: {{${p.key}}}`);
                                            }}>
                                                <Space size={4}><CopyOutlined style={{ opacity: 0.6 }} />{`{{${p.key}}}`}</Space>
                                            </Tag>
                                            <span style={{ fontSize: 11, color: '#888', marginTop: 2, marginLeft: 4 }}>{p.desc}</span>
                                        </div>
                                    ))}
                                </Space>
                            </div>
                        </div>
                    </Col>
                </Row>
            </Modal>

            {/* Placeholder Config Modal */}
            <Modal
                title="Cấu Hình Danh Sách Nhãn (Placeholders)"
                open={placeholderModalOpen}
                onCancel={() => setPlaceholderModalOpen(false)}
                onOk={placeholderForm.submit}
                width={600}
                destroyOnClose
            >
                <Form form={placeholderForm} layout="vertical" onFinish={handleSavePlaceholders}>
                    <Form.List name="placeholders">
                        {(fields, { add, remove }) => (
                            <>
                                {fields.map(({ key, name, ...restField }) => (
                                    <Row key={key} gutter={8} align="middle" style={{ marginBottom: 8 }}>
                                        <Col flex="180px">
                                            <Form.Item
                                                {...restField}
                                                name={[name, 'key']}
                                                rules={[{ required: true, message: 'Nhập key' }]}
                                                style={{ marginBottom: 0 }}
                                            >
                                                <Input addonBefore="{{" addonAfter="}}" placeholder="chi_nhanh" />
                                            </Form.Item>
                                        </Col>
                                        <Col flex="auto">
                                            <Form.Item
                                                {...restField}
                                                name={[name, 'desc']}
                                                rules={[{ required: true, message: 'Nhập ghi chú' }]}
                                                style={{ marginBottom: 0 }}
                                            >
                                                <Input placeholder="Chi nhánh văn phòng" />
                                            </Form.Item>
                                        </Col>
                                        <Col>
                                            <MinusCircleOutlined onClick={() => remove(name)} style={{ color: '#ff4d4f', fontSize: 16 }} />
                                        </Col>
                                    </Row>
                                ))}
                                <Form.Item style={{ marginTop: 16 }}>
                                    <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                                        Thêm Placeholder tùy chỉnh
                                    </Button>
                                </Form.Item>
                            </>
                        )}
                    </Form.List>
                </Form>
            </Modal>
        </div>
    );
};

// =========================================================================
// TAB 4: ĐIỀU KHOẢN & GHI CHÚ (TERMS & NOTES)
// =========================================================================
const TermsAndNotesTab: React.FC = () => {
    return (
        <div>
            <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>📋 Quản Lý Điều Khoản & Ghi Chú Mặc Định</h3>
                <p style={{ color: '#888', margin: 0, fontSize: 13 }}>
                    Cấu hình các mẫu điều khoản thanh toán, giao hàng và ghi chú mặc định khi tạo mới Báo Giá hoặc Đơn Hàng.
                </p>
            </div>

            <Tabs 
                defaultActiveKey="quote_terms"
                type="card"
                items={[
                    {
                        key: 'quote_terms',
                        label: '📝 Điều Khoản Báo Giá (Quotes)',
                        children: <QuoteTermsSubTab />
                    },
                    {
                        key: 'order_terms',
                        label: '📦 Điều Khoản Đơn Hàng (Orders)',
                        children: <OrderTermsSubTab />
                    },
                    {
                        key: 'delivery_notice_terms',
                        label: '🚚 Mẫu Thông Báo Giao Hàng',
                        children: <DeliveryNoticeTemplatesTab />
                    }
                ]}
            />
        </div>
    );
};

const QuoteTermsSubTab: React.FC = () => {
    const [termsList, setTermsList] = useState<{id: string, name: string, content: string, isDefault: boolean}[]>([]);
    const [defaultNote, setDefaultNote] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    
    const [modalOpen, setModalOpen] = useState(false);
    const [editingTerm, setEditingTerm] = useState<any>(null);
    const [form] = Form.useForm();

    useEffect(() => {
        setLoading(true);
        Promise.all([
            api.get(`/system/config/QUOTE_TERMS_LIST`).catch(() => ({ data: null })),
            api.get(`/system/config/QUOTE_DEFAULT_TERMS`).catch(() => ({ data: null })),
            api.get(`/system/config/QUOTE_DEFAULT_NOTE`).catch(() => ({ data: null })),
        ]).then(([listRes, termsRes, noteRes]) => {
            let list = [];
            if (listRes.data?.value) {
                try { list = JSON.parse(listRes.data.value); } catch(e) {}
            }
            if (list.length === 0 && termsRes.data?.value) {
                list = [{ id: 'default', name: 'Điều khoản mặc định', content: termsRes.data.value, isDefault: true }];
            }
            setTermsList(list);
            if (noteRes.data?.value) setDefaultNote(noteRes.data.value);
        }).finally(() => setLoading(false));
    }, []);

    const handleSaveConfig = async () => {
        setSaving(true);
        try {
            await Promise.all([
                api.post(`/system/config`, {
                    key: 'QUOTE_TERMS_LIST',
                    value: JSON.stringify(termsList),
                    description: 'Danh sách Điều khoản & Quy định cho Báo giá'
                }),
                api.post(`/system/config`, {
                    key: 'QUOTE_DEFAULT_NOTE',
                    value: defaultNote,
                    description: 'Ghi chú mặc định cho Báo giá'
                })
            ]);
            message.success('Đã lưu cấu hình Terms Báo giá!');
        } catch (e) {
            message.error('Lỗi khi lưu');
        }
        setSaving(false);
    };

    const handleSaveTerm = (values: any) => {
        let newList = [...termsList];
        if (values.isDefault) {
            newList = newList.map(t => ({ ...t, isDefault: false }));
        }
        if (editingTerm) {
            newList = newList.map(t => t.id === editingTerm.id ? { ...t, ...values } : t);
        } else {
            newList.push({ id: Date.now().toString(), ...values });
        }
        if (newList.length === 1) newList[0].isDefault = true;
        setTermsList(newList);
        setModalOpen(false);
    };

    const handleDeleteTerm = (id: string) => {
        setTermsList(termsList.filter(t => t.id !== id));
    };

    if (loading) return <Spin />;

    const columns = [
        { title: 'Tên Mẫu Điều Khoản', dataIndex: 'name', key: 'name', width: '30%', render: (t: string, r: any) => <b>{t} {r.isDefault && <Tag color="blue" style={{ marginLeft: 8 }}>Mặc định</Tag>}</b> },
        { title: 'Nội dung', dataIndex: 'content', key: 'content', render: (t: string) => <div style={{ whiteSpace: 'pre-line', fontSize: 13, maxHeight: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t}</div> },
        {
            title: 'Hành động', key: 'action', width: 120, render: (_: any, r: any) => (
                <Space>
                    <Button icon={<EditOutlined />} size="small" onClick={() => { setEditingTerm(r); form.setFieldsValue(r); setModalOpen(true); }} />
                    <Popconfirm title="Xóa mẫu này?" onConfirm={() => handleDeleteTerm(r.id)}>
                        <Button icon={<DeleteOutlined />} danger size="small" />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <div style={{ paddingTop: 8 }}>
            <Card title="📝 Ghi chú mặc định (Note)" bordered={false} size="small" style={{ marginBottom: 16, background: '#fafafa' }}>
                <div style={{ marginBottom: 8, fontSize: 12, color: '#888' }}>
                    Nội dung này sẽ hiển thị trong phần "Ghi chú từ người bán" trên Portal và bản in Báo giá.
                </div>
                <Input.TextArea
                    rows={3}
                    value={defaultNote}
                    onChange={e => setDefaultNote(e.target.value)}
                    placeholder="VD: Báo giá có hiệu lực trong 7 ngày kể từ ngày gửi. Giá chưa bao gồm VAT và phí vận chuyển."
                    style={{ fontSize: 13 }}
                />
            </Card>

            <Card 
                title="📋 Danh sách Điều khoản Báo Giá" 
                bordered={false} 
                size="small" 
                style={{ marginBottom: 16, background: '#fafafa' }}
                extra={<Button type="primary" icon={<PlusOutlined />} size="small" onClick={() => { setEditingTerm(null); form.resetFields(); form.setFieldsValue({ isDefault: termsList.length === 0 }); setModalOpen(true); }}>Thêm Mẫu</Button>}
            >
                <Table dataSource={termsList} columns={columns} rowKey="id" pagination={false} size="small" />
            </Card>

            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSaveConfig} size="large">
                Lưu Cấu Hình Terms Báo Giá
            </Button>

            <Modal
                title={editingTerm ? "Chỉnh sửa Mẫu Điều Khoản" : "Thêm Mẫu Điều Khoản"}
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                onOk={form.submit}
                width={700}
                destroyOnClose
            >
                <Form form={form} layout="vertical" onFinish={handleSaveTerm}>
                    <Form.Item name="name" label="Tên Mẫu" rules={[{ required: true }]}>
                        <Input placeholder="VD: Điều khoản Standard" />
                    </Form.Item>
                    <Form.Item name="content" label="Nội dung Điều khoản & Quy định" rules={[{ required: true }]}>
                        <Input.TextArea rows={8} placeholder={`VD:\n1. Thời gian giao hàng: 15-20 ngày...\n2. Thanh toán: Đặt cọc 50%...`} />
                    </Form.Item>
                    <Form.Item name="isDefault" valuePropName="checked">
                        <Checkbox>Đặt làm Mẫu Mặc định</Checkbox>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

const OrderTermsSubTab: React.FC = () => {
    const [termsList, setTermsList] = useState<{id: string, name: string, content: string, isDefault: boolean}[]>([]);
    const [defaultNote, setDefaultNote] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    
    const [modalOpen, setModalOpen] = useState(false);
    const [editingTerm, setEditingTerm] = useState<any>(null);
    const [form] = Form.useForm();

    useEffect(() => {
        setLoading(true);
        Promise.all([
            api.get(`/system/config/ORDER_TERMS_LIST`).catch(() => ({ data: null })),
            api.get(`/system/config/ORDER_DEFAULT_TERMS`).catch(() => ({ data: null })),
            api.get(`/system/config/ORDER_DEFAULT_NOTE`).catch(() => ({ data: null })),
        ]).then(([listRes, termsRes, noteRes]) => {
            let list = [];
            if (listRes.data?.value) {
                try { list = JSON.parse(listRes.data.value); } catch(e) {}
            }
            if (list.length === 0 && termsRes.data?.value) {
                list = [{ id: 'default', name: 'Điều khoản mặc định', content: termsRes.data.value, isDefault: true }];
            }
            setTermsList(list);
            if (noteRes.data?.value) setDefaultNote(noteRes.data.value);
        }).finally(() => setLoading(false));
    }, []);

    const handleSaveConfig = async () => {
        setSaving(true);
        try {
            await Promise.all([
                api.post(`/system/config`, {
                    key: 'ORDER_TERMS_LIST',
                    value: JSON.stringify(termsList),
                    description: 'Danh sách Điều khoản & Quy định cho Đơn hàng'
                }),
                api.post(`/system/config`, {
                    key: 'ORDER_DEFAULT_NOTE',
                    value: defaultNote,
                    description: 'Ghi chú mặc định cho Đơn hàng'
                })
            ]);
            message.success('Đã lưu cấu hình Terms Đơn hàng!');
        } catch (e) {
            message.error('Lỗi khi lưu');
        }
        setSaving(false);
    };

    const handleSaveTerm = (values: any) => {
        let newList = [...termsList];
        if (values.isDefault) {
            newList = newList.map(t => ({ ...t, isDefault: false }));
        }
        if (editingTerm) {
            newList = newList.map(t => t.id === editingTerm.id ? { ...t, ...values } : t);
        } else {
            newList.push({ id: Date.now().toString(), ...values });
        }
        if (newList.length === 1) newList[0].isDefault = true;
        setTermsList(newList);
        setModalOpen(false);
    };

    const handleDeleteTerm = (id: string) => {
        setTermsList(termsList.filter(t => t.id !== id));
    };

    if (loading) return <Spin />;

    const columns = [
        { title: 'Tên Mẫu Điều Khoản', dataIndex: 'name', key: 'name', width: '30%', render: (t: string, r: any) => <b>{t} {r.isDefault && <Tag color="blue" style={{ marginLeft: 8 }}>Mặc định</Tag>}</b> },
        { title: 'Nội dung', dataIndex: 'content', key: 'content', render: (t: string) => <div style={{ whiteSpace: 'pre-line', fontSize: 13, maxHeight: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t}</div> },
        {
            title: 'Hành động', key: 'action', width: 120, render: (_: any, r: any) => (
                <Space>
                    <Button icon={<EditOutlined />} size="small" onClick={() => { setEditingTerm(r); form.setFieldsValue(r); setModalOpen(true); }} />
                    <Popconfirm title="Xóa mẫu này?" onConfirm={() => handleDeleteTerm(r.id)}>
                        <Button icon={<DeleteOutlined />} danger size="small" />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <div style={{ paddingTop: 8 }}>
            <Card title="📝 Ghi chú mặc định Đơn Hàng" bordered={false} size="small" style={{ marginBottom: 16, background: '#fafafa' }}>
                <div style={{ marginBottom: 8, fontSize: 12, color: '#888' }}>
                    Nội dung này sẽ hiển thị trong phần "Ghi chú từ người bán" trên bản in Xác nhận Đơn hàng.
                </div>
                <Input.TextArea
                    rows={3}
                    value={defaultNote}
                    onChange={e => setDefaultNote(e.target.value)}
                    placeholder="VD: Giá chưa bao gồm VAT. Giao hàng theo lịch trình thỏa thuận."
                    style={{ fontSize: 13 }}
                />
            </Card>

            <Card 
                title="📋 Danh sách Điều khoản Đơn Hàng" 
                bordered={false} 
                size="small" 
                style={{ marginBottom: 16, background: '#fafafa' }}
                extra={<Button type="primary" icon={<PlusOutlined />} size="small" onClick={() => { setEditingTerm(null); form.resetFields(); form.setFieldsValue({ isDefault: termsList.length === 0 }); setModalOpen(true); }}>Thêm Mẫu</Button>}
            >
                <Table dataSource={termsList} columns={columns} rowKey="id" pagination={false} size="small" />
            </Card>

            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSaveConfig} size="large">
                Lưu Cấu Hình Terms Đơn Hàng
            </Button>

            <Modal
                title={editingTerm ? "Chỉnh sửa Mẫu Điều Khoản" : "Thêm Mẫu Điều Khoản"}
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                onOk={form.submit}
                width={700}
                destroyOnClose
            >
                <Form form={form} layout="vertical" onFinish={handleSaveTerm}>
                    <Form.Item name="name" label="Tên Mẫu" rules={[{ required: true }]}>
                        <Input placeholder="VD: Điều khoản Đơn hàng Tiêu chuẩn" />
                    </Form.Item>
                    <Form.Item name="content" label="Nội dung Điều khoản & Quy định" rules={[{ required: true }]}>
                        <Input.TextArea rows={8} placeholder={`VD:\n1. Thời gian giao hàng: 15-20 ngày...\n2. Thanh toán: Đặt cọc 50%...`} />
                    </Form.Item>
                    <Form.Item name="isDefault" valuePropName="checked">
                        <Checkbox>Đặt làm Mẫu Mặc định</Checkbox>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

// =========================================================================
// TAB 4.5: MẪU THÔNG BÁO GIAO HÀNG (DELIVERY NOTICE)
// =========================================================================
const DeliveryNoticeTemplatesTab: React.FC = () => {
    const [templates, setTemplates] = useState<DeliveryNoticeTemplate[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<DeliveryNoticeTemplate | null>(null);
    const [form] = Form.useForm();

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const res = await api.get('/system/config/DELIVERY_NOTICE_TEMPLATES');
            let list: DeliveryNoticeTemplate[] = [];
            if (res.data?.value) {
                try { list = JSON.parse(res.data.value); } catch(e) {}
            }
            if (!list || list.length === 0) {
                list = DEFAULT_DELIVERY_NOTICE_TEMPLATES;
            }
            setTemplates(list);
        } catch (e) {
            setTemplates(DEFAULT_DELIVERY_NOTICE_TEMPLATES);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTemplates();
    }, []);

    const handleSaveToSystem = async (listToSave: DeliveryNoticeTemplate[]) => {
        setSaving(true);
        try {
            await api.post('/system/config', {
                key: 'DELIVERY_NOTICE_TEMPLATES',
                value: JSON.stringify(listToSave),
                description: 'Danh sách mẫu thông báo giao hàng (Zalo/SMS)'
            });
            message.success('Đã lưu cấu hình Mẫu Thông Báo Giao Hàng!');
            setTemplates(listToSave);
        } catch (e) {
            message.error('Lỗi khi lưu cấu hình');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveTemplate = (values: any) => {
        let newList = [...templates];
        if (values.isDefault) {
            newList = newList.map(t => ({ ...t, isDefault: false }));
        }
        if (editingTemplate) {
            newList = newList.map(t => t.id === editingTemplate.id ? { ...t, ...values } : t);
        } else {
            newList.push({
                id: 'notice_' + Date.now(),
                ...values
            });
        }
        if (!newList.some(t => t.isDefault) && newList.length > 0) {
            newList[0].isDefault = true;
        }
        setTemplates(newList);
        handleSaveToSystem(newList);
        setModalOpen(false);
    };

    const handleDeleteTemplate = (id: string) => {
        const newList = templates.filter(t => t.id !== id);
        if (!newList.some(t => t.isDefault) && newList.length > 0) {
            newList[0].isDefault = true;
        }
        setTemplates(newList);
        handleSaveToSystem(newList);
    };

    const handleResetDefaults = () => {
        Modal.confirm({
            title: 'Khôi phục 4 mẫu chuẩn từ ERP4U?',
            content: 'Thao tác này sẽ đặt lại danh sách mẫu về 4 mẫu chuẩn ban đầu (B2B trường học, Đi tỉnh chành xe, Giao từng phần, Rút gọn).',
            okText: 'Khôi phục',
            cancelText: 'Hủy',
            onOk: () => {
                handleSaveToSystem(DEFAULT_DELIVERY_NOTICE_TEMPLATES);
            }
        });
    };

    const copyPlaceholder = (placeholder: string) => {
        navigator.clipboard.writeText(placeholder);
        message.success(`Đã copy biến: ${placeholder}`);
    };

    const columns = [
        {
            title: 'Tên Mẫu Thông Báo',
            dataIndex: 'name',
            key: 'name',
            width: '28%',
            render: (t: string, r: DeliveryNoticeTemplate) => (
                <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{t}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                        {r.isDefault && <Tag color="blue">Mặc định</Tag>}
                        {r.type && <Tag color="geekblue">{r.type}</Tag>}
                    </div>
                </div>
            )
        },
        {
            title: 'Nội Dung Mẫu',
            dataIndex: 'content',
            key: 'content',
            render: (t: string) => (
                <div style={{ 
                    whiteSpace: 'pre-line', 
                    fontSize: 12, 
                    maxHeight: 110, 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis', 
                    background: '#fafafa', 
                    padding: '8px 12px', 
                    borderRadius: 6, 
                    border: '1px solid #f0f0f0',
                    fontFamily: 'monospace'
                }}>
                    {t}
                </div>
            )
        },
        {
            title: 'Thao tác',
            key: 'act',
            width: 130,
            align: 'right' as const,
            render: (_: any, r: DeliveryNoticeTemplate) => (
                <Space>
                    <Tooltip title="Sao chép nội dung mẫu">
                        <Button 
                            icon={<CopyOutlined />} 
                            size="small" 
                            onClick={() => {
                                navigator.clipboard.writeText(r.content);
                                message.success('Đã sao chép nội dung mẫu!');
                            }} 
                        />
                    </Tooltip>
                    <Tooltip title="Chỉnh sửa mẫu">
                        <Button 
                            icon={<EditOutlined />} 
                            size="small" 
                            onClick={() => {
                                setEditingTemplate(r);
                                form.setFieldsValue(r);
                                setModalOpen(true);
                            }} 
                        />
                    </Tooltip>
                    <Popconfirm title="Xóa mẫu này?" onConfirm={() => handleDeleteTemplate(r.id)} okText="Xóa" cancelText="Hủy">
                        <Button icon={<DeleteOutlined />} danger size="small" />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    if (loading) return <Spin tip="Đang tải mẫu thông báo giao hàng..." />;

    return (
        <div style={{ paddingTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>🚚 Mẫu Thông Báo Giao Hàng (Delivery Notice)</h3>
                    <p style={{ color: '#888', margin: 0, fontSize: 13 }}>
                        Cấu hình các kịch bản thông báo giao nhận cho khách hàng B2B qua Zalo/SMS (áp dụng tự động khi nhân viên lập Phiếu Xuất Kho).
                    </p>
                </div>
                <Space>
                    <Button icon={<ReloadOutlined />} onClick={handleResetDefaults}>
                        Khôi phục 4 mẫu chuẩn
                    </Button>
                    <Button 
                        type="primary" 
                        icon={<PlusOutlined />} 
                        onClick={() => {
                            setEditingTemplate(null);
                            form.resetFields();
                            form.setFieldsValue({ isDefault: templates.length === 0, type: 'CUSTOM' });
                            setModalOpen(true);
                        }}
                    >
                        Thêm Mẫu Mới
                    </Button>
                </Space>
            </div>

            {/* Quick Placeholder reference tags */}
            <Card 
                size="small" 
                title={<span style={{ fontSize: 13, fontWeight: 600 }}>💡 Các biến tự động điền (Bấm vào thẻ để sao chép mã biến):</span>}
                style={{ marginBottom: 16, background: '#f8fafc', borderColor: '#e2e8f0' }}
            >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {PLACEHOLDER_GUIDE.map((item) => (
                        <Tooltip key={item.key} title={`${item.label} (Ví dụ: ${item.example})`}>
                            <Tag 
                                color="blue" 
                                style={{ cursor: 'pointer', padding: '3px 8px', borderRadius: 4 }}
                                onClick={() => copyPlaceholder(item.key)}
                            >
                                <code>{item.key}</code>: {item.label}
                            </Tag>
                        </Tooltip>
                    ))}
                </div>
            </Card>

            <Table 
                dataSource={templates} 
                columns={columns} 
                rowKey="id" 
                pagination={false} 
                size="small" 
                style={{ marginBottom: 16 }}
            />

            <Modal
                title={editingTemplate ? "Chỉnh sửa Mẫu Thông Báo Giao Hàng" : "Thêm Mẫu Thông Báo Giao Hàng Mới"}
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                onOk={form.submit}
                width={780}
                destroyOnClose
            >
                <Form form={form} layout="vertical" onFinish={handleSaveTemplate}>
                    <Row gutter={16}>
                        <Col span={16}>
                            <Form.Item name="name" label="Tên Mẫu Thông Báo" rules={[{ required: true, message: 'Vui lòng nhập tên mẫu' }]}>
                                <Input placeholder="VD: Mẫu giao hàng Chành Xe (Chuyển khoản trước)" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="type" label="Phân Loại Kịch Bản">
                                <Input placeholder="VD: B2B_STANDARD, CHANH_XE..." />
                            </Form.Item>
                        </Col>
                    </Row>

                    <div style={{ marginBottom: 8, fontSize: 12, color: '#666' }}>
                        Gợi ý chèn biến: Bấm vào các biến bên dưới để chèn nhanh vào nội dung:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                        {PLACEHOLDER_GUIDE.map(item => (
                            <Tag 
                                key={item.key} 
                                color="cyan" 
                                style={{ cursor: 'pointer', fontSize: 11 }}
                                onClick={() => {
                                    const curr = form.getFieldValue('content') || '';
                                    form.setFieldsValue({ content: curr + (curr ? '\n' : '') + item.key });
                                }}
                            >
                                + {item.key}
                            </Tag>
                        ))}
                    </div>

                    <Form.Item 
                        name="content" 
                        label="Nội dung Thông Báo (Hỗ trợ văn bản nhiều dòng và biến placeholders)" 
                        rules={[{ required: true, message: 'Vui lòng nhập nội dung mẫu' }]}
                    >
                        <Input.TextArea 
                            rows={12} 
                            placeholder="Nhập nội dung mẫu thông báo..." 
                            style={{ fontFamily: 'monospace', fontSize: 13 }}
                        />
                    </Form.Item>

                    <Form.Item name="isDefault" valuePropName="checked">
                        <Checkbox>Đặt làm mẫu mặc định (Tự động chọn khi mở form Tạo Phiếu Xuất Kho)</Checkbox>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

// =========================================================================
// TAB 5: EMAIL (SMTP) & MẪU EMAIL
// =========================================================================
const EmailSettingsTab: React.FC = () => {
    return (
        <div>
            <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>✉️ Cấu Hình Máy Chủ Email & Mẫu Thư Tự Động</h3>
                <p style={{ color: '#888', margin: 0, fontSize: 13 }}>
                    Cấu hình tài khoản SMTP gửi mail và các biểu mẫu email gửi Báo Giá / Thông báo tiến độ cho khách hàng.
                </p>
            </div>

            <Tabs
                defaultActiveKey="smtp_config"
                type="card"
                items={[
                    {
                        key: 'smtp_config',
                        label: '⚙️ Cấu Hình Máy Chủ SMTP',
                        children: <SmtpConfigSubTab />
                    },
                    {
                        key: 'email_templates',
                        label: '📬 Mẫu Email Gửi Khách Hàng',
                        children: <EmailTemplatesSubTab />
                    }
                ]}
            />
        </div>
    );
};

const SmtpConfigSubTab: React.FC = () => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [testingSmtp, setTestingSmtp] = useState(false);

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/system/smtp`);
            const data = { ...res.data, SMTP_SECURE: res.data.SMTP_SECURE === 'true' };
            form.setFieldsValue(data);
        } catch (error) {
            message.error('Không thể tải cấu hình SMTP');
        }
        setLoading(false);
    };

    const handleTestSmtp = async () => {
        const testEmail = prompt('Nhập địa chỉ email để nhận thư test:');
        if (!testEmail) return;
        setTestingSmtp(true);
        try {
            const res = await api.post(`/system/smtp/test`, { email: testEmail });
            if (res.data.success) {
                message.success(res.data.message);
            } else {
                message.error(res.data.message);
            }
        } catch (error) {
            message.error('Lỗi khi gọi API Test SMTP. Vui lòng kiểm tra lại cấu hình.');
        }
        setTestingSmtp(false);
    };

    useEffect(() => {
        fetchConfig();
    }, []);

    const onFinish = async (values: any) => {
        setSubmitting(true);
        try {
            const payload = { ...values, SMTP_SECURE: String(values.SMTP_SECURE) };
            await api.post(`/system/smtp`, payload);
            message.success('Đã lưu cấu hình SMTP thành công!');
        } catch (error) {
            message.error('Lỗi khi lưu cấu hình');
        }
        setSubmitting(false);
    };

    return (
        <Card bordered={false} size="small" style={{ background: '#fafafa', paddingTop: 8 }}>
            <Alert message="Cấu hình máy chủ SMTP dùng để gửi Email Báo Giá, Xác Nhận Đơn Hàng và Thông Báo cho khách hàng." type="info" showIcon style={{ marginBottom: 20 }} />
            {loading ? <Spin /> : (
                <Form form={form} layout="vertical" onFinish={onFinish}>
                    <Row gutter={24}>
                        <Col span={16}><Form.Item name="SMTP_HOST" label="SMTP Host" rules={[{ required: true }]}><Input placeholder="smtp.gmail.com" /></Form.Item></Col>
                        <Col span={8}><Form.Item name="SMTP_PORT" label="Port" rules={[{ required: true }]}><Input placeholder="587" /></Form.Item></Col>
                    </Row>
                    <Row gutter={24}>
                        <Col span={12}><Form.Item name="SMTP_USER" label="Username / Email Đăng Nhập" rules={[{ required: true }]}><Input placeholder="email@domain.com" /></Form.Item></Col>
                        <Col span={12}><Form.Item name="SMTP_PASS" label="Password / App Password"><Input.Password placeholder="Nhập mật khẩu ứng dụng" /></Form.Item></Col>
                    </Row>
                    <Row gutter={24}>
                        <Col span={12}><Form.Item name="SMTP_FROM_NAME" label="Tên Người Gửi Hiển Thị" rules={[{ required: true }]}><Input placeholder="ERP4U System" /></Form.Item></Col>
                        <Col span={12}><Form.Item name="SMTP_FROM_EMAIL" label="Email Người Gửi (From Email)" rules={[{ required: true }]}><Input placeholder="no-reply@domain.com" /></Form.Item></Col>
                    </Row>
                    <Form.Item name="SMTP_SECURE" valuePropName="checked" label="Sử dụng SSL/TLS"><Switch /></Form.Item>
                    <Space size="middle">
                        <Button type="primary" icon={<SaveOutlined />} onClick={form.submit} loading={submitting} size="large">Lưu Cấu Hình Email</Button>
                        <Button icon={<MailOutlined />} onClick={handleTestSmtp} loading={testingSmtp} size="large">Gửi Thử Email Test</Button>
                    </Space>
                </Form>
            )}
        </Card>
    );
};

const EasyInvoiceConfigTab: React.FC = () => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/system/easyinvoice`);
            form.setFieldsValue(res.data);
        } catch (error) {
            message.error('Không thể tải cấu hình EasyInvoice');
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchConfig();
    }, []);

    const onFinish = async (values: any) => {
        setSubmitting(true);
        try {
            await api.post(`/system/easyinvoice`, values);
            message.success('Đã lưu cấu hình EasyInvoice thành công!');
        } catch (error) {
            message.error('Lỗi khi lưu cấu hình');
        }
        setSubmitting(false);
    };

    return (
        <Card bordered={false} size="small" style={{ background: '#fafafa', paddingTop: 8 }}>
            <Alert message="Cấu hình hệ thống xuất hóa đơn điện tử EasyInvoice. URL test: http://api.softdreams.vn/ - URL production: https://api.easyinvoice.vn/" type="info" showIcon style={{ marginBottom: 20 }} />
            {loading ? <Spin /> : (
                <Form form={form} layout="vertical" onFinish={onFinish}>
                    <Row gutter={24}>
                        <Col span={24}>
                            <Form.Item name="EASYINVOICE_URL" label="EasyInvoice API URL" rules={[{ required: true }]}>
                                <Input placeholder="https://api.easyinvoice.vn/" />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={24}>
                        <Col span={8}>
                            <Form.Item name="EASYINVOICE_USERNAME" label="Username (Tên đăng nhập API)" rules={[{ required: true }]}>
                                <Input placeholder="API" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="EASYINVOICE_PASSWORD" label="Password (Mật khẩu API)" rules={[{ required: true }]}>
                                <Input.Password placeholder="Nhập mật khẩu" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="EASYINVOICE_TAX_CODE" label="Tax Code (Mã số thuế doanh nghiệp)" rules={[{ required: true }]}>
                                <Input placeholder="031..." />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={24}>
                        <Col span={8}>
                            <Form.Item name="EASYINVOICE_PATTERN" label="Mẫu Hóa Đơn (Pattern) mặc định">
                                <Input placeholder="Ví dụ: 1" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="EASYINVOICE_SERIAL" label="Ký Hiệu Hóa Đơn (Serial) mặc định">
                                <Input placeholder="Ví dụ: 1C26TAA" />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Divider orientation="left">Cấu Hình Gửi Email Hóa Đơn</Divider>
                    <Row gutter={24}>
                        <Col span={12}>
                            <Form.Item name="EASYINVOICE_EMAIL_FROM" label="Email Người Gửi (From)">
                                <Input placeholder="Ví dụ: ketoan.erp4u@gmail.com" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="EASYINVOICE_EMAIL_CC" label="Danh sách CC (Cách nhau dấu phẩy)">
                                <Input placeholder="Ví dụ: admin@erp4u.vn,ketoan2@erp4u.vn" />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Space size="middle">
                        <Button type="primary" icon={<SaveOutlined />} onClick={form.submit} loading={submitting} size="large">Lưu Cấu Hình</Button>
                    </Space>
                </Form>
            )}
        </Card>
    );
};

const GhtkConfigTab: React.FC = () => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<any>(null);
    const [currentConfig, setCurrentConfig] = useState<any>(null);

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const res = await api.get('/shipping/config');
            setCurrentConfig(res.data);
            form.setFieldsValue({
                GHTK_SANDBOX: res.data.isSandbox || false,
                GHTK_API_URL: res.data.apiUrl || '',
                GHTK_PARTNER_CODE: res.data.partnerCode || '',
                GHTK_DEFAULT_PICK_ADDRESS_ID: res.data.defaultPickAddressId || '',
                GHTK_DEFAULT_PICK_OPTION: res.data.defaultPickOption || 'cod',
            });
        } catch (e) {
            message.error('Không thể tải cấu hình GHTK');
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchConfig();
    }, []);

    const handleTest = async () => {
        const values = form.getFieldsValue();
        setTesting(true);
        setTestResult(null);
        try {
            const res = await api.post('/shipping/test-connection', {
                token: values.GHTK_TOKEN || undefined,
                isSandbox: values.GHTK_SANDBOX,
                apiUrl: values.GHTK_API_URL || undefined,
                partnerCode: values.GHTK_PARTNER_CODE || undefined,
            });
            setTestResult(res.data);
            if (res.data.success) {
                message.success('Kết nối GHTK thành công!');
            } else {
                message.error(res.data.message || 'Kết nối GHTK thất bại');
            }
        } catch (e: any) {
            setTestResult({ success: false, message: e.response?.data?.message || e.message });
            message.error('Lỗi khi kiểm tra kết nối GHTK');
        } finally {
            setTesting(false);
        }
    };

    const handleSubmit = async (values: any) => {
        setSubmitting(true);
        try {
            const payload: any = {
                isSandbox: values.GHTK_SANDBOX,
                apiUrl: values.GHTK_API_URL,
                partnerCode: values.GHTK_PARTNER_CODE,
                defaultPickAddressId: values.GHTK_DEFAULT_PICK_ADDRESS_ID,
                defaultPickOption: values.GHTK_DEFAULT_PICK_OPTION,
            };
            if (values.GHTK_TOKEN && values.GHTK_TOKEN.trim()) {
                payload.token = values.GHTK_TOKEN.trim();
            }
            await api.post('/shipping/config', payload);
            message.success('Đã lưu cấu hình GHTK thành công!');
            fetchConfig();
        } catch (e: any) {
            message.error(e.response?.data?.message || 'Lỗi khi lưu cấu hình GHTK');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Card title={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CarOutlined style={{ color: '#008444' }} />
                    <span>Cấu hình Đối tác Vận chuyển Giao Hàng Tiết Kiệm (GHTK)</span>
                </div>
                {currentConfig && (
                    currentConfig.isConfigured ? (
                        <Tag color="green">✅ Đã kết nối API ({currentConfig.isSandbox ? 'Staging / Lab' : 'Production'})</Tag>
                    ) : (
                        <Tag color="warning">⚠️ Chưa cấu hình Token (Chế độ Demo)</Tag>
                    )
                )}
            </div>
        }>
            <Alert
                message="Tích hợp Giao Hàng Tiết Kiệm (GHTK) cho phép xuất kho tự động sinh mã vận đơn, in phiếu giao A6, tra cước realtime và cập nhật trạng thái đơn hàng."
                type="info"
                showIcon
                style={{ marginBottom: 20 }}
            />

            {loading ? <Spin /> : (
                <Form form={form} layout="vertical" onFinish={handleSubmit}>
                    <Row gutter={16}>
                        <Col span={16}>
                            <Form.Item
                                name="GHTK_TOKEN"
                                label="API Token GHTK"
                                extra={currentConfig?.hasToken ? `Hiện tại đã có Token: ${currentConfig.maskedToken}. Để trống nếu không muốn đổi.` : "Lấy tại: Cổng Khách hàng GHTK > Thông tin shop / Tài khoản"}
                            >
                                <Input.Password placeholder="Nhập mã API Token bí mật từ GHTK..." />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="GHTK_SANDBOX" label="Môi trường kết nối">
                                <Radio.Group
                                    value={form.getFieldValue('GHTK_SANDBOX')}
                                    onChange={e => form.setFieldsValue({ GHTK_SANDBOX: e.target.value })}
                                >
                                    <Radio.Button value={false}>Thực tế (Prod)</Radio.Button>
                                    <Radio.Button value={true}>Thử nghiệm (Staging)</Radio.Button>
                                </Radio.Group>
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={6}>
                            <Form.Item name="GHTK_PARTNER_CODE" label="Partner Code / Client Source">
                                <Input placeholder="VD: S308157 hoặc ERP4U_ERP" />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item name="GHTK_DEFAULT_PICK_ADDRESS_ID" label="Mã kho lấy hàng (pick_address_id)">
                                <Input placeholder="Mã kho (VD: 88256)" />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item name="GHTK_DEFAULT_PICK_OPTION" label="Hình thức gửi mặc định" initialValue="cod">
                                <Radio.Group buttonStyle="solid" size="middle" style={{ width: '100%' }}>
                                    <Radio.Button value="cod">🚚 Shipper lấy</Radio.Button>
                                    <Radio.Button value="post">🏪 Gửi bưu cục</Radio.Button>
                                </Radio.Group>
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item name="GHTK_API_URL" label="Tùy chỉnh API URL (Tùy chọn)">
                                <Input placeholder="Tự động theo môi trường" />
                            </Form.Item>
                        </Col>
                    </Row>

                    {testResult && (
                        <Alert
                            type={testResult.success ? 'success' : 'error'}
                            showIcon
                            style={{ marginBottom: 20 }}
                            message={testResult.message}
                            description={testResult.pickAddresses?.length > 0 && (
                                <div style={{ marginTop: 4 }}>
                                    <b>Danh sách kho lấy hàng:</b>{' '}
                                    {testResult.pickAddresses.map((p: any) => `${p.pick_name || 'Kho'} - ${p.address}`).join(' | ')}
                                </div>
                            )}
                        />
                    )}

                    <Space size="middle">
                        <Button type="primary" style={{ background: '#008444', borderColor: '#008444' }} icon={<SaveOutlined />} onClick={form.submit} loading={submitting} size="large">
                            Lưu Cấu Hình
                        </Button>
                        <Button icon={<ThunderboltOutlined />} onClick={handleTest} loading={testing} size="large">
                            Kiểm Tra Kết Nối
                        </Button>
                    </Space>
                </Form>
            )}
        </Card>
    );
};

const LalamoveConfigTab: React.FC = () => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<any>(null);
    const [currentConfig, setCurrentConfig] = useState<any>(null);

    const watchedApiKey = Form.useWatch('LALAMOVE_API_KEY', form);
    const watchedSandbox = Form.useWatch('LALAMOVE_SANDBOX', form);

    const effectiveKey = (watchedApiKey || '').trim() || currentConfig?.maskedApiKey || '';
    const isProdKey = effectiveKey.startsWith('pk_prod_') || effectiveKey.startsWith('pk_pro');
    const isTestKey = effectiveKey.startsWith('pk_test_') || effectiveKey.startsWith('pk_tes');
    const hasMismatch = (isProdKey && watchedSandbox === true) || (isTestKey && watchedSandbox === false);

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const res = await api.get('/shipping/lalamove/config');
            setCurrentConfig(res.data);
            form.setFieldsValue({
                LALAMOVE_SANDBOX: res.data.isSandbox !== undefined ? res.data.isSandbox : false,
                LALAMOVE_MARKET: res.data.market || 'VN',
                LALAMOVE_DEFAULT_SENDER_NAME: res.data.defaultSenderName || 'Kho ERP4U',
                LALAMOVE_DEFAULT_SENDER_PHONE: res.data.defaultSenderPhone || '+84901234567',
                LALAMOVE_DEFAULT_PICK_ADDRESS: res.data.defaultPickAddress || 'Kho ERP4U, Tân Thới Nhất, Quận 12, TP. Hồ Chí Minh',
                LALAMOVE_DEFAULT_PICK_LAT: res.data.defaultPickLat || 10.8230989,
                LALAMOVE_DEFAULT_PICK_LNG: res.data.defaultPickLng || 106.6296638,
            });
        } catch (e: any) {
            message.error('Không thể tải cấu hình Lalamove');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConfig();
    }, []);

    const handleTest = async () => {
        const values = form.getFieldsValue();
        setTesting(true);
        setTestResult(null);
        try {
            const isSandbox = values.LALAMOVE_SANDBOX;
            const res = await api.post('/shipping/lalamove/test-connection', {
                apiKey: values.LALAMOVE_API_KEY?.trim() || undefined,
                apiSecret: values.LALAMOVE_API_SECRET?.trim() || undefined,
                isSandbox,
                apiUrl: isSandbox ? 'https://rest.sandbox.lalamove.com' : 'https://rest.lalamove.com',
                market: values.LALAMOVE_MARKET || 'VN',
            });
            setTestResult(res.data);
            if (res.data.success) {
                message.success('Kết nối Lalamove thành công!');
            } else {
                message.error(res.data.message || 'Kết nối Lalamove thất bại');
            }
        } catch (e: any) {
            setTestResult({ success: false, message: e.response?.data?.message || e.message });
            message.error('Lỗi khi kiểm tra kết nối Lalamove');
        } finally {
            setTesting(false);
        }
    };

    const handleSubmit = async (values: any) => {
        setSubmitting(true);
        try {
            const isSandbox = values.LALAMOVE_SANDBOX;
            const payload: any = {
                isSandbox,
                apiUrl: isSandbox ? 'https://rest.sandbox.lalamove.com' : 'https://rest.lalamove.com',
                market: values.LALAMOVE_MARKET || 'VN',
                defaultSenderName: values.LALAMOVE_DEFAULT_SENDER_NAME,
                defaultSenderPhone: values.LALAMOVE_DEFAULT_SENDER_PHONE,
                defaultPickAddress: values.LALAMOVE_DEFAULT_PICK_ADDRESS,
                defaultPickLat: values.LALAMOVE_DEFAULT_PICK_LAT,
                defaultPickLng: values.LALAMOVE_DEFAULT_PICK_LNG,
            };
            if (values.LALAMOVE_API_KEY && values.LALAMOVE_API_KEY.trim()) {
                payload.apiKey = values.LALAMOVE_API_KEY.trim();
            }
            if (values.LALAMOVE_API_SECRET && values.LALAMOVE_API_SECRET.trim()) {
                payload.apiSecret = values.LALAMOVE_API_SECRET.trim();
            }
            await api.post('/shipping/lalamove/config', payload);
            message.success('Đã lưu cấu hình Lalamove thành công!');
            fetchConfig();
        } catch (e: any) {
            message.error(e.response?.data?.message || 'Lỗi khi lưu cấu hình Lalamove');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Card title={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 20 }}>🚚</span>
                    <span style={{ fontWeight: 700, color: '#eb6100' }}>Cấu hình Đối tác Vận chuyển Lalamove API (v3)</span>
                </div>
                {currentConfig && (
                    currentConfig.isConfigured ? (
                        <Tag color="green">✅ Đã cấu hình ({currentConfig.isSandbox ? 'Sandbox Test' : 'Production Live'})</Tag>
                    ) : (
                        <Tag color="warning">⚠️ Chưa cấu hình Key / Secret (Chế độ Demo)</Tag>
                    )
                )}
            </div>
        }>
            <Alert
                message="Tích hợp Lalamove API v3 cho phép xuất kho tự động đặt xe giao hỏa tốc (Xe máy, Bán tải Van, Xe tải 1 - 2 tấn), xem vị trí GPS tài xế thời gian thực, nghiệm thu giao hàng bằng ảnh chụp (POD) và phục vụ vận chuyển Chặng 1 ra Chành xe."
                type="info"
                showIcon
                style={{ marginBottom: 20 }}
            />

            {loading ? <Spin /> : (
                <Form 
                    form={form} 
                    layout="vertical" 
                    onFinish={handleSubmit}
                    onValuesChange={(changedValues) => {
                        if (changedValues.LALAMOVE_API_KEY) {
                            const val = (changedValues.LALAMOVE_API_KEY || '').trim();
                            if (val.startsWith('pk_prod_')) {
                                form.setFieldsValue({ LALAMOVE_SANDBOX: false });
                                message.info('Đã tự động chuyển sang môi trường "Thực tế (Production)" theo tiền tố API Key (pk_prod_...)');
                            } else if (val.startsWith('pk_test_')) {
                                form.setFieldsValue({ LALAMOVE_SANDBOX: true });
                                message.info('Đã tự động chuyển sang môi trường "Thử nghiệm (Sandbox)" theo tiền tố API Key (pk_test_...)');
                            }
                        }
                    }}
                >
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                name="LALAMOVE_API_KEY"
                                label="Lalamove API Key"
                                extra={currentConfig?.hasApiKey ? `Đã lưu: ${currentConfig.maskedApiKey}. Để trống nếu không muốn đổi.` : "Lấy tại Lalamove Partner Portal > Developers"}
                            >
                                <Input placeholder="Nhập API Key..." />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                name="LALAMOVE_API_SECRET"
                                label="Lalamove API Secret"
                                extra={currentConfig?.hasApiSecret ? `Đã lưu: ${currentConfig.maskedApiSecret}. Để trống nếu không đổi.` : "Dùng để sinh chữ ký HMAC-SHA256"}
                            >
                                <Input.Password placeholder="Nhập API Secret..." />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item name="LALAMOVE_SANDBOX" label="Môi trường kết nối">
                                <Radio.Group buttonStyle="solid">
                                    <Radio.Button value={true}>Thử nghiệm (Sandbox)</Radio.Button>
                                    <Radio.Button value={false}>Thực tế (Production)</Radio.Button>
                                </Radio.Group>
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="LALAMOVE_MARKET" label="Thị trường (Market)">
                                <Input placeholder="Mặc định: VN" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item 
                                label="Webhook Callback URL (Cấu hình trên Lalamove Portal)"
                                extra="Copy dán chính xác URL này vào trường Webhook URL trên Lalamove Partner Portal"
                            >
                                <Input 
                                    readOnly 
                                    value={`${window.location.origin}/api/shipping/webhook/lalamove`} 
                                    addonAfter={
                                        <Tooltip title="Copy Webhook URL">
                                            <CopyOutlined onClick={() => {
                                                navigator.clipboard.writeText(`${window.location.origin}/api/shipping/webhook/lalamove`);
                                                message.success('Đã copy Webhook URL!');
                                            }} style={{ cursor: 'pointer' }} />
                                        </Tooltip>
                                    } 
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Divider orientation="left" style={{ margin: '12px 0 20px 0' }}>
                        <span style={{ fontSize: 13, color: '#666' }}>📍 Điểm Bốc Hàng Mặc Định (Kho ERP4U)</span>
                    </Divider>

                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item name="LALAMOVE_DEFAULT_SENDER_NAME" label="Tên người gửi / Thủ kho">
                                <Input placeholder="VD: Kho ERP4U" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="LALAMOVE_DEFAULT_SENDER_PHONE" label="Số điện thoại kho (Định dạng E.164)">
                                <Input placeholder="VD: +84983882210" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="LALAMOVE_DEFAULT_PICK_ADDRESS" label="Địa chỉ xuất hàng">
                                <Input placeholder="Địa chỉ kho ERP4U" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item 
                                name="LALAMOVE_DEFAULT_PICK_LAT" 
                                label="Vĩ độ kho (Latitude)" 
                                extra="Bắt buộc để định vị điểm lấy hàng trên bản đồ GPS"
                            >
                                <InputNumber style={{ width: '100%' }} step={0.000001} placeholder="VD: 10.8230989" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item 
                                name="LALAMOVE_DEFAULT_PICK_LNG" 
                                label="Kinh độ kho (Longitude)"
                                extra="Bắt buộc để định vị điểm lấy hàng trên bản đồ GPS"
                            >
                                <InputNumber style={{ width: '100%' }} step={0.000001} placeholder="VD: 106.6296638" />
                            </Form.Item>
                        </Col>
                    </Row>

                    {hasMismatch && (
                        <Alert
                            type="warning"
                            showIcon
                            style={{ marginBottom: 16 }}
                            message="Cảnh báo: Không khớp Môi trường với API Key!"
                            description={
                                watchedSandbox ? (
                                    <div>
                                        Khóa API của bạn bắt đầu bằng <b>pk_prod_</b> thuộc môi trường <b>Thực tế (Production)</b>, nhưng bạn đang chọn <b>Thử nghiệm (Sandbox)</b>.<br />
                                        Hệ thống Lalamove Sandbox sẽ trả về <b>lỗi 401 Unauthorized</b> do không tìm thấy khóa Production trên Sandbox.<br />
                                        👉 <b>Cách xử lý:</b> Vui lòng bấm chọn ô <b>"Thực tế (Production)"</b> bên trên, sau đó bấm <b>"Lưu Cấu Hình Lalamove"</b> và bấm lại <b>"Kiểm Tra Kết Nối"</b>.
                                    </div>
                                ) : (
                                    <div>
                                        Khóa API của bạn bắt đầu bằng <b>pk_test_</b> thuộc môi trường <b>Thử nghiệm (Sandbox)</b>, nhưng bạn đang chọn <b>Thực tế (Production)</b>.<br />
                                        👉 <b>Cách xử lý:</b> Vui lòng bấm chọn ô <b>"Thử nghiệm (Sandbox)"</b> bên trên.
                                    </div>
                                )
                            }
                        />
                    )}

                    {testResult && (
                        <Alert
                            type={testResult.success ? 'success' : 'error'}
                            showIcon
                            style={{ marginBottom: 20 }}
                            message={testResult.message}
                            description={testResult.cities?.length > 0 && (
                                <div style={{ marginTop: 6 }}>
                                    <b>Khu vực hỗ trợ tại Việt Nam:</b>{' '}
                                    {testResult.cities.map((c: any) => `${c.name} (${c.locode})`).join(' • ')}
                                </div>
                            )}
                        />
                    )}

                    <Space size="middle">
                        <Button type="primary" style={{ background: '#eb6100', borderColor: '#eb6100' }} icon={<SaveOutlined />} onClick={form.submit} loading={submitting} size="large">
                            Lưu Cấu Hình Lalamove
                        </Button>
                        <Button icon={<ThunderboltOutlined />} onClick={handleTest} loading={testing} size="large">
                            Kiểm Tra Kết Nối (HMAC SHA-256)
                        </Button>
                    </Space>
                </Form>
            )}
        </Card>
    );
};

const ShippingCarriersTab: React.FC = () => {
    return (
        <Tabs
            defaultActiveKey="ghtk"
            items={[
                {
                    key: 'ghtk',
                    label: (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <CarOutlined style={{ color: '#008444' }} />
                            <span>Giao Hàng Tiết Kiệm (GHTK)</span>
                        </div>
                    ),
                    children: <GhtkConfigTab />
                },
                {
                    key: 'lalamove',
                    label: (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 16 }}>🚚</span>
                            <span>Lalamove API v3 (Hỏa Tốc & Xe Tải)</span>
                        </div>
                    ),
                    children: <LalamoveConfigTab />
                }
            ]}
        />
    );
};

const EmailTemplatesSubTab: React.FC = () => {
    const [templates, setTemplates] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<any>(null);
    const [form] = Form.useForm();

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/system/email-templates`);
            setTemplates(res.data);
        } catch (e) { message.error('Lỗi tải danh sách mẫu email'); }
        setLoading(false);
    };

    useEffect(() => { 
        fetchTemplates(); 
    }, []);

    const handleSave = async (values: any) => {
        try {
            await api.post(`/system/email-templates`, { ...values, id: editingTemplate?.id });
            message.success('Đã lưu mẫu email');
            setModalOpen(false);
            fetchTemplates();
        } catch (e) { message.error('Lỗi lưu mẫu email'); }
    };

    const handleDelete = async (id: number) => {
        try {
            await api.delete(`/system/email-templates/${id}`);
            message.success('Đã xóa mẫu email');
            fetchTemplates();
        } catch (e) { message.error('Lỗi xóa mẫu email'); }
    };

    const columns = [
        { title: 'Tên Mẫu', dataIndex: 'name', key: 'name', width: '25%', render: (t: string) => <b>{t}</b> },
        { title: 'Tiêu đề Email', dataIndex: 'subject', key: 'subject', width: '35%' },
        { title: 'Cập nhật lần cuối', dataIndex: 'updated_at', key: 'updated_at', render: (t: string) => dayjs(t).format('DD/MM/YYYY HH:mm') },
        {
            title: 'Hành động', key: 'action', width: 150, render: (_: any, r: any) => (
                <div style={{ display: 'flex', gap: 8 }}>
                    <Button icon={<EditOutlined />} size="small" onClick={() => { setEditingTemplate(r); form.setFieldsValue(r); setModalOpen(true); }}>Sửa</Button>
                    <Popconfirm title="Xóa mẫu này?" onConfirm={() => handleDelete(r.id)}>
                        <Button icon={<DeleteOutlined />} danger size="small">Xóa</Button>
                    </Popconfirm>
                </div>
            )
        }
    ];

    return (
        <div style={{ paddingTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{ fontSize: 13, color: '#666' }}>Quản lý các kịch bản email tự động gửi báo giá, xác nhận cọc, thông báo hoàn thành đơn.</span>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingTemplate(null); form.resetFields(); setModalOpen(true); }}>Tạo Mẫu Mới</Button>
            </div>

            <Table dataSource={templates} columns={columns} rowKey="id" loading={loading} pagination={false} size="small" />

            <Modal
                title={editingTemplate ? "Chỉnh Sửa Mẫu Email" : "Tạo Mẫu Email Mới"}
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                onOk={form.submit}
                width={1100}
                style={{ top: 20 }}
                maskClosable={false}
            >
                <Form form={form} layout="vertical" onFinish={handleSave}>
                    <Form.Item name="name" label={<span style={{fontWeight: 600}}>Tên mẫu (Quản lý nội bộ)</span>} rules={[{ required: true, message: 'Nhập tên mẫu' }]}>
                        <Input placeholder="VD: Gửi Báo Giá Khách Hàng B2B" size="large" />
                    </Form.Item>
                    <Form.Item name="subject" label={<span style={{fontWeight: 600}}>Tiêu đề Email</span>} rules={[{ required: true, message: 'Nhập tiêu đề email' }]}>
                        <Input placeholder="VD: Báo giá dịch vụ may mặc từ ERP4U - {{order_code}}" size="large" />
                    </Form.Item>
                    <Form.Item name="content" label={<span style={{fontWeight: 600}}>Nội dung Email (HTML trực quan)</span>} rules={[{ required: true }]}>
                        <RichTextEditor minHeight={350} />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

// =========================================================================
// TAB 6: QUY TRÌNH & DÒNG TIỀN (OPERATIONS)
// =========================================================================
const OperationsConfigTab: React.FC = () => {
    return (
        <div>
            <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>⚙️ Cấu Hình Vận Hành & Dòng Tiền</h3>
                <p style={{ color: '#888', margin: 0, fontSize: 13 }}>
                    Thiết lập quy trình dự án tự động (SO Project Templates), ngưỡng cảnh báo quỹ và link tài nguyên Google Drive.
                </p>
            </div>

            <SOProjectTemplateConfig />

            <Divider style={{ margin: '24px 0' }} />

            <Card title="💰 Cấu Hình Cảnh Báo Dòng Tiền" bordered={false} size="small" style={{ background: '#fafafa', marginBottom: 20 }}>
                <NumberConfigItem label="Ngưỡng cảnh báo quỹ thấp (VNĐ)" configKey="CASH_FLOW_THRESHOLD" defaultValue={50000000} />
            </Card>

            <Card title="📁 Quản Lý Link Tài Nguyên" bordered={false} size="small" style={{ background: '#fafafa' }}>
                <LinkConfigItem label="Folder Ảnh Sản Phẩm (Google Drive)" configKey="SALES_SHARED_DRIVE_LINK" placeholder="https://drive.google.com/..." />
            </Card>
        </div>
    );
};

const SOProjectTemplateConfig: React.FC = () => {
    const [milestones, setMilestones] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [modalOpen, setModalOpen] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [form] = Form.useForm();

    useEffect(() => {
        fetchTemplate();
    }, []);

    const fetchTemplate = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/system/so-project-template`);
            setMilestones(res.data || []);
        } catch (e) {
            message.error('Lỗi tải template dự án SO');
        }
        setLoading(false);
    };

    const handleSaveTemplate = async () => {
        setSubmitting(true);
        try {
            await api.post(`/system/so-project-template`, milestones);
            message.success('Đã lưu Template Dự án thành công!');
        } catch (e) {
            message.error('Lỗi khi lưu Template');
        }
        setSubmitting(false);
    };

    const openModal = (index?: number) => {
        setEditingIndex(index ?? null);
        if (index !== undefined && index !== null) {
            form.setFieldsValue(milestones[index]);
        } else {
            form.resetFields();
            form.setFieldsValue({
                sort_order: (milestones.length > 0 ? Math.max(...milestones.map(m => m.sort_order)) : 0) + 1,
                tasks: []
            });
        }
        setModalOpen(true);
    };

    const handleModalOk = async () => {
        try {
            const values = await form.validateFields();
            const newMilestones = [...milestones];
            if (editingIndex !== null) {
                newMilestones[editingIndex] = { ...newMilestones[editingIndex], ...values };
            } else {
                newMilestones.push(values);
            }
            newMilestones.sort((a, b) => a.sort_order - b.sort_order);
            setMilestones(newMilestones);
            setModalOpen(false);
        } catch (e) { }
    };

    const handleDelete = (index: number) => {
        const newMilestones = [...milestones];
        newMilestones.splice(index, 1);
        setMilestones(newMilestones);
    };

    const columns = [
        { title: 'Thứ tự', dataIndex: 'sort_order', width: 80, align: 'center' as const },
        { title: 'Giai đoạn (Milestone)', dataIndex: 'title', width: 220, render: (t: string) => <b>{t}</b> },
        { title: 'Phòng ban', dataIndex: 'department', width: 140, render: (d: string) => <Tag color="blue">{d}</Tag> },
        { 
            title: 'Công việc (Tasks)', 
            dataIndex: 'tasks',
            render: (tasks: string[]) => (
                <ul style={{ paddingLeft: 16, margin: 0, fontSize: 12 }}>
                    {tasks?.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
            )
        },
        {
            title: 'Thao tác', width: 100, align: 'center' as const,
            render: (_: any, __: any, index: number) => (
                <Space>
                    <Button type="text" icon={<EditOutlined />} onClick={() => openModal(index)} />
                    <Popconfirm title="Xóa giai đoạn này?" onConfirm={() => handleDelete(index)}>
                        <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <Card 
            title="Template Dự Án Đơn Hàng (SO Project Milestones)" 
            bordered={false} 
            size="small"
            style={{ background: '#fafafa' }}
            extra={
                <Space>
                    <Button icon={<PlusOutlined />} onClick={() => openModal()}>Thêm Giai Đoạn</Button>
                    <Button type="primary" icon={<SaveOutlined />} loading={submitting} onClick={handleSaveTemplate}>Lưu Template</Button>
                </Space>
            }
        >
            <Alert message="Quy trình mẫu tự động tạo danh sách công việc khi đơn hàng chuyển sang trạng thái sản xuất." type="info" showIcon style={{ marginBottom: 16 }} />
            
            <Table 
                dataSource={milestones}
                columns={columns}
                rowKey={(r, i) => i?.toString() || Math.random().toString()}
                pagination={false}
                loading={loading}
                size="small"
                bordered
            />

            <Modal
                title={editingIndex !== null ? "Sửa Giai Đoạn" : "Thêm Giai Đoạn"}
                open={modalOpen}
                onOk={handleModalOk}
                onCancel={() => setModalOpen(false)}
                width={600}
                destroyOnClose
            >
                <Form form={form} layout="vertical">
                    <Row gutter={16}>
                        <Col span={16}>
                            <Form.Item name="title" label="Tên giai đoạn" rules={[{ required: true }]}>
                                <Input placeholder="VD: Sản xuất & Gia công" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="sort_order" label="Thứ tự" rules={[{ required: true }]}>
                                <InputNumber style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item name="department" label="Bộ phận phụ trách" rules={[{ required: true }]}>
                        <Input placeholder="VD: PRODUCTION" />
                    </Form.Item>
                    
                    <Form.List name="tasks">
                        {(fields, { add, remove }) => (
                            <>
                                <div style={{ marginBottom: 8, fontWeight: 'bold' }}>Danh sách công việc (Tasks):</div>
                                {fields.map((field, index) => (
                                    <Form.Item
                                        required={false}
                                        key={field.key}
                                        style={{ marginBottom: 8 }}
                                    >
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <Form.Item
                                                {...field}
                                                validateTrigger={['onChange', 'onBlur']}
                                                rules={[{ required: true, message: 'Vui lòng nhập tên task hoặc xóa đi' }]}
                                                noStyle
                                            >
                                                <Input placeholder="Tên công việc" style={{ width: '100%' }} />
                                            </Form.Item>
                                            <MinusCircleOutlined
                                                className="dynamic-delete-button"
                                                onClick={() => remove(field.name)}
                                                style={{ marginTop: 8, color: 'red' }}
                                            />
                                        </div>
                                    </Form.Item>
                                ))}
                                <Form.Item>
                                    <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                                        Thêm Task
                                    </Button>
                                </Form.Item>
                            </>
                        )}
                    </Form.List>
                </Form>
            </Modal>
        </Card>
    );
};

// =========================================================================
// TAB 7: TÍCH HỢP API KEYS (BOT / AGENTS)
// =========================================================================
const ApiKeysTab: React.FC = () => {
    const [tokens, setTokens] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [form] = Form.useForm();
    const [generatedKey, setGeneratedKey] = useState<string | null>(null);

    const fetchTokens = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/system/api-tokens`);
            setTokens(res.data);
        } catch (e) { message.error('Lỗi tải danh sách API Keys'); }
        setLoading(false);
    };

    useEffect(() => { fetchTokens(); }, []);

    const handleCreate = async (values: any) => {
        try {
            const res = await api.post(`/system/api-tokens`, values);
            setGeneratedKey(res.data.api_key);
            message.success('Tạo API Key thành công');
            fetchTokens();
        } catch (e) { message.error('Lỗi khi tạo API Key'); }
    };

    const handleRevoke = async (id: number) => {
        try {
            await api.delete(`/system/api-tokens/${id}`);
            message.success('Đã thu hồi API Key');
            fetchTokens();
        } catch (e) { message.error('Lỗi thu hồi API Key'); }
    };

    const columns = [
        { title: 'Tên Bot / Dịch Vụ', dataIndex: 'name', key: 'name', render: (t: string) => <b>{t}</b> },
        { title: 'Token Hint', dataIndex: 'token_hint', key: 'token_hint', render: (t: string) => <Tag color="default">...{t}</Tag> },
        { title: 'Quyền Hạn', dataIndex: 'permissions', key: 'permissions', render: (perms: string[]) => (
            <>
                {perms?.map(p => <Tag color="blue" key={p}>{p}</Tag>)}
            </>
        )},
        { title: 'Trạng Thái', dataIndex: 'is_active', key: 'is_active', render: (active: boolean) => (
            <Tag color={active ? 'green' : 'red'}>{active ? 'Đang hoạt động' : 'Đã thu hồi'}</Tag>
        )},
        { title: 'Lần Dùng Cuối', dataIndex: 'last_used_at', key: 'last_used_at', render: (t: string) => t ? dayjs(t).format('DD/MM/YYYY HH:mm') : 'Chưa sử dụng' },
        { title: 'Ngày Tạo', dataIndex: 'created_at', key: 'created_at', render: (t: string) => dayjs(t).format('DD/MM/YYYY') },
        {
            title: 'Hành động', key: 'action', width: 100, render: (_: any, r: any) => (
                r.is_active && (
                    <Popconfirm title="Bạn có chắc chắn muốn thu hồi (revoke) key này? Bot sử dụng key này sẽ mất quyền truy cập ngay lập tức." onConfirm={() => handleRevoke(r.id)}>
                        <Button danger size="small">Thu hồi</Button>
                    </Popconfirm>
                )
            )
        }
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>🔑 Quản Lý API Keys Cho Bot & Tích Hợp</h3>
                    <p style={{ color: '#888', margin: 0, fontSize: 13 }}>Cấp phát và thu hồi API Token cho các trợ lý ảo (AI Agent), Bot báo cáo tự động và dịch vụ bên thứ 3.</p>
                </div>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => { setGeneratedKey(null); form.resetFields(); setModalOpen(true); }}>Tạo API Key</Button>
            </div>

            <Table dataSource={tokens} columns={columns} rowKey="id" loading={loading} pagination={false} size="small" />

            <Modal
                title="Tạo API Key Mới"
                open={modalOpen}
                onCancel={() => { setModalOpen(false); setGeneratedKey(null); }}
                onOk={generatedKey ? () => { setModalOpen(false); setGeneratedKey(null); } : form.submit}
                okText={generatedKey ? "Đóng" : "Tạo Key"}
                cancelButtonProps={{ style: { display: generatedKey ? 'none' : 'inline-block' } }}
            >
                {generatedKey ? (
                    <Alert
                        type="success"
                        message="API Key đã được tạo thành công!"
                        description={
                            <div>
                                <p style={{ marginBottom: 8 }}>Vui lòng copy và lưu trữ mã Key dưới đây ngay lập tức. <b>Mã này sẽ chỉ được hiển thị 1 lần duy nhất</b> để đảm bảo bảo mật.</p>
                                <div style={{ background: '#f6ffed', padding: '10px 15px', border: '1px solid #b7eb8f', borderRadius: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Typography.Text copyable={{ text: generatedKey }} style={{ fontFamily: 'monospace', fontSize: 16, wordBreak: 'break-all' }}>
                                        {generatedKey}
                                    </Typography.Text>
                                </div>
                            </div>
                        }
                    />
                ) : (
                    <Form form={form} layout="vertical" onFinish={handleCreate} initialValues={{ permissions: ['full_access'] }}>
                        <Form.Item name="name" label="Tên gợi nhớ (Tên Bot/Hệ thống)" rules={[{ required: true, message: 'Nhập tên' }]}>
                            <Input placeholder="VD: Agent Daily Report" />
                        </Form.Item>
                        <Form.Item name="permissions" label="Quyền truy cập" rules={[{ required: true, message: 'Chọn ít nhất 1 quyền' }]}>
                            <Checkbox.Group>
                                <Space direction="vertical">
                                    <Checkbox value="full_access"><b>Full Access</b> (Đọc toàn bộ dữ liệu Orders, Inventory, MRP, Customers)</Checkbox>
                                </Space>
                            </Checkbox.Group>
                        </Form.Item>
                    </Form>
                )}
            </Modal>
        </div>
    );
};

// =========================================================================
// HELPER COMPONENTS
// =========================================================================
const LinkConfigItem = ({ label, configKey, placeholder }: { label: string, configKey: string, placeholder: string }) => {
    const [val, setVal] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        api.get(`/system/config/${configKey}`).then(res => {
            if (res.data && res.data.value) setVal(res.data.value);
        });
    }, [configKey]);

    const handleSave = async () => {
        setLoading(true);
        try {
            await api.post(`/system/config`, {
                key: configKey,
                value: val,
                description: label
            });
            message.success('Đã lưu');
        } catch (e) { message.error('Lỗi lưu'); }
        setLoading(false);
    };

    return (
        <Form.Item label={label} style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', gap: 8 }}>
                <Input value={val} onChange={e => setVal(e.target.value)} placeholder={placeholder} />
                <Button type="primary" icon={<SaveOutlined />} loading={loading} onClick={handleSave}>Lưu</Button>
            </div>
        </Form.Item>
    );
};

const NumberConfigItem = ({ label, configKey, defaultValue }: { label: string, configKey: string, defaultValue: number }) => {
    const [val, setVal] = useState<number>(defaultValue);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        api.get(`/system/config/${configKey}`).then(res => {
            if (res.data && res.data.value) setVal(Number(res.data.value));
        });
    }, [configKey]);

    const handleSave = async () => {
        setLoading(true);
        try {
            await api.post(`/system/config`, {
                key: configKey,
                value: String(val),
                description: label
            });
            message.success('Đã lưu');
        } catch (e) { message.error('Lỗi lưu'); }
        setLoading(false);
    };

    return (
        <Form.Item label={label} style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <InputNumber
                    style={{ width: 220 }}
                    value={val}
                    onChange={(v) => setVal(v || defaultValue)}
                    formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={(v) => Number(v?.replace(/,/g, '') || defaultValue)}
                    min={0}
                />
                <span style={{ color: '#888' }}>VNĐ</span>
                <Button type="primary" icon={<SaveOutlined />} loading={loading} onClick={handleSave}>Lưu</Button>
            </div>
        </Form.Item>
    );
};

export default SystemSettingsPage;
