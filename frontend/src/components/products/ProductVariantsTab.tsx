// src/components/products/ProductVariantsTab.tsx

import React, { useState } from 'react';
import { Table, Button, message, Card, Form, Select, Input, Popconfirm, Row, Col, Space, Tooltip, Divider, Tag } from 'antd';
import { PlusOutlined, DeleteOutlined, CopyOutlined, SyncOutlined, ExperimentOutlined, SendOutlined } from '@ant-design/icons';
import api from '../../utils/api';

interface ProductVariantsTabProps {
    editingItem: any;
    data: any[]; // Toàn bộ danh sách sản phẩm (để tìm biến thể)
    fetchData: () => void;
    fetchDetailData: (id: number) => void;
}

const ProductVariantsTab: React.FC<ProductVariantsTabProps> = ({ editingItem, data, fetchData, fetchDetailData }) => {
    
    // Giả định: Các biến thể cùng loại được tìm thông qua một tiền tố SKU chung
    const baseSku = editingItem.sku?.split('_')[0] || editingItem.sku;
    
    // Lọc biến thể: Những sản phẩm có SKU bắt đầu bằng tiền tố SKU gốc và không phải là sản phẩm hiện tại
    const variants = data.filter(p => 
        p.sku !== editingItem.sku && p.sku.startsWith(baseSku)
    );
    
    const [selectedVariant, setSelectedVariant] = useState<string | null>(null);

    // --- COPY HANDLERS ---
    const handleCopy = async (type: 'bom' | 'routings' | 'logistics' | 'semi-finished', targetSku: string, sourceSku: string) => {
        if (!sourceSku) {
            return message.error("Vui lòng chọn hoặc xác định biến thể nguồn.");
        }

        const endpoints: Record<string, string> = {
            bom: '/products/copy-bom',
            routings: '/products/copy-routings',
            logistics: '/products/copy-logistics',
            'semi-finished': '/products/copy-semi-finished'
        };

        const labels: Record<string, string> = {
            bom: 'BOM',
            routings: 'Quy trình gia công',
            logistics: 'Logistics',
            'semi-finished': 'Bán Thành Phẩm'
        };

        try {
            const res = await api.post(endpoints[type], {
                sourceSku: sourceSku,
                targetSku: targetSku
            });
            message.success(res.data?.message || `Đã sao chép ${labels[type]} từ ${sourceSku} sang ${targetSku}`);
            fetchDetailData(editingItem.id); 
        } catch (error: any) {
            message.error(error.response?.data?.message || `Lỗi khi sao chép ${labels[type]}.`);
        }
    };
    
    const variantColumns = [
        { title: 'Mã Biến thể (SKU)', dataIndex: 'sku', render: (text: string) => <b>{text}</b> },
        { 
            title: 'Thuộc tính', 
            dataIndex: 'attributes', 
            render: (attr: any) => (
                <Space>
                    {attr && Object.entries(attr).map(([key, value]: [string, any]) => (
                        <Tag key={key} color="blue">{key}: {value}</Tag>
                    ))}
                </Space>
            )
        },
        { title: 'Giá bán', dataIndex: 'base_price', align: 'right' as const, render: (v: number) => Number(v).toLocaleString() },
        { 
            title: 'Sao chép từ SP này →', 
            key: 'action', 
            width: 340, 
            render: (v: any) => (
                <Space size="small">
                    <Popconfirm
                        title={`Sao chép BOM từ ${v.sku} sang ${editingItem.sku}?`}
                        onConfirm={() => handleCopy('bom', editingItem.sku, v.sku)}
                    >
                        <Tooltip title={`Copy BOM từ ${v.sku}`}>
                            <Button icon={<CopyOutlined />} size="small">BOM</Button>
                        </Tooltip>
                    </Popconfirm>

                    <Popconfirm
                        title={`Sao chép Quy trình gia công từ ${v.sku} sang ${editingItem.sku}?`}
                        onConfirm={() => handleCopy('routings', editingItem.sku, v.sku)}
                    >
                        <Tooltip title={`Copy Quy trình từ ${v.sku}`}>
                            <Button icon={<ExperimentOutlined />} size="small">Gia công</Button>
                        </Tooltip>
                    </Popconfirm>

                    <Popconfirm
                        title={`Sao chép Logistics từ ${v.sku} sang ${editingItem.sku}?`}
                        onConfirm={() => handleCopy('logistics', editingItem.sku, v.sku)}
                    >
                        <Tooltip title={`Copy Logistics từ ${v.sku}`}>
                            <Button icon={<SendOutlined />} size="small">Logistics</Button>
                        </Tooltip>
                    </Popconfirm>

                    <Popconfirm
                        title={`Sao chép Bán thành phẩm từ ${v.sku} sang ${editingItem.sku}?`}
                        onConfirm={() => handleCopy('semi-finished', editingItem.sku, v.sku)}
                    >
                        <Tooltip title={`Copy BTP từ ${v.sku}`}>
                            <Button icon={<CopyOutlined />} size="small">BTP</Button>
                        </Tooltip>
                    </Popconfirm>
                </Space>
            )
        },
    ];

    return (
        <Row gutter={16}>
            <Col span={24}>
                <Card title={`Biến thể cùng loại (${baseSku}...)`} size="small">
                    <Table 
                        dataSource={variants} 
                        columns={variantColumns} 
                        rowKey="id" 
                        pagination={false} 
                        size="small" 
                        bordered 
                        locale={{ emptyText: "Không tìm thấy biến thể cùng loại." }}
                    />
                </Card>
            </Col>
            
            <Col span={24}><Divider orientation="left">Sao chép từ Sản phẩm bất kỳ</Divider></Col>
            <Col span={8}>
                <Card title="Chọn Sản phẩm Nguồn" size="small">
                    <Form layout="vertical">
                        <Form.Item label="Chọn SP Nguồn">
                             <Select 
                                showSearch
                                placeholder="Tìm kiếm SKU hoặc Tên"
                                optionFilterProp="label"
                                options={data.map(p => ({ label: `${p.sku} - ${p.name}`, value: p.sku }))}
                                onChange={setSelectedVariant}
                            />
                        </Form.Item>
                        <Space direction="vertical" style={{ width: '100%' }}>
                            <Button 
                                type="primary" 
                                onClick={() => selectedVariant && handleCopy('bom', editingItem.sku, selectedVariant)} 
                                disabled={!selectedVariant || selectedVariant === editingItem.sku}
                                block
                                icon={<CopyOutlined />}
                            >
                                Copy BOM
                            </Button>
                            <Button 
                                onClick={() => selectedVariant && handleCopy('routings', editingItem.sku, selectedVariant)} 
                                disabled={!selectedVariant || selectedVariant === editingItem.sku}
                                block
                                icon={<ExperimentOutlined />}
                            >
                                Copy Quy trình gia công
                            </Button>
                            <Button 
                                onClick={() => selectedVariant && handleCopy('logistics', editingItem.sku, selectedVariant)} 
                                disabled={!selectedVariant || selectedVariant === editingItem.sku}
                                block
                                icon={<SendOutlined />}
                            >
                                Copy Logistics & Khác
                            </Button>
                            <Button 
                                onClick={() => selectedVariant && handleCopy('semi-finished', editingItem.sku, selectedVariant)} 
                                disabled={!selectedVariant || selectedVariant === editingItem.sku}
                                block
                                icon={<CopyOutlined />}
                            >
                                Copy Bán Thành Phẩm
                            </Button>
                        </Space>
                    </Form>
                </Card>
            </Col>
        </Row>
    );
};

export default ProductVariantsTab;