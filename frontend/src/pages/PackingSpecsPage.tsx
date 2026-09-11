import React, { useEffect, useState, useMemo } from 'react';
import { 
    Table, Card, Button, Modal, Form, Input, InputNumber, Select, 
    Tag, Space, Popconfirm, message, Typography, Row, Col, Alert, Tooltip 
} from 'antd';
import { 
    PlusOutlined, EditOutlined, DeleteOutlined, InboxOutlined, 
    CalculatorOutlined, WarningOutlined, InfoCircleOutlined, ReloadOutlined 
} from '@ant-design/icons';
import api from '../utils/api';

const { Title, Text } = Typography;
const { Option } = Select;

interface PackingSpec {
    id: number;
    category_id?: number;
    category?: { id: number; name: string; code: string };
    category_ids?: number[];
    categories?: Array<{ id: number; name: string; code: string }>;
    product_id?: number;
    product?: { id: number; name: string; sku: string };
    product_ids?: number[];
    products?: Array<{ id: number; name: string; sku: string }>;
    name: string;
    package_type: string;
    quantity_per_package: number;
    length_cm: number;
    width_cm: number;
    height_cm: number;
    weight_gram: number;
    volumetric_weight_gram: number;
    note?: string;
    is_default?: boolean;
    created_at?: string;
}

const PackingSpecsPage: React.FC = () => {
    const [specs, setSpecs] = useState<PackingSpec[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [filterCategoryId, setFilterCategoryId] = useState<number | undefined>(undefined);
    const [searchText, setSearchText] = useState<string>('');

    // Modal state
    const [modalOpen, setModalOpen] = useState<boolean>(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [saving, setSaving] = useState<boolean>(false);
    const [form] = Form.useForm();

    // Form watched values for real-time calculation
    const watchLength = Form.useWatch('length_cm', form);
    const watchWidth = Form.useWatch('width_cm', form);
    const watchHeight = Form.useWatch('height_cm', form);
    const watchActualWeight = Form.useWatch('weight_gram', form);

    // Tính toán thể tích quy đổi realtime
    const calculatedVolumetricGram = useMemo(() => {
        const l = Number(watchLength) || 0;
        const w = Number(watchWidth) || 0;
        const h = Number(watchHeight) || 0;
        if (!l || !w || !h) return 0;
        return Math.round((l * w * h) / 6);
    }, [watchLength, watchWidth, watchHeight]);

    const isBulkyWarning = useMemo(() => {
        const l = Number(watchLength) || 0;
        const w = Number(watchWidth) || 0;
        const h = Number(watchHeight) || 0;
        const actual = Number(watchActualWeight) || 0;
        const maxWeight = Math.max(actual, calculatedVolumetricGram);
        return l > 100 || w > 100 || h > 100 || maxWeight > 20000;
    }, [watchLength, watchWidth, watchHeight, watchActualWeight, calculatedVolumetricGram]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [specRes, catRes, prodRes] = await Promise.all([
                api.get('/products/packing-specs'),
                api.get('/categories'),
                api.get('/products')
            ]);
            setSpecs(Array.isArray(specRes.data) ? specRes.data : []);
            setCategories(Array.isArray(catRes.data) ? catRes.data : []);
            setProducts(Array.isArray(prodRes.data) ? prodRes.data : []);
        } catch (e: any) {
            message.error(e.response?.data?.message || 'Lỗi khi tải dữ liệu quy cách đóng gói');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleOpenCreate = () => {
        setEditingId(null);
        form.resetFields();
        form.setFieldsValue({
            category_ids: [],
            product_ids: [],
            package_type: 'Bao tải',
            quantity_per_package: 1,
            length_cm: 0,
            width_cm: 0,
            height_cm: 0,
            weight_gram: 0,
            is_default: false
        });
        setModalOpen(true);
    };

    const handleOpenEdit = (record: PackingSpec) => {
        setEditingId(record.id);
        form.resetFields();

        const catIds = Array.isArray(record.category_ids) && record.category_ids.length > 0
            ? record.category_ids
            : (record.category_id ? [record.category_id] : []);

        const prodIds = Array.isArray(record.product_ids) && record.product_ids.length > 0
            ? record.product_ids
            : (record.product_id ? [record.product_id] : []);

        form.setFieldsValue({
            category_ids: catIds,
            product_ids: prodIds,
            name: record.name,
            package_type: record.package_type || 'Bao tải',
            quantity_per_package: record.quantity_per_package,
            length_cm: record.length_cm,
            width_cm: record.width_cm,
            height_cm: record.height_cm,
            weight_gram: record.weight_gram,
            note: record.note,
            is_default: record.is_default
        });
        setModalOpen(true);
    };

    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            setSaving(true);
            const payload = {
                ...values,
                volumetric_weight_gram: calculatedVolumetricGram
            };

            if (editingId) {
                await api.put(`/products/packing-specs/${editingId}`, payload);
                message.success('Đã cập nhật quy cách đóng gói');
            } else {
                await api.post('/products/packing-specs', payload);
                message.success('Đã thêm quy cách đóng gói mới');
            }

            setModalOpen(false);
            fetchData();
        } catch (e: any) {
            if (e.errorFields) return; // Validation error
            message.error(e.response?.data?.message || 'Không thể lưu quy cách đóng gói');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await api.delete(`/products/packing-specs/${id}`);
            message.success('Đã xóa quy cách đóng gói');
            fetchData();
        } catch (e: any) {
            message.error(e.response?.data?.message || 'Không thể xóa');
        }
    };

    // Filter specs
    const filteredSpecs = useMemo(() => {
        return specs.filter(s => {
            const catIds = Array.isArray(s.category_ids) && s.category_ids.length > 0
                ? s.category_ids
                : (s.category_id ? [s.category_id] : []);
            const matchCat = filterCategoryId ? (catIds.length === 0 || catIds.includes(filterCategoryId)) : true;
            const search = searchText.trim().toLowerCase();
            const catNames = (s.categories || []).map(c => c.name).join(' ').toLowerCase();
            const prodNames = (s.products || []).map(p => `${p.sku} ${p.name}`).join(' ').toLowerCase();
            const matchSearch = !search || 
                s.name.toLowerCase().includes(search) || 
                catNames.includes(search) ||
                prodNames.includes(search) ||
                (s.category?.name || '').toLowerCase().includes(search) ||
                (s.product?.name || '').toLowerCase().includes(search) ||
                (s.product?.sku || '').toLowerCase().includes(search) ||
                (s.package_type || '').toLowerCase().includes(search);
            return matchCat && matchSearch;
        });
    }, [specs, filterCategoryId, searchText]);

    const columns = [
        {
            title: 'Tên quy cách',
            dataIndex: 'name',
            key: 'name',
            render: (text: string, r: PackingSpec) => (
                <div>
                    <Text strong style={{ color: '#1890ff', fontSize: 14 }}>{text}</Text>
                    {r.package_type && (
                        <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                            Loại bao bì: <Tag color="blue">{r.package_type}</Tag>
                        </div>
                    )}
                </div>
            )
        },
        {
            title: 'Loại sản phẩm áp dụng',
            key: 'categories',
            render: (_: any, r: PackingSpec) => {
                const catList = r.categories && r.categories.length > 0 
                    ? r.categories 
                    : (r.category ? [r.category] : []);
                const prodList = r.products && r.products.length > 0
                    ? r.products
                    : (r.product ? [r.product] : []);

                if (catList.length === 0 && prodList.length === 0) {
                    return <Tag color="default">🌐 Tất cả sản phẩm</Tag>;
                }

                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {catList.length > 0 && (
                            <Space wrap size={[4, 4]}>
                                {catList.map(c => (
                                    <Tag color="purple" key={c.id} style={{ margin: 0 }}>
                                        {c.name}
                                    </Tag>
                                ))}
                            </Space>
                        )}
                        {prodList.length > 0 && (
                            <Space wrap size={[4, 4]}>
                                {prodList.map(p => (
                                    <Tag color="geekblue" key={p.id} style={{ margin: 0 }}>
                                        SP: {p.sku || p.name}
                                    </Tag>
                                ))}
                            </Space>
                        )}
                    </div>
                );
            }
        },
        {
            title: 'SL / Kiện',
            dataIndex: 'quantity_per_package',
            key: 'quantity_per_package',
            width: 100,
            align: 'center' as const,
            render: (val: number) => <Tag color="cyan" style={{ fontSize: 13, fontWeight: 600 }}>{val} bộ/sp</Tag>
        },
        {
            title: 'Kích thước DxRxC (cm)',
            key: 'dimensions',
            width: 180,
            render: (_: any, r: PackingSpec) => (
                <div>
                    <span style={{ fontWeight: 500 }}>{r.length_cm} × {r.width_cm} × {r.height_cm}</span> cm
                    <div style={{ fontSize: 11, color: '#8c8c8c' }}>
                        Thể tích: {((Number(r.length_cm) * Number(r.width_cm) * Number(r.height_cm)) / 1000).toFixed(1)} dm³
                    </div>
                </div>
            )
        },
        {
            title: 'Cân nặng thực tế',
            dataIndex: 'weight_gram',
            key: 'weight_gram',
            width: 130,
            align: 'right' as const,
            render: (val: number) => (
                <div>
                    <b>{Number(val).toLocaleString()}</b> g
                    <div style={{ fontSize: 11, color: '#8c8c8c' }}>({(val / 1000).toFixed(2)} kg)</div>
                </div>
            )
        },
        {
            title: 'Thể tích quy đổi',
            dataIndex: 'volumetric_weight_gram',
            key: 'volumetric_weight_gram',
            width: 140,
            align: 'right' as const,
            render: (val: number) => (
                <div>
                    <b style={{ color: '#d46b08' }}>{Number(val).toLocaleString()}</b> g
                    <div style={{ fontSize: 11, color: '#d46b08' }}>({(val / 1000).toFixed(2)} kg)</div>
                </div>
            )
        },
        {
            title: 'Trọng lượng tính cước',
            key: 'billable_weight',
            width: 160,
            render: (_: any, r: PackingSpec) => {
                const maxGram = Math.max(Number(r.weight_gram || 0), Number(r.volumetric_weight_gram || 0));
                const isVolumetricLarger = Number(r.volumetric_weight_gram || 0) > Number(r.weight_gram || 0);
                const isBulky = Number(r.length_cm) > 100 || Number(r.width_cm) > 100 || Number(r.height_cm) > 100 || maxGram > 20000;
                
                return (
                    <div>
                        <Tag color={isVolumetricLarger ? 'orange' : 'blue'} style={{ fontSize: 12, fontWeight: 600 }}>
                            {maxGram.toLocaleString()} g ({(maxGram / 1000).toFixed(2)} kg)
                        </Tag>
                        {isBulky && (
                            <div style={{ marginTop: 3 }}>
                                <Tooltip title="Kiện hàng có cạnh > 100cm hoặc nặng > 20kg: GHTK Express có thể tính phụ phí cồng kềnh BBS hoặc cần tự điều phối xe">
                                    <Tag color="volcano" icon={<WarningOutlined />} style={{ fontSize: 10 }}>Cồng kềnh BBS</Tag>
                                </Tooltip>
                            </div>
                        )}
                    </div>
                );
            }
        },
        {
            title: 'Ghi chú',
            dataIndex: 'note',
            key: 'note',
            render: (text: string) => text ? <span style={{ color: '#595959', fontSize: 12 }}>{text}</span> : <Text type="secondary">—</Text>
        },
        {
            title: 'Thao tác',
            key: 'action',
            width: 110,
            align: 'center' as const,
            render: (_: any, record: PackingSpec) => (
                <Space>
                    <Button 
                        size="small" 
                        icon={<EditOutlined />} 
                        onClick={() => handleOpenEdit(record)} 
                    />
                    <Popconfirm 
                        title="Xóa quy cách này?" 
                        onConfirm={() => handleDelete(record.id)}
                        okText="Xóa"
                        cancelText="Hủy"
                        okButtonProps={{ danger: true }}
                    >
                        <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <div style={{ padding: '16px 24px' }}>
            <Card style={{ marginBottom: 16, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <Row justify="space-between" align="middle" gutter={[16, 16]}>
                    <Col xs={24} sm={12}>
                        <Space align="center" size="middle">
                            <div style={{ background: '#e6f7ff', padding: 10, borderRadius: 8, color: '#1890ff', fontSize: 24 }}>
                                <InboxOutlined />
                            </div>
                            <div>
                                <Title level={4} style={{ margin: 0 }}>Quy Cách Đóng Gói (Packing List)</Title>
                                <Text type="secondary">
                                    Cấu hình số lượng, kích thước kiện Dài × Rộng × Cao và trọng lượng thể tích tự động cho từng loại sản phẩm
                                </Text>
                            </div>
                        </Space>
                    </Col>
                    <Col xs={24} sm={12} style={{ textAlign: 'right' }}>
                        <Space wrap>
                            <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>Làm mới</Button>
                            <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
                                Thêm Quy Cách Mới
                            </Button>
                        </Space>
                    </Col>
                </Row>
            </Card>

            <Card style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <Row gutter={[16, 16]} style={{ marginBottom: 16 }} align="middle">
                    <Col xs={24} sm={8}>
                        <Input.Search 
                            placeholder="Tìm quy cách, danh mục, bao bì..." 
                            value={searchText} 
                            onChange={e => setSearchText(e.target.value)} 
                            allowClear 
                        />
                    </Col>
                    <Col xs={24} sm={8}>
                        <Select
                            style={{ width: '100%' }}
                            placeholder="Lọc theo Loại SP / Danh mục"
                            value={filterCategoryId}
                            onChange={setFilterCategoryId}
                            allowClear
                        >
                            {categories.map(c => (
                                <Option key={c.id} value={c.id}>{c.name}</Option>
                            ))}
                        </Select>
                    </Col>
                    <Col xs={24} sm={8} style={{ textAlign: 'right' }}>
                        <Text type="secondary">
                            Hiển thị: <b>{filteredSpecs.length}</b> / {specs.length} quy cách
                        </Text>
                    </Col>
                </Row>

                <Alert
                    style={{ marginBottom: 16 }}
                    type="info"
                    showIcon
                    icon={<CalculatorOutlined />}
                    message={
                        <span>
                            <b>Chuẩn quy đổi GHTK:</b> Trọng lượng thể tích = <code>(Dài × Rộng × Cao) / 6000 kg</code> (hoặc chia 6 tính bằng gram). Cước phí vận chuyển sẽ tự động tính theo số lớn hơn giữa cân nặng thực tế và thể tích quy đổi. Người dùng có thể tùy chỉnh manual trên từng phiếu xuất kho.
                        </span>
                    }
                />

                <Table 
                    columns={columns} 
                    dataSource={filteredSpecs} 
                    rowKey="id" 
                    loading={loading}
                    pagination={{ pageSize: 15, showTotal: (total) => `Tổng ${total} quy cách đóng gói` }}
                    bordered
                    size="middle"
                />
            </Card>

            {/* MODAL THÊM / SỬA QUY CÁCH */}
            <Modal
                title={
                    <Space>
                        <InboxOutlined style={{ color: '#1890ff' }} />
                        <span>{editingId ? 'Chỉnh Sửa Quy Cách Đóng Gói' : 'Thêm Mới Quy Cách Đóng Gói'}</span>
                    </Space>
                }
                open={modalOpen}
                onOk={handleSave}
                onCancel={() => setModalOpen(false)}
                confirmLoading={saving}
                width={650}
                destroyOnClose
            >
                <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
                    <Row gutter={12}>
                        <Col span={14}>
                            <Form.Item 
                                name="name" 
                                label="Tên quy cách đóng gói" 
                                rules={[{ required: true, message: 'Vui lòng nhập tên quy cách (VD: 05 bộ/kiện)' }]}
                            >
                                <Input placeholder="VD: 01 bộ/kiện, 05 bộ/kiện, 10 bộ/kiện..." />
                            </Form.Item>
                        </Col>
                        <Col span={10}>
                            <Form.Item name="package_type" label="Loại bao bì / Đóng gói">
                                <Select placeholder="Chọn bao bì">
                                    <Option value="Bao tải">Bao tải dứa</Option>
                                    <Option value="Thùng carton">Thùng carton</Option>
                                    <Option value="Màng PE quấn">Màng PE quấn màng co</Option>
                                    <Option value="Túi PE">Túi PE bóng</Option>
                                    <Option value="Kiện gỗ">Kiện gỗ / Pallet</Option>
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={12}>
                        <Col span={14}>
                            <Form.Item 
                                name="category_ids" 
                                label="Loại sản phẩm áp dụng (Chọn nhiều loại / Multi-choice)"
                                help="Chọn một hoặc nhiều loại SP. Để trống nếu áp dụng chung cho mọi loại SP."
                            >
                                <Select 
                                    mode="multiple" 
                                    placeholder="Chọn một hoặc nhiều loại sản phẩm..." 
                                    allowClear
                                    maxTagCount="responsive"
                                    style={{ width: '100%' }}
                                >
                                    {categories.map(c => (
                                        <Option key={c.id} value={c.id}>{c.name}</Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={10}>
                            <Form.Item 
                                name="quantity_per_package" 
                                label="Số lượng SP trong 1 kiện" 
                                rules={[{ required: true, message: 'Nhập số lượng SP' }]}
                            >
                                <InputNumber style={{ width: '100%' }} min={1} addonAfter="bộ/sp" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={12}>
                        <Col span={24}>
                            <Form.Item 
                                name="product_ids" 
                                label="Sản phẩm cụ thể áp dụng (Tùy chọn - Multi-choice)"
                                help="Tùy chọn: Chọn nếu chỉ muốn giới hạn cho một số mã sản phẩm cụ thể."
                            >
                                <Select 
                                    mode="multiple" 
                                    placeholder="Chọn các sản phẩm cụ thể nếu cần..." 
                                    allowClear
                                    maxTagCount="responsive"
                                    showSearch
                                    filterOption={(input, option) =>
                                        String(option?.children || '').toLowerCase().includes(input.toLowerCase())
                                    }
                                    style={{ width: '100%' }}
                                >
                                    {products.map(p => (
                                        <Option key={p.id} value={p.id}>{p.sku} - {p.name}</Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>

                    <Card size="small" style={{ background: '#f9f9f9', marginBottom: 16, border: '1px solid #e8e8e8', borderRadius: 6 }}>
                        <div style={{ fontWeight: 600, color: '#1890ff', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <CalculatorOutlined /> Kích thước & Trọng lượng kiện hàng:
                        </div>
                        <Row gutter={12}>
                            <Col span={8}>
                                <Form.Item 
                                    name="length_cm" 
                                    label="Dài (cm)" 
                                    rules={[{ required: true, message: 'Nhập chiều dài' }]}
                                    style={{ marginBottom: 8 }}
                                >
                                    <InputNumber style={{ width: '100%' }} min={0} placeholder="VD: 130" addonAfter="cm" />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item 
                                    name="width_cm" 
                                    label="Rộng (cm)" 
                                    rules={[{ required: true, message: 'Nhập chiều rộng' }]}
                                    style={{ marginBottom: 8 }}
                                >
                                    <InputNumber style={{ width: '100%' }} min={0} placeholder="VD: 90" addonAfter="cm" />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item 
                                    name="height_cm" 
                                    label="Cao (cm)" 
                                    rules={[{ required: true, message: 'Nhập chiều cao' }]}
                                    style={{ marginBottom: 8 }}
                                >
                                    <InputNumber style={{ width: '100%' }} min={0} placeholder="VD: 25" addonAfter="cm" />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Row gutter={12} style={{ marginTop: 8 }}>
                            <Col span={12}>
                                <Form.Item 
                                    name="weight_gram" 
                                    label="Cân nặng thực tế (ước tính)"
                                    style={{ marginBottom: 8 }}
                                >
                                    <InputNumber 
                                        style={{ width: '100%' }} 
                                        min={0} 
                                        placeholder="0" 
                                        addonAfter="gram" 
                                        formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                    />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <div style={{ fontSize: 12, color: '#555', marginBottom: 4, fontWeight: 500 }}>Thể tích quy đổi (tự tính):</div>
                                <div style={{ padding: '5px 10px', background: '#fff', border: '1px solid #d9d9d9', borderRadius: 4, height: 32, display: 'flex', alignItems: 'center' }}>
                                    <Text strong style={{ color: '#d46b08' }}>
                                        {calculatedVolumetricGram.toLocaleString()} gram
                                    </Text>
                                    <Text type="secondary" style={{ marginLeft: 6, fontSize: 12 }}>
                                        ({(calculatedVolumetricGram / 1000).toFixed(2)} kg)
                                    </Text>
                                </div>
                            </Col>
                        </Row>

                        {/* Realtime summary & Bulky Warning */}
                        <div style={{ marginTop: 8, padding: '8px 12px', background: '#e6f7ff', borderRadius: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 12 }}>
                                ⚖️ Trọng lượng tính cước: <b>{Math.max(Number(watchActualWeight) || 0, calculatedVolumetricGram).toLocaleString()} gram</b>
                            </span>
                            <span style={{ fontSize: 12, color: '#595959' }}>
                                Công thức: Max(Thực tế, Quy đổi)
                            </span>
                        </div>

                        {isBulkyWarning && (
                            <Alert
                                style={{ marginTop: 8 }}
                                type="warning"
                                showIcon
                                message={
                                    <span style={{ fontSize: 12 }}>
                                        <b>Cảnh báo hàng cồng kềnh (BBS):</b> Kiện hàng có cạnh &gt; 100cm hoặc trọng lượng &gt; 20kg. Khi xuất kho hệ thống sẽ thông báo để người dùng tự điều phối (chia nhiều kiện nhỏ hoặc xe tải riêng).
                                    </span>
                                }
                            />
                        )}
                    </Card>

                    <Form.Item name="note" label="Ghi chú hướng dẫn đóng gói">
                        <Input.TextArea rows={2} placeholder="VD: Gấp đôi nệm, bọc màng co trước khi cho vào bao tải..." />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default PackingSpecsPage;
