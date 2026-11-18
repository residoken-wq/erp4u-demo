import React, { useEffect, useState, useCallback } from 'react';
import { Table, Button, Modal, Form, Input, Select, InputNumber, DatePicker, Switch, Space, Tag, message, Popconfirm, Card, Typography, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, GiftOutlined, ReloadOutlined } from '@ant-design/icons';
import api from '../utils/api';
import dayjs from 'dayjs';

const { Title } = Typography;
const { RangePicker } = DatePicker;
const { TextArea } = Input;

interface Promotion {
    id: number;
    name: string;
    description: string;
    discount_type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'BUY_X_GET_Y';
    discount_value: number;
    start_date: string;
    end_date: string;
    is_active: boolean;
    applicable_customer_ids: number[];
    applicable_product_ids: number[];
    min_quantity: number | null;
    min_order_value: number | null;
    max_uses: number | null;
    used_count: number;
    created_at: string;
}

const DISCOUNT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
    PERCENTAGE: { label: 'Giảm %', color: 'blue' },
    FIXED_AMOUNT: { label: 'Giảm tiền', color: 'green' },
    BUY_X_GET_Y: { label: 'Mua X tặng Y', color: 'purple' },
};

const PromotionPage: React.FC = () => {
    const [promotions, setPromotions] = useState<Promotion[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editItem, setEditItem] = useState<Promotion | null>(null);
    const [saving, setSaving] = useState(false);
    const [form] = Form.useForm();
    const [customers, setCustomers] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);

    const fetchPromotions = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get(`/sales/promotions`);
            setPromotions(res.data || []);
        } catch (e) {
            console.error('Error:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchMasterData = useCallback(async () => {
        try {
            const [custRes, prodRes] = await Promise.all([
                api.get(`/customers`),
                api.get(`/products`),
            ]);
            setCustomers(custRes.data || []);
            setProducts(prodRes.data || []);
        } catch (e) {
            console.error('Error fetching master data:', e);
        }
    }, []);

    useEffect(() => {
        fetchPromotions();
        fetchMasterData();
    }, [fetchPromotions, fetchMasterData]);

    const handleOpenCreate = () => {
        setEditItem(null);
        form.resetFields();
        form.setFieldsValue({
            is_active: true,
            discount_type: 'PERCENTAGE',
            discount_value: 0,
            applicable_customer_ids: [],
            applicable_product_ids: [],
        });
        setModalOpen(true);
    };

    const handleOpenEdit = (record: Promotion) => {
        setEditItem(record);
        form.setFieldsValue({
            ...record,
            date_range: record.start_date && record.end_date
                ? [dayjs(record.start_date), dayjs(record.end_date)]
                : undefined,
        });
        setModalOpen(true);
    };

    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            setSaving(true);

            const payload = {
                name: values.name,
                description: values.description,
                discount_type: values.discount_type,
                discount_value: values.discount_value,
                start_date: values.date_range?.[0]?.format('YYYY-MM-DD'),
                end_date: values.date_range?.[1]?.format('YYYY-MM-DD'),
                is_active: values.is_active,
                applicable_customer_ids: values.applicable_customer_ids || [],
                applicable_product_ids: values.applicable_product_ids || [],
                min_quantity: values.min_quantity || null,
                min_order_value: values.min_order_value || null,
                max_uses: values.max_uses || null,
            };

            if (editItem) {
                await api.put(`/sales/promotions/${editItem.id}`, payload);
                message.success('Cập nhật khuyến mãi thành công');
            } else {
                await api.post(`/sales/promotions`, payload);
                message.success('Tạo khuyến mãi thành công');
            }

            setModalOpen(false);
            fetchPromotions();
        } catch (e: any) {
            if (e.errorFields) return; // form validation
            message.error('Có lỗi xảy ra');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await api.delete(`/sales/promotions/${id}`);
            message.success('Đã xóa khuyến mãi');
            fetchPromotions();
        } catch (e) {
            message.error('Lỗi xóa khuyến mãi');
        }
    };

    const columns = [
        {
            title: 'Tên chương trình',
            dataIndex: 'name',
            key: 'name',
            width: 200,
            render: (text: string, record: Promotion) => (
                <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1a1a' }}>{text}</div>
                    {record.description && (
                        <div style={{ fontSize: 12, color: '#888', marginTop: 2, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {record.description}
                        </div>
                    )}
                </div>
            ),
        },
        {
            title: 'Loại',
            dataIndex: 'discount_type',
            key: 'discount_type',
            width: 110,
            render: (type: string) => {
                const info = DISCOUNT_TYPE_LABELS[type] || { label: type, color: 'default' };
                return <Tag color={info.color}>{info.label}</Tag>;
            },
        },
        {
            title: 'Giá trị',
            dataIndex: 'discount_value',
            key: 'discount_value',
            width: 100,
            align: 'center' as const,
            render: (val: number, record: Promotion) => (
                <span style={{ fontWeight: 700, fontSize: 15, color: '#fa8c16' }}>
                    {record.discount_type === 'PERCENTAGE' ? `${val}%` : `${Number(val).toLocaleString('vi-VN')}đ`}
                </span>
            ),
        },
        {
            title: 'Thời gian',
            key: 'date_range',
            width: 180,
            render: (_: any, record: Promotion) => (
                <div style={{ fontSize: 12 }}>
                    <div>{dayjs(record.start_date).format('DD/MM/YYYY')}</div>
                    <div style={{ color: '#aaa' }}>→ {dayjs(record.end_date).format('DD/MM/YYYY')}</div>
                </div>
            ),
        },
        {
            title: 'KH',
            key: 'customers',
            width: 80,
            align: 'center' as const,
            render: (_: any, record: Promotion) => {
                const count = (record.applicable_customer_ids || []).length;
                return count === 0
                    ? <Tag color="green">Tất cả</Tag>
                    : <Tooltip title={`${count} khách hàng`}><Tag>{count} KH</Tag></Tooltip>;
            },
        },
        {
            title: 'SP',
            key: 'products',
            width: 80,
            align: 'center' as const,
            render: (_: any, record: Promotion) => {
                const count = (record.applicable_product_ids || []).length;
                return count === 0
                    ? <Tag color="green">Tất cả</Tag>
                    : <Tooltip title={`${count} sản phẩm`}><Tag>{count} SP</Tag></Tooltip>;
            },
        },
        {
            title: 'Đã dùng',
            key: 'usage',
            width: 90,
            align: 'center' as const,
            render: (_: any, record: Promotion) => (
                <span style={{ fontSize: 13 }}>
                    {record.used_count}{record.max_uses ? `/${record.max_uses}` : ''}
                </span>
            ),
        },
        {
            title: 'Active',
            dataIndex: 'is_active',
            key: 'is_active',
            width: 70,
            align: 'center' as const,
            render: (val: boolean) => val
                ? <Tag color="success">ON</Tag>
                : <Tag color="default">OFF</Tag>,
        },
        {
            title: '',
            key: 'actions',
            width: 100,
            render: (_: any, record: Promotion) => (
                <Space>
                    <Button size="small" icon={<EditOutlined />} onClick={() => handleOpenEdit(record)} />
                    <Popconfirm
                        title="Xóa khuyến mãi này?"
                        onConfirm={() => handleDelete(record.id)}
                        okText="Xóa"
                        cancelText="Hủy"
                    >
                        <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Title level={4} style={{ margin: 0 }}>
                    <GiftOutlined style={{ color: '#fa8c16', marginRight: 8 }} />
                    Quản Lý Khuyến Mãi
                </Title>
                <Space>
                    <Button icon={<ReloadOutlined />} onClick={fetchPromotions}>Làm mới</Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
                        Tạo Khuyến Mãi
                    </Button>
                </Space>
            </div>

            <Card bodyStyle={{ padding: 0 }}>
                <Table
                    dataSource={promotions}
                    columns={columns}
                    loading={loading}
                    rowKey="id"
                    pagination={{ pageSize: 20, showSizeChanger: false }}
                    size="small"
                    scroll={{ x: 900 }}
                />
            </Card>

            {/* === MODAL CREATE/EDIT === */}
            <Modal
                title={editItem ? '✏️ Sửa Khuyến Mãi' : '🎁 Tạo Khuyến Mãi Mới'}
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                onOk={handleSave}
                confirmLoading={saving}
                okText={editItem ? 'Cập nhật' : 'Tạo'}
                cancelText="Hủy"
                width={700}
                destroyOnClose
            >
                <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
                    <Form.Item name="name" label="Tên chương trình" rules={[{ required: true, message: 'Nhập tên' }]}>
                        <Input placeholder="VD: Giảm 10% cho đơn trên 50 triệu" />
                    </Form.Item>

                    <Form.Item name="description" label="Mô tả">
                        <TextArea rows={2} placeholder="Mô tả chi tiết chương trình khuyến mãi..." />
                    </Form.Item>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <Form.Item name="discount_type" label="Loại giảm giá" rules={[{ required: true }]}>
                            <Select>
                                <Select.Option value="PERCENTAGE">Giảm theo %</Select.Option>
                                <Select.Option value="FIXED_AMOUNT">Giảm số tiền cố định</Select.Option>
                                <Select.Option value="BUY_X_GET_Y">Mua X tặng Y</Select.Option>
                            </Select>
                        </Form.Item>

                        <Form.Item name="discount_value" label="Giá trị giảm" rules={[{ required: true }]}>
                            <InputNumber
                                min={0}
                                style={{ width: '100%' }}
                                formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                placeholder="VD: 10 (%) hoặc 500000 (đ)"
                            />
                        </Form.Item>
                    </div>

                    <Form.Item name="date_range" label="Thời gian áp dụng" rules={[{ required: true, message: 'Chọn thời gian' }]}>
                        <RangePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                    </Form.Item>

                    <Form.Item name="applicable_customer_ids" label="Khách hàng áp dụng (để trống = tất cả)">
                        <Select
                            mode="multiple"
                            allowClear
                            placeholder="Chọn khách hàng..."
                            filterOption={(input, option) =>
                                (option?.label as string)?.toLowerCase()?.includes(input.toLowerCase())
                            }
                            options={customers.map((c: any) => ({
                                value: c.id,
                                label: `${c.name} (${c.code || ''})`,
                            }))}
                            maxTagCount={5}
                        />
                    </Form.Item>

                    <Form.Item name="applicable_product_ids" label="Sản phẩm áp dụng (để trống = tất cả)">
                        <Select
                            mode="multiple"
                            allowClear
                            placeholder="Chọn sản phẩm..."
                            filterOption={(input, option) =>
                                (option?.label as string)?.toLowerCase()?.includes(input.toLowerCase())
                            }
                            options={products.map((p: any) => ({
                                value: p.id,
                                label: `${p.name} (${p.sku || ''})`,
                            }))}
                            maxTagCount={5}
                        />
                    </Form.Item>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                        <Form.Item name="min_quantity" label="SL tối thiểu">
                            <InputNumber min={0} style={{ width: '100%' }} placeholder="Không giới hạn" />
                        </Form.Item>
                        <Form.Item name="min_order_value" label="GT đơn tối thiểu">
                            <InputNumber
                                min={0}
                                style={{ width: '100%' }}
                                formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                placeholder="Không giới hạn"
                            />
                        </Form.Item>
                        <Form.Item name="max_uses" label="Số lần sử dụng tối đa">
                            <InputNumber min={0} style={{ width: '100%' }} placeholder="Không giới hạn" />
                        </Form.Item>
                    </div>

                    <Form.Item name="is_active" label="Kích hoạt" valuePropName="checked">
                        <Switch checkedChildren="ON" unCheckedChildren="OFF" />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default PromotionPage;
