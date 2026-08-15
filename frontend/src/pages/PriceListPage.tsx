import React, { useEffect, useState } from 'react';
import { Table, Button, message, Card, Modal, Form, Input, DatePicker, Select, Tag, Drawer, Row, Col, InputNumber, Divider, Space, Typography } from 'antd';
import { PlusOutlined, SettingOutlined, CalendarOutlined, RiseOutlined, FallOutlined, TeamOutlined, RobotOutlined } from '@ant-design/icons';
import api from '../utils/api';
import AiPricingModal from '../components/AiPricingModal';
import dayjs from 'dayjs';
// API_URL is handled by api client baseURL

const { RangePicker } = DatePicker;
const { Title } = Typography;

const PriceListsPage: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [priceLists, setPriceLists] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [groups, setGroups] = useState<any[]>([]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formList] = Form.useForm();

    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [currentPriceList, setCurrentPriceList] = useState<any>(null);
    const [currentRules, setCurrentRules] = useState<any[]>([]);
    const [formRule] = Form.useForm();

    const [loadingRules, setLoadingRules] = useState(false);

    // AI States
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [aiProduct, setAiProduct] = useState<any>(null);

    // Load Data
    const fetchData = async () => {
        setLoading(true);
        try {
            const [resLists, resProds, resGroups] = await Promise.all([
                api.get('/sales/price-lists'),
                api.get('/products'),
                api.get('/users/groups')
            ]);
            setPriceLists(Array.isArray(resLists.data) ? resLists.data : []);
            setProducts(Array.isArray(resProds.data) ? resProds.data.map((p: any) => ({ label: `${p.sku} - ${p.name}`, value: p.sku })) : []);
            setGroups(Array.isArray(resGroups.data) ? resGroups.data : []);
        } catch (e) { message.error('Lỗi tải dữ liệu'); }
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    // Handle Create
    const handleCreateList = async (values: any) => {
        try {
            // Chuẩn hóa dữ liệu trước khi gửi
            const payload = {
                name: values.name,
                description: values.description,
                group_id: values.group_id, // Gửi group_id
                valid_from: values.validity[0].format('YYYY-MM-DD'),
                valid_to: values.validity[1].format('YYYY-MM-DD'),
                is_active: true
            };

            await api.post('/sales/price-lists', payload);
            message.success('Tạo bảng giá thành công');
            setIsModalOpen(false);
            fetchData(); // Reload ngay
        } catch (e) { message.error('Lỗi tạo bảng giá'); }
    };

    const openRulesDrawer = async (record: any) => {
        setCurrentPriceList(record);
        setIsDrawerOpen(true);
        fetchRules(record.id);
    };

    const fetchRules = async (listId: number) => {
        setLoadingRules(true);
        try {
            const res = await api.get(`/sales/price-lists/${listId}/rules`);
            setCurrentRules(res.data || []);
        } catch (e) { message.error('Lỗi tải quy tắc giá'); }
        setLoadingRules(false);
    };

    const handleAddRule = async (values: any) => {
        try {
            await api.post(`/sales/price-lists/${currentPriceList.id}/rules`, values);
            message.success('Đã thêm quy tắc giá');
            formRule.resetFields();
            fetchRules(currentPriceList.id);
        } catch (e: any) { message.error(e.response?.data?.message || 'Lỗi thêm quy tắc'); }
    };

    const openAiModal = () => {
        // Lấy thông tin sản phẩm đang chọn trong form
        const sku = formRule.getFieldValue('product_sku');
        if (!sku) return message.warning('Vui lòng chọn sản phẩm trước');

        const prod = products.find(p => p.value === sku);
        if (!prod) return message.error('Không tìm thấy thông tin sản phẩm');

        // FIX: Fetch product detail để lấy cost_price chính xác
        api.get(`/products/${prod.value}/sku`).then(res => {
            setAiProduct(res.data);
            setIsAiModalOpen(true);
        }).catch(() => message.error('Lỗi lấy giá vốn sản phẩm'));
    };

    const handleAiApply = (prices: any) => {
        formRule.setFieldsValue({
            price_100: prices.price_100,
            price_50: prices.price_50,
            price_30: prices.price_30,
            min_price: prices.min_price
        });
        message.success('Đã áp dụng giá đề xuất');
    };

    const listColumns = [
        {
            title: 'Tên Bảng Giá', dataIndex: 'name',
            render: (t: any) => <span style={{ fontWeight: 600, fontSize: 15, color: '#1890ff' }}>{t}</span>
        },
        {
            title: 'Áp dụng cho Nhóm', dataIndex: 'group_id',
            render: (gid: number) => {
                const g = groups.find((x: any) => x.id === gid);
                return g ? <Tag color="purple" icon={<TeamOutlined />}>{g.name}</Tag> : <Tag>ID: {gid}</Tag>;
            }
        },
        {
            title: 'Thời gian hiệu lực',
            render: (_: any, r: any) => (
                <Space>
                    <Tag icon={<CalendarOutlined />}>{dayjs(r.valid_from).format('DD/MM/YYYY')}</Tag>
                    →
                    <Tag>{dayjs(r.valid_to).format('DD/MM/YYYY')}</Tag>
                    {dayjs().isAfter(dayjs(r.valid_to)) && <Tag color="red">Hết hạn</Tag>}
                </Space>
            )
        },
        {
            title: 'Trạng thái', dataIndex: 'is_active',
            render: (act: boolean) => act ? <Tag color="success">Đang chạy</Tag> : <Tag>Dừng</Tag>
        },
        {
            title: '', key: 'action', align: 'right' as const,
            render: (_: any, r: any) => (
                <Button type="primary" ghost size="small" icon={<SettingOutlined />} onClick={() => openRulesDrawer(r)}>
                    Cấu hình giá
                </Button>
            )
        }
    ];

    const ruleColumns = [
        { title: 'Sản phẩm (SKU)', dataIndex: 'product_sku', width: 200, render: (t: any) => <b>{t}</b> },
        {
            title: 'Giá Sỉ (Tham khảo)',
            render: (_: any, r: any) => (
                <div style={{ fontSize: 13 }}>
                    <div>100 bộ: <b style={{ color: '#fa541c' }}>{Number(r.price_100).toLocaleString()} ₫</b></div>
                    <div>50 bộ: <b>{Number(r.price_50).toLocaleString()} ₫</b></div>
                    <div>30 bộ: <b>{Number(r.price_30).toLocaleString()} ₫</b></div>
                </div>
            )
        },
        {
            title: 'Giới hạn (Nếu có)',
            render: (_: any, r: any) => (
                <div style={{ fontSize: 12, color: '#888' }}>
                    {r.min_margin && <div>Lãi Min: {r.min_margin}%</div>}
                    {r.min_price && <div>Giá Min: {Number(r.min_price).toLocaleString()}</div>}
                </div>
            )
        }
    ];

    return (
        <div style={{ paddingBottom: 20 }}>
            <Card
                title={<Title level={4} style={{ margin: 0 }}>Quản Lý Bảng Giá Theo Nhóm (Price Lists)</Title>}
                extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => { setIsModalOpen(true); formList.resetFields() }}>Tạo Bảng Giá Mới</Button>}
                bordered={false}
                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
            >
                <Table dataSource={priceLists} columns={listColumns} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />
            </Card>

            {/* MODAL TẠO */}
            <Modal title="Thiết lập Bảng Giá Mới" open={isModalOpen} onCancel={() => setIsModalOpen(false)} onOk={() => formList.submit()}>
                <Form form={formList} layout="vertical" onFinish={handleCreateList}>
                    <Form.Item name="name" label="Tên Bảng Giá" rules={[{ required: true }]}><Input placeholder="VD: Giá bán lẻ - Nhóm Sale HN" /></Form.Item>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="group_id" label="Áp dụng cho Nhóm Quyền" rules={[{ required: true }]}>
                                <Select placeholder="Chọn nhóm áp dụng">
                                    {groups.map((g: any) => <Select.Option key={g.id} value={g.id}>{g.name}</Select.Option>)}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={12}><Form.Item name="validity" label="Thời gian hiệu lực" rules={[{ required: true }]}><RangePicker style={{ width: '100%' }} format="DD/MM/YYYY" /></Form.Item></Col>
                    </Row>
                    <Form.Item name="description" label="Mô tả"><Input.TextArea rows={2} /></Form.Item>
                </Form>
            </Modal>

            {/* DRAWER RULES */}
            <Drawer title={currentPriceList ? `Cấu hình chi tiết: ${currentPriceList.name}` : 'Chi tiết Bảng Giá'} width={800} open={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} bodyStyle={{ paddingTop: 10, background: '#f0f2f5' }}>
                <div style={{ background: '#fff', padding: 20, borderRadius: 8, marginBottom: 15, boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                        <div style={{ fontWeight: 600, color: '#0050b3', textTransform: 'uppercase', fontSize: 13 }}>Thêm / Cập nhật Giá Sỉ</div>
                        <Button type="dashed" size="small" icon={<RobotOutlined style={{ color: '#1890ff' }} />} onClick={openAiModal}>AI Trợ Giá</Button>
                    </div>

                    <Form form={formRule} layout="vertical" onFinish={handleAddRule}>
                        <Row gutter={16}>
                            <Col span={16}>
                                <Form.Item name="product_sku" label="Sản phẩm áp dụng" rules={[{ required: true }]}>
                                    <Select
                                        showSearch
                                        options={products}
                                        placeholder="Tìm kiếm SKU hoặc Tên sản phẩm..."
                                        optionFilterProp="label"
                                        filterOption={(input: string, option: any) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                                    />
                                </Form.Item>
                            </Col>
                            <Col span={8}><Form.Item label=" " colon={false}><Button type="primary" htmlType="submit" icon={<PlusOutlined />} block>Lưu Cấu Hình</Button></Form.Item></Col>
                        </Row>

                        <Divider orientation="left" style={{ margin: '5px 0 15px 0', fontSize: 13, color: '#fa541c' }}>Bảng Giá Sỉ (Đề xuất)</Divider>
                        <Row gutter={16}>
                            <Col span={8}>
                                <Form.Item name="price_100" label="Giá (SL 100) - Giá Gốc" rules={[{ required: true }]}>
                                    <InputNumber style={{ width: '100%' }} formatter={(v: any) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} placeholder="0" />
                                </Form.Item>
                                <div style={{ fontSize: 11, color: '#888', marginTop: -5 }}>Đây là giá tham chiếu gốc</div>
                            </Col>
                            <Col span={8}>
                                <Form.Item name="price_50" label="Giá (SL 50)">
                                    <InputNumber style={{ width: '100%' }} formatter={(v: any) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} placeholder="0" />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item name="price_30" label="Giá (SL 30)">
                                    <InputNumber style={{ width: '100%' }} formatter={(v: any) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} placeholder="0" />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Divider orientation="left" style={{ margin: '15px 0 15px 0', fontSize: 12 }}>Giới hạn (Tùy chọn)</Divider>
                        <Row gutter={16}>
                            <Col span={6}><Form.Item name="min_price" label="Giá Min (₫)"><InputNumber style={{ width: '100%' }} formatter={(v: any) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} placeholder="Thấp nhất" /></Form.Item></Col>
                            <Col span={6}><Form.Item name="min_margin" label="Margin Min (%)"><InputNumber style={{ width: '100%' }} placeholder="Lãi min" /></Form.Item></Col>
                        </Row>
                    </Form>
                </div>
                <Table dataSource={currentRules} columns={ruleColumns} rowKey="id" loading={loadingRules} size="small" pagination={{ pageSize: 10 }} style={{ background: '#fff', borderRadius: 8 }} />
            </Drawer>

            <AiPricingModal
                open={isAiModalOpen}
                onClose={() => setIsAiModalOpen(false)}
                productName={aiProduct?.name}
                costPrice={Number(aiProduct?.cost_price) || 0}
                onApply={handleAiApply}
            />
        </div>
    );
};

export default PriceListsPage;