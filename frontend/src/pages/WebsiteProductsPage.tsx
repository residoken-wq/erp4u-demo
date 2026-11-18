import React, { useState, useEffect } from 'react';
import {
    Card, Table, Button, Space, Tag, Switch, InputNumber, Modal,
    message, Input, Image, Typography, Alert
} from 'antd';
import {
    GlobalOutlined, SyncOutlined, SearchOutlined,
    EyeOutlined, DollarOutlined
} from '@ant-design/icons';
import api from '../utils/api';

const { Title, Text } = Typography;

interface Product {
    id: number;
    sku: string;
    name: string;
    category: string;
    base_price: number;
    image_url: string;
    show_on_website: boolean;
    website_price: number | null;
    website_order: number;
    is_active: boolean;
}

export default function WebsiteProductsPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');
    const [editingPrice, setEditingPrice] = useState<{ id: number; price: number } | null>(null);

    useEffect(() => {
        loadProducts();
    }, []);

    const loadProducts = async () => {
        setLoading(true);
        try {
            const res = await api.get('/products');
            setProducts(res.data);
        } catch (error) {
            message.error('Không thể tải danh sách sản phẩm');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleWebsite = async (product: Product, checked: boolean) => {
        try {
            await api.put(`/products/${product.id}`, {
                show_on_website: checked
            });
            setProducts(products.map(p =>
                p.id === product.id ? { ...p, show_on_website: checked } : p
            ));
            message.success(checked ? 'Đã hiển thị trên website' : 'Đã ẩn khỏi website');
        } catch {
            message.error('Có lỗi xảy ra');
        }
    };

    const handleUpdatePrice = async (id: number, price: number) => {
        try {
            await api.put(`/products/${id}`, { website_price: price });
            setProducts(products.map(p =>
                p.id === id ? { ...p, website_price: price } : p
            ));
            setEditingPrice(null);
            message.success('Đã cập nhật giá website');
        } catch {
            message.error('Có lỗi xảy ra');
        }
    };

    const handleUpdateOrder = async (id: number, order: number) => {
        try {
            await api.put(`/products/${id}`, { website_order: order });
            setProducts(products.map(p =>
                p.id === id ? { ...p, website_order: order } : p
            ));
        } catch {
            message.error('Có lỗi xảy ra');
        }
    };

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
    };

    const [showOnlyWebsite, setShowOnlyWebsite] = useState(false);

    const filteredProducts = products.filter(p =>
        (p.name.toLowerCase().includes(searchText.toLowerCase()) ||
            p.sku.toLowerCase().includes(searchText.toLowerCase())) &&
        (!showOnlyWebsite || p.show_on_website)
    );

    const websiteProducts = products.filter(p => p.show_on_website);

    const columns = [
        {
            title: 'Hình',
            dataIndex: 'image_url',
            key: 'image',
            width: 70,
            render: (url: string) => url ? (
                <Image src={url} width={50} height={50} style={{ objectFit: 'cover', borderRadius: 4 }} />
            ) : (
                <div style={{ width: 50, height: 50, background: '#f5f5f5', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📦</div>
            ),
        },
        {
            title: 'SKU',
            dataIndex: 'sku',
            key: 'sku',
            width: 100,
            render: (sku: string) => <code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: 4 }}>{sku}</code>,
        },
        {
            title: 'Tên sản phẩm',
            dataIndex: 'name',
            key: 'name',
            ellipsis: true,
        },
        {
            title: 'Danh mục',
            dataIndex: 'category',
            key: 'category',
            width: 100,
        },
        {
            title: 'Giá gốc',
            dataIndex: 'base_price',
            key: 'base_price',
            width: 120,
            render: (price: number) => <Text type="secondary">{formatPrice(price)}</Text>,
        },
        {
            title: 'Giá Website',
            key: 'website_price',
            width: 150,
            render: (_: any, record: Product) => (
                <Space>
                    <InputNumber
                        value={record.website_price || record.base_price}
                        formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        parser={(v) => Number(v?.replace(/,/g, '') || 0)}
                        style={{ width: 110 }}
                        size="small"
                        onBlur={(e) => {
                            const value = Number(e.target.value.replace(/,/g, ''));
                            if (value !== record.website_price) {
                                handleUpdatePrice(record.id, value);
                            }
                        }}
                    />
                </Space>
            ),
        },
        {
            title: 'Thứ tự',
            dataIndex: 'website_order',
            key: 'website_order',
            width: 80,
            render: (order: number, record: Product) => (
                <InputNumber
                    value={order}
                    min={0}
                    size="small"
                    style={{ width: 60 }}
                    onChange={(v) => handleUpdateOrder(record.id, v || 0)}
                />
            ),
        },
        {
            title: 'Hiển thị',
            key: 'show_on_website',
            width: 90,
            render: (_: any, record: Product) => (
                <Switch
                    checked={record.show_on_website}
                    onChange={(checked) => handleToggleWebsite(record, checked)}
                    checkedChildren="ON"
                    unCheckedChildren="OFF"
                />
            ),
        },
    ];

    return (
        <div style={{ padding: 24 }}>
            <Card>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <Title level={4} style={{ margin: 0 }}>
                            <GlobalOutlined style={{ marginRight: 8 }} />
                            Sản phẩm trên Website
                        </Title>
                        <Text type="secondary">
                            Chọn sản phẩm hiển thị trên website và thiết lập giá bán riêng
                        </Text>
                    </div>
                    <Space>
                        <Input
                            placeholder="Tìm kiếm..."
                            prefix={<SearchOutlined />}
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            style={{ width: 200 }}
                            allowClear
                        />
                        <Button
                            type={showOnlyWebsite ? 'primary' : 'default'}
                            onClick={() => setShowOnlyWebsite(!showOnlyWebsite)}
                        >
                            {showOnlyWebsite ? 'Đang lọc: Hiển thị' : 'Lọc: Đang hiển thị'}
                        </Button>
                        <Button icon={<SyncOutlined />} onClick={loadProducts} loading={loading}>
                            Làm mới
                        </Button>
                        <Button
                            icon={<EyeOutlined />}
                            onClick={() => window.open('https://demo.erp4u.local/san-pham', '_blank')}
                        >
                            Xem website
                        </Button>
                    </Space>
                </div>

                <Alert
                    message={`Đang hiển thị ${websiteProducts.length} sản phẩm trên website`}
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                />

                <Table
                    columns={columns}
                    dataSource={filteredProducts}
                    rowKey="id"
                    loading={loading}
                    size="middle"
                    pagination={{ pageSize: 15, showTotal: (total) => `Tổng ${total} sản phẩm` }}
                    rowClassName={(record) => record.show_on_website ? 'row-website-active' : ''}
                />
            </Card>

            <style>{`
        .row-website-active {
          background-color: #f6ffed;
        }
        .row-website-active:hover td {
          background-color: #d9f7be !important;
        }
      `}</style>
        </div>
    );
}
