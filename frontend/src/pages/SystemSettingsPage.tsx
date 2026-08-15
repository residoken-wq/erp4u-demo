import React, { useEffect, useState } from 'react';
import { Card, Form, Input, InputNumber, Button, Switch, message, Spin, Row, Col, Divider, Alert, Tabs, Table, Modal, Popconfirm, Tooltip, Tag, Space, Typography, Checkbox, Upload } from 'antd';
import { SaveOutlined, MailOutlined, LinkOutlined, ShopOutlined, FileTextOutlined, PlusOutlined, EditOutlined, DeleteOutlined, CopyOutlined, SettingOutlined, MinusCircleOutlined, InfoCircleOutlined, KeyOutlined, UploadOutlined, AuditOutlined } from '@ant-design/icons';
import axios from 'axios';
import { API_URL } from '../config';
import dayjs from 'dayjs';
import RichTextEditor from '../components/common/RichTextEditor';

const SystemSettingsPage: React.FC = () => {
    return (
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
            <Card bordered={false} bodyStyle={{ padding: 0 }}>
                <Tabs defaultActiveKey="1" tabPosition="left" style={{ minHeight: 600 }}>
                    <Tabs.TabPane tab={<span><MailOutlined /> Cấu hình Email & Chung</span>} key="1">
                        <div style={{ padding: 24 }}>
                            <GeneralSettingsTab />
                        </div>
                    </Tabs.TabPane>
                    <Tabs.TabPane tab={<span><FileTextOutlined /> Mẫu Hợp Đồng</span>} key="2">
                        <div style={{ padding: 24 }}>
                            <ContractTemplatesTab />
                        </div>
                    </Tabs.TabPane>
                    <Tabs.TabPane tab={<span><MailOutlined /> Mẫu Email</span>} key="4">
                        <div style={{ padding: 24 }}>
                            <EmailTemplatesTab />
                        </div>
                    </Tabs.TabPane>
                    <Tabs.TabPane tab={<span><ShopOutlined /> Terms Báo giá</span>} key="3">
                        <div style={{ padding: 24 }}>
                            <QuoteTermsTab />
                        </div>
                    </Tabs.TabPane>
                    <Tabs.TabPane tab={<span><AuditOutlined /> Terms Đơn hàng</span>} key="6">
                        <div style={{ padding: 24 }}>
                            <OrderTermsTab />
                        </div>
                    </Tabs.TabPane>
                    <Tabs.TabPane tab={<span><KeyOutlined /> API Management</span>} key="5">
                        <div style={{ padding: 24 }}>
                            <ApiKeysTab />
                        </div>
                    </Tabs.TabPane>
                </Tabs>
            </Card>
        </div>
    );
};

const GeneralSettingsTab: React.FC = () => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [testingSmtp, setTestingSmtp] = useState(false);

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/system/smtp`);
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
            const res = await axios.post(`${API_URL}/system/smtp/test`, { email: testEmail });
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
            await axios.post(`${API_URL}/system/smtp`, payload);
            message.success('Đã lưu cấu hình SMTP thành công!');
        } catch (error) {
            message.error('Lỗi khi lưu cấu hình');
        }
        setSubmitting(false);
    };

    return (
        <>
            <Card title="Cấu Hình Email (SMTP)" bordered={false} size="small">
                <Alert message="Cấu hình này dùng để gửi Email thông báo và Báo giá cho khách hàng." type="info" showIcon style={{ marginBottom: 24 }} />
                {loading ? <Spin /> : (
                    <Form form={form} layout="vertical" onFinish={onFinish}>
                        <Row gutter={24}>
                            <Col span={16}><Form.Item name="SMTP_HOST" label="SMTP Host" rules={[{ required: true }]}><Input placeholder="smtp.gmail.com" /></Form.Item></Col>
                            <Col span={8}><Form.Item name="SMTP_PORT" label="Port" rules={[{ required: true }]}><Input placeholder="587" /></Form.Item></Col>
                        </Row>
                        <Row gutter={24}>
                            <Col span={12}><Form.Item name="SMTP_USER" label="Username / Email" rules={[{ required: true }]}><Input placeholder="email@domain.com" /></Form.Item></Col>
                            <Col span={12}><Form.Item name="SMTP_PASS" label="Password"><Input.Password placeholder="Nhập mật khẩu" /></Form.Item></Col>
                        </Row>
                        <Row gutter={24}>
                            <Col span={12}><Form.Item name="SMTP_FROM_NAME" label="Tên người gửi" rules={[{ required: true }]}><Input placeholder="ERP4U System" /></Form.Item></Col>
                            <Col span={12}><Form.Item name="SMTP_FROM_EMAIL" label="Email người gửi" rules={[{ required: true }]}><Input placeholder="no-reply@domain.com" /></Form.Item></Col>
                        </Row>
                        <Form.Item name="SMTP_SECURE" valuePropName="checked" label="Sử dụng SSL/TLS"><Switch /></Form.Item>
                        <Space>
                            <Button type="primary" icon={<SaveOutlined />} onClick={form.submit} loading={submitting}>Lưu Cấu Hình Email</Button>
                            <Button icon={<MailOutlined />} onClick={handleTestSmtp} loading={testingSmtp}>Test Cấu hình SMTP</Button>
                        </Space>
                    </Form>
                )}
            </Card>

            <Divider />

            <Card title="Thông tin Doanh nghiệp" bordered={false} size="small">
                <CompanyConfigForm />
            </Card>

            <Divider />

            <Card title="Quản Lý Link Tài Nguyên" bordered={false} size="small">
                <LinkConfigItem label="Folder Ảnh Sản Phẩm (Google Drive)" configKey="SALES_SHARED_DRIVE_LINK" placeholder="https://drive.google.com/..." />
                <Divider style={{ margin: '16px 0' }} />
                <ImageUploadConfigItem label="Watermark Hình Ảnh (Portal Báo Giá/Dashboard)" configKey="PORTAL_WATERMARK_IMAGE" />
            </Card>

            <Divider />

            <Card title="Cấu Hình Dòng Tiền" bordered={false} size="small">
                <NumberConfigItem label="Ngưỡng cảnh báo quỹ thấp (VNĐ)" configKey="CASH_FLOW_THRESHOLD" defaultValue={50000000} />
            </Card>

            <Divider />

            <SOProjectTemplateConfig />
        </>
    );
};

const SOProjectTemplateConfig: React.FC = () => {
    const [milestones, setMilestones] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Modal state for editing milestone
    const [modalOpen, setModalOpen] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [form] = Form.useForm();

    useEffect(() => {
        fetchTemplate();
    }, []);

    const fetchTemplate = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/system/so-project-template`);
            setMilestones(res.data || []);
        } catch (e) {
            message.error('Lỗi tải template dự án SO');
        }
        setLoading(false);
    };

    const handleSaveTemplate = async () => {
        setSubmitting(true);
        try {
            await axios.post(`${API_URL}/system/so-project-template`, milestones);
            message.success('Đã lưu Template Dự án');
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
        { title: 'Giai đoạn (Milestone)', dataIndex: 'title' },
        { title: 'Phòng ban', dataIndex: 'department', width: 150 },
        { 
            title: 'Công việc (Tasks)', 
            dataIndex: 'tasks',
            render: (tasks: string[]) => (
                <ul style={{ paddingLeft: 16, margin: 0 }}>
                    {tasks?.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
            )
        },
        {
            title: 'Thao tác', width: 120, align: 'center' as const,
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
            title="Template Dự Án (Tạo từ Đơn Hàng)" 
            bordered={false} 
            size="small"
            extra={
                <Space>
                    <Button icon={<PlusOutlined />} onClick={() => openModal()}>Thêm Giai Đoạn</Button>
                    <Button type="primary" icon={<SaveOutlined />} loading={submitting} onClick={handleSaveTemplate}>Lưu Template</Button>
                </Space>
            }
        >
            <Alert message="Cấu hình này định nghĩa các giai đoạn và công việc mặc định được tạo ra khi chuyển Báo giá thành Đơn hàng (Sales Order)." type="info" showIcon style={{ marginBottom: 16 }} />
            
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


const ContractTemplatesTab: React.FC = () => {
    const [templates, setTemplates] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<any>(null);
    const [form] = Form.useForm();

    // Placeholders Management
    const [customPlaceholders, setCustomPlaceholders] = useState<{key: string, desc: string}[]>([]);
    const [placeholderModalOpen, setPlaceholderModalOpen] = useState(false);
    const [placeholderForm] = Form.useForm();

    const fetchPlaceholders = async () => {
        try {
            const res = await axios.get(`${API_URL}/system/config/CONTRACT_CUSTOM_PLACEHOLDERS`);
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
            const res = await axios.get(`${API_URL}/system/templates`);
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
            await axios.post(`${API_URL}/system/config`, {
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
            await axios.post(`${API_URL}/system/templates`, { ...values, id: editingTemplate?.id });
            message.success('Đã lưu mẫu hợp đồng');
            setModalOpen(false);
            fetchTemplates();
        } catch (e) { message.error('Lỗi lưu mẫu'); }
    };

    const handleDelete = async (id: number) => {
        try {
            await axios.delete(`${API_URL}/system/templates/${id}`);
            message.success('Đã xóa mẫu');
            fetchTemplates();
        } catch (e) { message.error('Lỗi xóa mẫu'); }
    };

    const columns = [
        { title: 'Tên Mẫu', dataIndex: 'name', key: 'name', width: '30%', render: (t: string) => <b>{t}</b> },
        { title: 'Cập nhật lần cuối', dataIndex: 'updated_at', key: 'updated_at', render: (t: string) => dayjs(t).format('DD/MM/YYYY HH:mm') },
        {
            title: 'Hành động', key: 'action', width: 150, render: (_: any, r: any) => (
                <div style={{ display: 'flex', gap: 8 }}>
                    <Button icon={<EditOutlined />} size="small" onClick={() => { setEditingTemplate(r); form.setFieldsValue(r); setModalOpen(true); }} />
                    <Popconfirm title="Xóa mẫu này?" onConfirm={() => handleDelete(r.id)}>
                        <Button icon={<DeleteOutlined />} danger size="small" />
                    </Popconfirm>
                </div>
            )
        }
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3>Danh Sách Mẫu Hợp Đồng</h3>
                <Space>
                    <Button icon={<SettingOutlined />} onClick={() => setPlaceholderModalOpen(true)}>Cấu Hình Nhãn (Placeholders)</Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingTemplate(null); form.resetFields(); setModalOpen(true); }}>Tạo Mẫu Mới</Button>
                </Space>
            </div>

            <Alert
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
                message="Hướng dẫn sử dụng Nhãn (Placeholder)"
                description={
                    <div style={{ marginTop: 8 }}>
                        <p style={{ marginBottom: 8, fontSize: 13, color: '#666' }}>Click vào các nhãn dưới đây để copy, sau đó <strong>DÁN</strong> vào trình soạn thảo bằng <code>Ctrl + V</code>.</p>
                        <div style={{ marginBottom: 6, fontWeight: 600, fontSize: 12, color: '#555' }}>🔹 Khách hàng & Đơn hàng</div>
                        <Space size={[8, 8]} wrap style={{ marginBottom: 12 }}>
                            {[
                                { key: 'customer_name', desc: 'Tên Khách hàng' },
                                { key: 'customer_address', desc: 'Địa chỉ Khách hàng' },
                                { key: 'customer_tax_code', desc: 'Mã số thuế Khách hàng' },
                                { key: 'order_code', desc: 'Mã Đơn hàng / Hợp đồng' },
                                { key: 'order_date', desc: 'Ngày tạo đơn' },
                                { key: 'total_amount_text', desc: 'Tổng tiền bằng chữ' },
                                { key: 'items_table', desc: 'Bảng chi tiết mặt hàng' }
                            ].map(p => (
                                <Tooltip title={`Mặc định: ${p.desc}`} key={p.key}>
                                    <Tag color="blue" style={{ cursor: 'pointer', padding: '4px 8px', fontSize: 13 }} onClick={() => {
                                        navigator.clipboard.writeText(`{{${p.key}}}`);
                                        message.success(`Đã copy: {{${p.key}}}`);
                                    }}>
                                        <Space size={4}>
                                            <CopyOutlined style={{ opacity: 0.6 }} />
                                            {`{{${p.key}}}`}
                                        </Space>
                                    </Tag>
                                </Tooltip>
                            ))}
                        </Space>
                        <div style={{ marginBottom: 6, fontWeight: 600, fontSize: 12, color: '#555' }}>🔸 Bên Bán (Thông tin Doanh nghiệp)</div>
                        <Space size={[8, 8]} wrap style={{ marginBottom: 12 }}>
                            {[
                                { key: 'seller_company_name', desc: 'Tên công ty' },
                                { key: 'seller_address', desc: 'Địa chỉ công ty' },
                                { key: 'seller_phone', desc: 'Số điện thoại' },
                                { key: 'seller_email', desc: 'Email' },
                                { key: 'seller_website', desc: 'Website' },
                                { key: 'seller_tax_code', desc: 'Mã số thuế' },
                                { key: 'seller_representative', desc: 'Người đại diện' },
                                { key: 'seller_bank_name', desc: 'Tên ngân hàng' },
                                { key: 'seller_bank_account', desc: 'Số tài khoản' },
                                { key: 'seller_bank_holder', desc: 'Chủ tài khoản' },
                            ].map(p => (
                                <Tooltip title={`Bên bán: ${p.desc}`} key={p.key}>
                                    <Tag color="orange" style={{ cursor: 'pointer', padding: '4px 8px', fontSize: 13 }} onClick={() => {
                                        navigator.clipboard.writeText(`{{${p.key}}}`);
                                        message.success(`Đã copy: {{${p.key}}}`);
                                    }}>
                                        <Space size={4}>
                                            <CopyOutlined style={{ opacity: 0.6 }} />
                                            {`{{${p.key}}}`}
                                        </Space>
                                    </Tag>
                                </Tooltip>
                            ))}
                        </Space>
                        <div style={{ marginBottom: 6, fontWeight: 600, fontSize: 12, color: '#555' }}>📝 Nội dung tự soạn</div>
                        <Space size={[8, 8]} wrap style={{ marginBottom: 12 }}>
                            {[
                                { key: 'text_content_1', desc: 'Nội dung tự soạn 1' },
                                { key: 'text_content_2', desc: 'Nội dung tự soạn 2' },
                                { key: 'text_content_3', desc: 'Nội dung tự soạn 3' },
                                { key: 'text_content_4', desc: 'Nội dung tự soạn 4' },
                                { key: 'text_content_5', desc: 'Nội dung tự soạn 5' },
                            ].map(p => (
                                <Tooltip title={p.desc} key={p.key}>
                                    <Tag color="purple" style={{ cursor: 'pointer', padding: '4px 8px', fontSize: 13 }} onClick={() => {
                                        navigator.clipboard.writeText(`{{${p.key}}}`);
                                        message.success(`Đã copy: {{${p.key}}}`);
                                    }}>
                                        <Space size={4}>
                                            <CopyOutlined style={{ opacity: 0.6 }} />
                                            {`{{${p.key}}}`}
                                        </Space>
                                    </Tag>
                                </Tooltip>
                            ))}
                        </Space>
                        {customPlaceholders.length > 0 && (
                            <>
                                <div style={{ marginBottom: 6, fontWeight: 600, fontSize: 12, color: '#555' }}>🟢 Tự định nghĩa</div>
                                <Space size={[8, 8]} wrap>
                                    {customPlaceholders.map(p => (
                                        <Tooltip title={`Tự định nghĩa: ${p.desc}`} key={p.key}>
                                            <Tag color="green" style={{ cursor: 'pointer', padding: '4px 8px', fontSize: 13 }} onClick={() => {
                                                navigator.clipboard.writeText(`{{${p.key}}}`);
                                                message.success(`Đã copy: {{${p.key}}}`);
                                            }}>
                                                <Space size={4}>
                                                    <CopyOutlined style={{ opacity: 0.6 }} />
                                                    {`{{${p.key}}}`}
                                                </Space>
                                            </Tag>
                                        </Tooltip>
                                    ))}
                                </Space>
                            </>
                        )}
                    </div>
                }
            />

            <Table dataSource={templates} columns={columns} rowKey="id" loading={loading} pagination={false} />

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
                                <Input placeholder="VD: Hợp đồng nguyên tắc 2024" size="large" />
                            </Form.Item>
                            <Form.Item name="content" label={<span style={{fontWeight: 600}}>Nội dung hợp đồng (HTML/Text)</span>} rules={[{ required: true }]}>
                                <RichTextEditor minHeight={500} />
                            </Form.Item>
                        </Form>
                    </Col>
                    <Col span={7}>
                        <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, height: '100%' }}>
                            <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 15 }}>Danh Sách Placeholder</div>
                            <p style={{ fontSize: 13, color: '#666', marginBottom: 16, lineHeight: 1.4 }}>
                                Click để copy biến và DÁN (<code>Ctrl+V</code>) vào vị trí cần thiết. Các biến này sẽ được hệ thống dữ liệu tự động thay thế khi in hợp đồng.
                            </p>
                            <div style={{ maxHeight: 600, overflowY: 'auto', paddingRight: 4 }}>
                                <Space size={[8, 12]} wrap direction="vertical" style={{ width: '100%' }}>
                                    {/* Default Placeholders - Khách hàng & Đơn hàng */}
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
                                        { key: 'contract_code', desc: 'Mã số Hợp đồng tự động (TLG/Năm-ID)' },
                                        { key: 'order_date', desc: 'Ngày tạo đơn' },
                                        { key: 'total_amount_text', desc: 'Tổng tiền bằng chữ' },
                                        { key: 'items_table', desc: 'Bảng chi tiết mặt hàng' }
                                    ].map(p => (
                                        <div key={p.key} style={{ display: 'flex', flexDirection: 'column' }}>
                                            <Tag color="blue" style={{ cursor: 'pointer', padding: '6px 12px', fontSize: 13, width: 'fit-content' }} onClick={() => {
                                                navigator.clipboard.writeText(`{{${p.key}}}`);
                                                message.success(`Đã copy: {{${p.key}}}`);
                                            }}>
                                                <Space size={4}>
                                                    <CopyOutlined style={{ opacity: 0.6 }} />
                                                    {`{{${p.key}}}`}
                                                </Space>
                                            </Tag>
                                            <span style={{ fontSize: 12, color: '#888', marginTop: 4, marginLeft: 4 }}>{p.desc}</span>
                                        </div>
                                    ))}
                                    {/* Seller Placeholders */}
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
                                            <Tag color="orange" style={{ cursor: 'pointer', padding: '6px 12px', fontSize: 13, width: 'fit-content' }} onClick={() => {
                                                navigator.clipboard.writeText(`{{${p.key}}}`);
                                                message.success(`Đã copy: {{${p.key}}}`);
                                            }}>
                                                <Space size={4}>
                                                    <CopyOutlined style={{ opacity: 0.6 }} />
                                                    {`{{${p.key}}}`}
                                                </Space>
                                            </Tag>
                                            <span style={{ fontSize: 12, color: '#888', marginTop: 4, marginLeft: 4 }}>{p.desc}</span>
                                        </div>
                                    ))}
                                    {/* Text Content Placeholders */}
                                    <Divider style={{ margin: '8px 0' }} orientation="left" plain><span style={{fontSize: 11, color: '#aaa'}}>📝 Nội dung tự soạn</span></Divider>
                                    {[
                                        { key: 'text_content_1', desc: 'Nội dung 1' },
                                        { key: 'text_content_2', desc: 'Nội dung 2' },
                                        { key: 'text_content_3', desc: 'Nội dung 3' },
                                        { key: 'text_content_4', desc: 'Nội dung 4' },
                                        { key: 'text_content_5', desc: 'Nội dung 5' },
                                    ].map(p => (
                                        <div key={p.key} style={{ display: 'flex', flexDirection: 'column' }}>
                                            <Tag color="purple" style={{ cursor: 'pointer', padding: '6px 12px', fontSize: 13, width: 'fit-content' }} onClick={() => {
                                                navigator.clipboard.writeText(`{{${p.key}}}`);
                                                message.success(`Đã copy: {{${p.key}}}`);
                                            }}>
                                                <Space size={4}>
                                                    <CopyOutlined style={{ opacity: 0.6 }} />
                                                    {`{{${p.key}}}`}
                                                </Space>
                                            </Tag>
                                            <span style={{ fontSize: 12, color: '#888', marginTop: 4, marginLeft: 4 }}>{p.desc}</span>
                                        </div>
                                    ))}
                                    {customPlaceholders.length > 0 && <Divider style={{ margin: '8px 0' }} orientation="left" plain><span style={{fontSize: 11, color: '#aaa'}}>🟢 Tự định nghĩa</span></Divider>}
                                    {customPlaceholders.map(p => (
                                        <div key={p.key} style={{ display: 'flex', flexDirection: 'column' }}>
                                            <Tag color="green" style={{ cursor: 'pointer', padding: '6px 12px', fontSize: 13, width: 'fit-content' }} onClick={() => {
                                                navigator.clipboard.writeText(`{{${p.key}}}`);
                                                message.success(`Đã copy: {{${p.key}}}`);
                                            }}>
                                                <Space size={4}>
                                                    <CopyOutlined style={{ opacity: 0.6 }} />
                                                    {`{{${p.key}}}`}
                                                </Space>
                                            </Tag>
                                            <span style={{ fontSize: 12, color: '#888', marginTop: 4, marginLeft: 4 }}>{p.desc}</span>
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
                <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message="Quy tắc tạo mã Placeholder (Mã biến)"
                    description={
                        <ul style={{ paddingLeft: 20, margin: 0, fontSize: 13 }}>
                            <li><strong>Định dạng đúng:</strong> Ghi bằng chữ thường, tiếng Anh không dấu, sử dụng dấu gạch dưới <code>_</code> thay cho dấu cách (VD: <code>contract_value</code>, <code>buyer_email</code>). Không dùng chữ in hoa, không dùng ký tự đặc biệt.</li>
                            <li><strong>Khớp dữ liệu:</strong> Tên biến phải <strong>chính xác</strong> với các trường dữ liệu trên hệ thống CRM (VD: khách hàng có số điện thoại là `phone` thì đặt biến là <code>customer_phone</code> hoặc <code>buyer_phone</code> tùy thiết lập tính năng in). Nếu đặt sai mã, hệ thống không thể tự lấy dữ liệu điền vào khoảng trống.</li>
                        </ul>
                    }
                />
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

// ... Helper components (LinkConfigItem, NumberConfigItem, CompanyConfigForm) ...

const LinkConfigItem = ({ label, configKey, placeholder }: { label: string, configKey: string, placeholder: string }) => {
    const [val, setVal] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        axios.get(`${API_URL}/system/config/${configKey}`).then(res => {
            if (res.data && res.data.value) setVal(res.data.value);
        });
    }, [configKey]);

    const handleSave = async () => {
        setLoading(true);
        try {
            await axios.post(`${API_URL}/system/config`, {
                key: configKey,
                value: val,
                description: label
            });
            message.success('Đã lưu');
        } catch (e) { message.error('Lỗi lưu'); }
        setLoading(false);
    }

    return (
        <Form.Item label={label} style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', gap: 8 }}>
                <Input value={val} onChange={e => setVal(e.target.value)} placeholder={placeholder} />
                <Button type="primary" icon={<SaveOutlined />} loading={loading} onClick={handleSave}>Lưu</Button>
            </div>
        </Form.Item>
    );
}

const ImageUploadConfigItem = ({ label, configKey }: { label: string, configKey: string }) => {
    const [val, setVal] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        axios.get(`${API_URL}/system/config/${configKey}`).then(res => {
            if (res.data && res.data.value) setVal(res.data.value);
        });
    }, [configKey]);

    const handleSave = async (newValue: string) => {
        setLoading(true);
        try {
            await axios.post(`${API_URL}/system/config`, {
                key: configKey,
                value: newValue,
                description: label
            });
            message.success('Đã lưu cấu hình hình ảnh');
            setVal(newValue);
        } catch (e) { message.error('Lỗi lưu cấu hình hình ảnh'); }
        setLoading(false);
    }

    const uploadProps = {
        name: 'file',
        action: `${API_URL}/upload/image`,
        data: { source: 'erp' },
        showUploadList: false,
        onChange(info: any) {
            if (info.file.status === 'uploading') {
                setLoading(true);
                return;
            }
            if (info.file.status === 'done') {
                const url = info.file.response?.url || info.file.response?.data?.url;
                if (url) {
                    handleSave(url);
                } else {
                    message.error('Upload thất bại, không nhận được URL');
                    setLoading(false);
                }
            } else if (info.file.status === 'error') {
                message.error(`${info.file.name} upload thất bại.`);
                setLoading(false);
            }
        },
    };

    return (
        <Form.Item label={label} style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <Upload {...uploadProps}>
                    <Button icon={<UploadOutlined />} loading={loading}>Tải Ảnh Lên</Button>
                </Upload>
                {val && (
                    <div style={{ position: 'relative' }}>
                        <img 
                            src={val.startsWith('/uploads/') ? `${API_URL}/upload/files/${val.replace('/uploads/', '')}` : val} 
                            alt="watermark" 
                            style={{ height: 60, objectFit: 'contain', border: '1px dashed #ccc', padding: 4 }} 
                        />
                        <Button 
                            danger 
                            size="small" 
                            style={{ position: 'absolute', top: -10, right: -10, borderRadius: '50%' }}
                            onClick={() => handleSave('')}
                        >×</Button>
                    </div>
                )}
            </div>
        </Form.Item>
    );
}

const NumberConfigItem = ({ label, configKey, defaultValue }: { label: string, configKey: string, defaultValue: number }) => {
    const [val, setVal] = useState<number>(defaultValue);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        axios.get(`${API_URL}/system/config/${configKey}`).then(res => {
            if (res.data && res.data.value) setVal(Number(res.data.value));
        });
    }, [configKey]);

    const handleSave = async () => {
        setLoading(true);
        try {
            await axios.post(`${API_URL}/system/config`, {
                key: configKey,
                value: String(val),
                description: label
            });
            message.success('Đã lưu');
        } catch (e) { message.error('Lỗi lưu'); }
        setLoading(false);
    }

    return (
        <Form.Item label={label} style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <InputNumber
                    style={{ width: 200 }}
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
}

const CompanyConfigForm = () => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        axios.get(`${API_URL}/system/company`).then(res => form.setFieldsValue(res.data));
    }, []);

    const onFinish = async (values: any) => {
        setLoading(true);
        try {
            await axios.post(`${API_URL}/system/company`, values);
            message.success('Đã lưu thông tin doanh nghiệp');
        } catch (e) { message.error('Lỗi khi lưu'); }
        setLoading(false);
    };

    return (
        <Form form={form} layout="vertical" onFinish={onFinish}>
            <Row gutter={16}>
                <Col span={12}><Form.Item name="COMPANY_NAME" label="Tên Doanh Nghiệp"><Input placeholder="VD: Công ty TNHH ABC" /></Form.Item></Col>
                <Col span={12}><Form.Item name="COMPANY_PHONE" label="Số điện thoại"><Input placeholder="0909xxxxxx" /></Form.Item></Col>
            </Row>
            <Form.Item name="COMPANY_ADDRESS" label="Địa chỉ"><Input.TextArea rows={2} placeholder="Số 123, đường xyz..." /></Form.Item>
            <Row gutter={16}>
                <Col span={12}><Form.Item name="COMPANY_EMAIL" label="Email"><Input /></Form.Item></Col>
                <Col span={12}><Form.Item name="COMPANY_WEBSITE" label="Website"><Input /></Form.Item></Col>
            </Row>
            <Row gutter={16}>
                <Col span={12}><Form.Item name="COMPANY_TAX_CODE" label="Mã số thuế"><Input placeholder="0123456789" /></Form.Item></Col>
                <Col span={12}><Form.Item name="COMPANY_REPRESENTATIVE" label="Người đại diện"><Input placeholder="Nguyễn Văn A" /></Form.Item></Col>
            </Row>
            <Divider orientation="left" plain>🏦 Thông tin Ngân hàng</Divider>
            <Row gutter={16}>
                <Col span={8}><Form.Item name="COMPANY_BANK_NAME" label="Tên Ngân hàng"><Input placeholder="VD: Vietcombank" /></Form.Item></Col>
                <Col span={8}><Form.Item name="COMPANY_BANK_ACCOUNT" label="Số tài khoản"><Input placeholder="0123456789" /></Form.Item></Col>
                <Col span={8}><Form.Item name="COMPANY_BANK_HOLDER" label="Chủ tài khoản"><Input placeholder="CÔNG TY TNHH ABC" /></Form.Item></Col>
            </Row>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading}>Lưu Thông Tin</Button>
        </Form>
    );
};

const QuoteTermsTab: React.FC = () => {
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
            axios.get(`${API_URL}/system/config/QUOTE_TERMS_LIST`).catch(() => ({ data: null })),
            axios.get(`${API_URL}/system/config/QUOTE_DEFAULT_TERMS`).catch(() => ({ data: null })),
            axios.get(`${API_URL}/system/config/QUOTE_DEFAULT_NOTE`).catch(() => ({ data: null })),
        ]).then(([listRes, termsRes, noteRes]) => {
            let list = [];
            if (listRes.data?.value) {
                try {
                    list = JSON.parse(listRes.data.value);
                } catch(e) {}
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
                axios.post(`${API_URL}/system/config`, {
                    key: 'QUOTE_TERMS_LIST',
                    value: JSON.stringify(termsList),
                    description: 'Danh sách Điều khoản & Quy định cho Báo giá'
                }),
                axios.post(`${API_URL}/system/config`, {
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
        // Nếu chỉ có 1 cái thì tự động set default
        if (newList.length === 1) {
            newList[0].isDefault = true;
        }
        setTermsList(newList);
        setModalOpen(false);
    };

    const handleDeleteTerm = (id: string) => {
        setTermsList(termsList.filter(t => t.id !== id));
    };

    if (loading) return <Spin />;

    const columns = [
        { title: 'Tên Mẫu Điều Khoản', dataIndex: 'name', key: 'name', render: (t: string, r: any) => <b>{t} {r.isDefault && <Tag color="blue" style={{ marginLeft: 8 }}>Mặc định</Tag>}</b> },
        { title: 'Nội dung', dataIndex: 'content', key: 'content', render: (t: string) => <div style={{ whiteSpace: 'pre-line', fontSize: 13, maxHeight: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t}</div> },
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
        <>
            <Alert
                message="Cấu hình nội dung mặc định cho Báo giá B2B"
                description="Nội dung dưới đây sẽ được tự động điền khi tạo báo giá mới. Nhân viên Sales có thể chọn mẫu Điều khoản và chỉnh sửa cho từng đơn cụ thể."
                type="info"
                showIcon
                style={{ marginBottom: 24 }}
            />

            <Card title="📝 Ghi chú mặc định (Note)" bordered={false} size="small" style={{ marginBottom: 20 }}>
                <div style={{ marginBottom: 8, fontSize: 12, color: '#888' }}>
                    Nội dung này sẽ hiển thị trong phần "Ghi chú từ người bán" trên Portal và bản in.
                </div>
                <Input.TextArea
                    rows={4}
                    value={defaultNote}
                    onChange={e => setDefaultNote(e.target.value)}
                    placeholder="VD: Báo giá có hiệu lực trong 7 ngày kể từ ngày gửi. Giá chưa bao gồm VAT và phí vận chuyển."
                    style={{ fontSize: 13 }}
                />
            </Card>

            <Card 
                title="📋 Danh sách Điều khoản & Quy định (Terms)" 
                bordered={false} 
                size="small" 
                style={{ marginBottom: 20 }}
                extra={<Button type="primary" icon={<PlusOutlined />} size="small" onClick={() => { setEditingTerm(null); form.resetFields(); form.setFieldsValue({ isDefault: termsList.length === 0 }); setModalOpen(true); }}>Thêm Mẫu</Button>}
            >
                <div style={{ marginBottom: 16, fontSize: 12, color: '#888' }}>
                    Nhân viên có thể chọn các mẫu này khi tạo Báo giá. Mẫu "Mặc định" sẽ tự động được điền.
                </div>
                <Table dataSource={termsList} columns={columns} rowKey="id" pagination={false} size="small" />
            </Card>

            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSaveConfig} size="large">
                Lưu Toàn Bộ Cấu Hình Terms
            </Button>

            <Modal
                title={editingTerm ? "Chỉnh sửa Mẫu Điều Khoản" : "Thêm Mẫu Điều Khoản"}
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                onOk={form.submit}
                width={800}
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
        </>
    );
};

const OrderTermsTab: React.FC = () => {
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
            axios.get(`${API_URL}/system/config/ORDER_TERMS_LIST`).catch(() => ({ data: null })),
            axios.get(`${API_URL}/system/config/ORDER_DEFAULT_TERMS`).catch(() => ({ data: null })),
            axios.get(`${API_URL}/system/config/ORDER_DEFAULT_NOTE`).catch(() => ({ data: null })),
        ]).then(([listRes, termsRes, noteRes]) => {
            let list = [];
            if (listRes.data?.value) {
                try {
                    list = JSON.parse(listRes.data.value);
                } catch(e) {}
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
                axios.post(`${API_URL}/system/config`, {
                    key: 'ORDER_TERMS_LIST',
                    value: JSON.stringify(termsList),
                    description: 'Danh sách Điều khoản & Quy định cho Đơn hàng'
                }),
                axios.post(`${API_URL}/system/config`, {
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
        // Nếu chỉ có 1 cái thì tự động set default
        if (newList.length === 1) {
            newList[0].isDefault = true;
        }
        setTermsList(newList);
        setModalOpen(false);
    };

    const handleDeleteTerm = (id: string) => {
        setTermsList(termsList.filter(t => t.id !== id));
    };

    if (loading) return <Spin />;

    const columns = [
        { title: 'Tên Mẫu Điều Khoản', dataIndex: 'name', key: 'name', render: (t: string, r: any) => <b>{t} {r.isDefault && <Tag color="blue" style={{ marginLeft: 8 }}>Mặc định</Tag>}</b> },
        { title: 'Nội dung', dataIndex: 'content', key: 'content', render: (t: string) => <div style={{ whiteSpace: 'pre-line', fontSize: 13, maxHeight: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t}</div> },
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
        <>
            <Alert
                message="Cấu hình nội dung mặc định cho Đơn hàng"
                description="Nội dung dưới đây sẽ được tự động điền khi tạo đơn hàng mới. Nhân viên có thể chọn mẫu Điều khoản và chỉnh sửa cho từng đơn cụ thể."
                type="info"
                showIcon
                style={{ marginBottom: 24 }}
            />

            <Card title="📝 Ghi chú mặc định (Note)" bordered={false} size="small" style={{ marginBottom: 20 }}>
                <div style={{ marginBottom: 8, fontSize: 12, color: '#888' }}>
                    Nội dung này sẽ hiển thị trong phần "Ghi chú từ người bán" trên Portal và bản in.
                </div>
                <Input.TextArea
                    rows={4}
                    value={defaultNote}
                    onChange={e => setDefaultNote(e.target.value)}
                    placeholder="VD: Giá chưa bao gồm VAT. Giao hàng theo lịch trình thỏa thuận."
                    style={{ fontSize: 13 }}
                />
            </Card>

            <Card 
                title="📋 Danh sách Điều khoản & Quy định (Terms)" 
                bordered={false} 
                size="small" 
                style={{ marginBottom: 20 }}
                extra={<Button type="primary" icon={<PlusOutlined />} size="small" onClick={() => { setEditingTerm(null); form.resetFields(); form.setFieldsValue({ isDefault: termsList.length === 0 }); setModalOpen(true); }}>Thêm Mẫu</Button>}
            >
                <div style={{ marginBottom: 16, fontSize: 12, color: '#888' }}>
                    Nhân viên có thể chọn các mẫu này khi tạo Đơn hàng. Mẫu "Mặc định" sẽ tự động được điền.
                </div>
                <Table dataSource={termsList} columns={columns} rowKey="id" pagination={false} size="small" />
            </Card>

            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSaveConfig} size="large">
                Lưu Toàn Bộ Cấu Hình Terms
            </Button>

            <Modal
                title={editingTerm ? "Chỉnh sửa Mẫu Điều Khoản" : "Thêm Mẫu Điều Khoản"}
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                onOk={form.submit}
                width={800}
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
        </>
    );
};

const EmailTemplatesTab: React.FC = () => {
    const [templates, setTemplates] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<any>(null);
    const [form] = Form.useForm();

    const [customPlaceholders, setCustomPlaceholders] = useState<{key: string, desc: string}[]>([]);

    const fetchPlaceholders = async () => {
        try {
            const res = await axios.get(`${API_URL}/system/config/CONTRACT_CUSTOM_PLACEHOLDERS`);
            if (res.data && res.data.value) {
                setCustomPlaceholders(JSON.parse(res.data.value));
            }
        } catch (e) { }
    };

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/system/email-templates`);
            setTemplates(res.data);
        } catch (e) { message.error('Lỗi tải danh sách mẫu email'); }
        setLoading(false);
    };

    useEffect(() => { 
        fetchTemplates(); 
        fetchPlaceholders();
    }, []);

    const handleSave = async (values: any) => {
        try {
            await axios.post(`${API_URL}/system/email-templates`, { ...values, id: editingTemplate?.id });
            message.success('Đã lưu mẫu email');
            setModalOpen(false);
            fetchTemplates();
        } catch (e) { message.error('Lỗi lưu mẫu email'); }
    };

    const handleDelete = async (id: number) => {
        try {
            await axios.delete(`${API_URL}/system/email-templates/${id}`);
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
                    <Button icon={<EditOutlined />} size="small" onClick={() => { setEditingTemplate(r); form.setFieldsValue(r); setModalOpen(true); }} />
                    <Popconfirm title="Xóa mẫu này?" onConfirm={() => handleDelete(r.id)}>
                        <Button icon={<DeleteOutlined />} danger size="small" />
                    </Popconfirm>
                </div>
            )
        }
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3>Danh Sách Mẫu Email</h3>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingTemplate(null); form.resetFields(); setModalOpen(true); }}>Tạo Mẫu Mới</Button>
            </div>

            <Table dataSource={templates} columns={columns} rowKey="id" loading={loading} pagination={false} />

            <Modal
                title={editingTemplate ? "Chỉnh Sửa Mẫu Email" : "Tạo Mẫu Email"}
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
                            <Form.Item name="name" label={<span style={{fontWeight: 600}}>Tên mẫu (Dùng để quản lý nội bộ)</span>} rules={[{ required: true, message: 'Nhập tên mẫu' }]}>
                                <Input placeholder="VD: Gửi Báo Giá Khách Hàng" size="large" />
                            </Form.Item>
                            <Form.Item name="subject" label={<span style={{fontWeight: 600}}>Tiêu đề Email</span>} rules={[{ required: true, message: 'Nhập tiêu đề email' }]}>
                                <Input placeholder="VD: Báo giá dịch vụ từ ERP4U - {{order_code}}" size="large" />
                            </Form.Item>
                            <Form.Item name="content" label={<span style={{fontWeight: 600}}>Nội dung Email (HTML)</span>} rules={[{ required: true }]}>
                                <RichTextEditor minHeight={400} />
                            </Form.Item>
                        </Form>
                    </Col>
                    <Col span={7}>
                        <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, height: '100%' }}>
                            <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 15 }}>Danh Sách Placeholder</div>
                            <p style={{ fontSize: 13, color: '#666', marginBottom: 16, lineHeight: 1.4 }}>
                                Dùng chung nhãn với Mẫu hợp đồng. Click để copy và dán vào tiêu đề hoặc nội dung.
                            </p>
                            <div style={{ maxHeight: 500, overflowY: 'auto', paddingRight: 4 }}>
                                <Space size={[8, 12]} wrap direction="vertical" style={{ width: '100%' }}>
                                    <div style={{ fontWeight: 600, fontSize: 11, color: '#999', textTransform: 'uppercase' }}>🔹 Khách hàng & Đơn hàng</div>
                                    {[
                                        { key: 'customer_name', desc: 'Tên Khách hàng' },
                                        { key: 'customer_email', desc: 'Email Khách hàng' },
                                        { key: 'order_code', desc: 'Mã Đơn hàng / Báo giá' },
                                        { key: 'order_date', desc: 'Ngày tạo' },
                                        { key: 'total_amount_text', desc: 'Tổng tiền (chữ)' },
                                    ].map(p => (
                                        <div key={p.key} style={{ display: 'flex', flexDirection: 'column' }}>
                                            <Tag color="blue" style={{ cursor: 'pointer', padding: '6px 12px', fontSize: 13, width: 'fit-content' }} onClick={() => {
                                                navigator.clipboard.writeText(`{{${p.key}}}`);
                                                message.success(`Đã copy: {{${p.key}}}`);
                                            }}>
                                                <Space size={4}><CopyOutlined style={{ opacity: 0.6 }} />{`{{${p.key}}}`}</Space>
                                            </Tag>
                                            <span style={{ fontSize: 12, color: '#888', marginTop: 4, marginLeft: 4 }}>{p.desc}</span>
                                        </div>
                                    ))}
                                    <Divider style={{ margin: '8px 0' }} orientation="left" plain><span style={{fontSize: 11, color: '#aaa'}}>🔸 Bên Bán</span></Divider>
                                    {[
                                        { key: 'seller_company_name', desc: 'Tên công ty' },
                                        { key: 'seller_phone', desc: 'Số điện thoại' },
                                        { key: 'seller_email', desc: 'Email' },
                                        { key: 'seller_website', desc: 'Website' },
                                    ].map(p => (
                                        <div key={p.key} style={{ display: 'flex', flexDirection: 'column' }}>
                                            <Tag color="orange" style={{ cursor: 'pointer', padding: '6px 12px', fontSize: 13, width: 'fit-content' }} onClick={() => {
                                                navigator.clipboard.writeText(`{{${p.key}}}`);
                                                message.success(`Đã copy: {{${p.key}}}`);
                                            }}>
                                                <Space size={4}><CopyOutlined style={{ opacity: 0.6 }} />{`{{${p.key}}}`}</Space>
                                            </Tag>
                                            <span style={{ fontSize: 12, color: '#888', marginTop: 4, marginLeft: 4 }}>{p.desc}</span>
                                        </div>
                                    ))}
                                    {customPlaceholders.length > 0 && <Divider style={{ margin: '8px 0' }} orientation="left" plain><span style={{fontSize: 11, color: '#aaa'}}>🟢 Tự định nghĩa</span></Divider>}
                                    {customPlaceholders.map(p => (
                                        <div key={p.key} style={{ display: 'flex', flexDirection: 'column' }}>
                                            <Tag color="green" style={{ cursor: 'pointer', padding: '6px 12px', fontSize: 13, width: 'fit-content' }} onClick={() => {
                                                navigator.clipboard.writeText(`{{${p.key}}}`);
                                                message.success(`Đã copy: {{${p.key}}}`);
                                            }}>
                                                <Space size={4}><CopyOutlined style={{ opacity: 0.6 }} />{`{{${p.key}}}`}</Space>
                                            </Tag>
                                            <span style={{ fontSize: 12, color: '#888', marginTop: 4, marginLeft: 4 }}>{p.desc}</span>
                                        </div>
                                    ))}
                                </Space>
                            </div>
                        </div>
                    </Col>
                </Row>
            </Modal>
        </div>
    );
};

const ApiKeysTab: React.FC = () => {
    const [tokens, setTokens] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [form] = Form.useForm();
    const [generatedKey, setGeneratedKey] = useState<string | null>(null);

    const fetchTokens = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/system/api-tokens`);
            setTokens(res.data);
        } catch (e) { message.error('Lỗi tải danh sách API Keys'); }
        setLoading(false);
    };

    useEffect(() => { fetchTokens(); }, []);

    const handleCreate = async (values: any) => {
        try {
            const res = await axios.post(`${API_URL}/system/api-tokens`, values);
            setGeneratedKey(res.data.api_key);
            message.success('Tạo API Key thành công');
            fetchTokens();
        } catch (e) { message.error('Lỗi khi tạo API Key'); }
    };

    const handleRevoke = async (id: number) => {
        try {
            await axios.delete(`${API_URL}/system/api-tokens/${id}`);
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
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                    <h3>Quản Lý API Keys</h3>
                    <p style={{ color: '#888', marginBottom: 0 }}>Cấp phát và thu hồi API Key cho các hệ thống Agent (Bot) tích hợp.</p>
                </div>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => { setGeneratedKey(null); form.resetFields(); setModalOpen(true); }}>Tạo API Key</Button>
            </div>

            <Table dataSource={tokens} columns={columns} rowKey="id" loading={loading} pagination={false} />

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

export default SystemSettingsPage;
