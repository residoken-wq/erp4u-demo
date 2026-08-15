import React, { useState, useEffect, useMemo } from 'react';
import { Table, Select, InputNumber, Button, Tag, Space, Typography, Card, Divider, Input, Popconfirm } from 'antd';
import { SaveOutlined, CheckCircleOutlined, PlusOutlined, DeleteOutlined, ShoppingCartOutlined } from '@ant-design/icons';

const { Text } = Typography;
const { Option } = Select;

interface PfoProcessRoutingProps {
    pfoId: number;
    existingMilestones?: any[];
    salesOrderItems?: any[];
    customQuantities?: Record<string, number>;
    suppliers: any[];
    loading?: boolean;
    onSaveRouting: (routingData: any[]) => void;
    onGeneratePo?: () => void;
}

const PfoProcessRouting: React.FC<PfoProcessRoutingProps> = ({
    pfoId,
    existingMilestones = [],
    salesOrderItems = [],
    customQuantities = {},
    suppliers = [],
    loading,
    onSaveRouting,
    onGeneratePo
}) => {
    const [routingRows, setRoutingRows] = useState<any[]>([]);

    useEffect(() => {
        const qtyMap: { [key: number]: number } = {};
        (salesOrderItems || []).forEach((item: any) => {
            const product = item.product;
            if (!product) return;
            const rootQty = customQuantities[product.id] !== undefined ? Number(customQuantities[product.id]) : Number(item.quantity || 1);
            
            if (product.components && product.components.length > 0) {
                product.components.forEach((comp: any) => {
                    const child = comp.child_product;
                    if (child) {
                        qtyMap[child.id] = customQuantities[child.id] !== undefined ? Number(customQuantities[child.id]) : rootQty * (Number(comp.quantity) || 1);
                    }
                });
            } else {
                qtyMap[product.id] = rootQty;
            }
        });

        const updatedRows = existingMilestones.map(row => {
            if (row.product_id && qtyMap[row.product_id] !== undefined) {
                return { ...row, planned_quantity: qtyMap[row.product_id] };
            }
            return row;
        });

        setRoutingRows(updatedRows);
    }, [existingMilestones, salesOrderItems, customQuantities]);

    const handleVendorChange = (id: string | number, vendorId: number) => {
        const vendorObj = suppliers.find(s => s.id === vendorId);
        setRoutingRows(rows => rows.map(row => 
            row.id === id ? { ...row, vendor_id: vendorId, vendor_name: vendorObj ? vendorObj.name : '' } : row
        ));
    };

    const handlePriceChange = (id: string | number, price: number | null) => {
        setRoutingRows(rows => rows.map(row => 
            row.id === id ? { ...row, unit_price: price || 0 } : row
        ));
    };

    const handleStepNameChange = (id: string | number, name: string) => {
        setRoutingRows(rows => rows.map(row => 
            row.id === id ? { ...row, step_name: name } : row
        ));
    };

    const handleAddRow = (productId: number, productName: string, plannedQuantity: number) => {
        const newRow = {
            id: `temp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            pfo_id: pfoId,
            product_id: productId,
            product_name: productName,
            step_name: 'Gia công',
            vendor_id: null,
            planned_quantity: plannedQuantity,
            unit_price: 0
        };
        setRoutingRows(rows => [...rows, newRow]);
    };

    const handleDeleteRow = (id: string | number) => {
        setRoutingRows(rows => rows.filter(r => r.id !== id));
    };

    const columns = [
        {
            title: 'Công Đoạn Gia Công',
            dataIndex: 'step_name',
            key: 'step_name',
            width: 220,
            render: (text: string, record: any) => (
                <Input 
                    value={text} 
                    onChange={e => handleStepNameChange(record.id, e.target.value)} 
                    placeholder="Tên công đoạn..."
                    style={{ fontWeight: 500 }}
                />
            )
        },
        {
            title: 'Nhà Gia Công (Xưởng Phụ Trách)',
            key: 'vendor_id',
            render: (_: any, record: any) => (
                <Select
                    showSearch
                    allowClear
                    placeholder="Gõ tìm xưởng gia công..."
                    optionFilterProp="children"
                    style={{ width: '100%' }}
                    value={record.vendor_id}
                    onChange={(val) => handleVendorChange(record.id, val)}
                    filterOption={(input, option) =>
                        String(option?.children || '').toLowerCase().includes(input.toLowerCase())
                    }
                >
                    {suppliers.map(s => (
                        <Option key={s.id} value={s.id}>
                            {s.name} {s.code || s.supplier_code ? `(${s.code || s.supplier_code})` : ''}
                        </Option>
                    ))}
                </Select>
            )
        },
        {
            title: 'SL Kế hoạch',
            dataIndex: 'planned_quantity',
            key: 'planned_quantity',
            width: 120,
            align: 'right' as const,
            render: (val: number) => <Text>{Number(val || 0).toLocaleString()}</Text>
        },
        {
            title: 'Đơn Giá / SP',
            key: 'unit_price',
            width: 140,
            align: 'right' as const,
            render: (_: any, record: any) => (
                <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    step={1000}
                    formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={value => value?.replace(/\$\s?|(,*)/g, '') as any}
                    placeholder="Đơn giá"
                    value={record.unit_price}
                    onChange={(val) => handlePriceChange(record.id, val)}
                />
            )
        },
        {
            title: 'Thành Tiền',
            key: 'total',
            width: 140,
            align: 'right' as const,
            render: (_: any, record: any) => (
                <Text strong style={{ color: '#096dd9' }}>
                    {(Number(record.unit_price || 0) * Number(record.planned_quantity || 0)).toLocaleString()} ₫
                </Text>
            )
        },
        {
            title: 'Trạng Thái',
            key: 'status',
            width: 130,
            align: 'center' as const,
            render: (_: any, record: any) => record.vendor_id ? (
                <Tag color="blue" icon={<CheckCircleOutlined />}>Đã phân công</Tag>
            ) : (
                <Tag color="default">Chưa gán xưởng</Tag>
            )
        },
        {
            title: '',
            key: 'action',
            width: 50,
            align: 'center' as const,
            render: (_: any, record: any) => (
                <Popconfirm title="Xóa công đoạn này?" onConfirm={() => handleDeleteRow(record.id)}>
                    <Button type="text" danger icon={<DeleteOutlined />} size="small" />
                </Popconfirm>
            )
        }
    ];

    // Group rows by product using salesOrderItems as skeleton
    const groupedRows = useMemo(() => {
        const groups: { [key: number]: { productName: string, plannedQuantity: number, rows: any[] } } = {};
        
        // 1. Map expected products from sales order items
        (salesOrderItems || []).forEach((item: any) => {
            const product = item.product;
            if (!product) return;
            const qty = Number(item.quantity) || 1;
            
            const rootQty = customQuantities[product.id] !== undefined ? Number(customQuantities[product.id]) : qty;

            if (product.components && product.components.length > 0) {
                product.components.forEach((comp: any) => {
                    const child = comp.child_product;
                    if (child) {
                        const childQty = customQuantities[child.id] !== undefined ? Number(customQuantities[child.id]) : rootQty * (Number(comp.quantity) || 1);
                        groups[child.id] = {
                            productName: child.name || child.sku,
                            plannedQuantity: childQty,
                            rows: []
                        };
                    }
                });
            } else {
                groups[product.id] = {
                    productName: product.name || product.sku,
                    plannedQuantity: rootQty,
                    rows: []
                };
            }
        });

        // 2. Map existing routing rows into groups
        const noProduct: any[] = [];
        routingRows.forEach(row => {
            if (row.product_id) {
                if (!groups[row.product_id]) {
                    groups[row.product_id] = {
                        productName: row.product_name || `Sản phẩm #${row.product_id}`,
                        plannedQuantity: row.planned_quantity || 0,
                        rows: []
                    };
                }
                groups[row.product_id].rows.push(row);
            } else {
                noProduct.push(row);
            }
        });

        return { groups, noProduct };
    }, [routingRows, salesOrderItems]);

    return (
        <Card size="small" style={{ borderRadius: 10, background: '#fafafa', border: '1px solid #e8e8e8' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                    <Text strong style={{ fontSize: 14, color: '#1d39c4' }}>
                        🏭 Quy Trình Gia Công Đa Công Đoạn (Gate 3 - Multi-Vendor Routing)
                    </Text>
                    <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                        Phân công xưởng cho từng công đoạn của từng sản phẩm.
                    </div>
                </div>
                <Space>
                    <Button
                        icon={<SaveOutlined />}
                        loading={loading}
                        onClick={() => onSaveRouting(routingRows)}
                        style={{ borderRadius: 6 }}
                    >
                        Lưu Phân Công
                    </Button>
                    {onGeneratePo && (
                        <Button
                            type="primary"
                            icon={<ShoppingCartOutlined />}
                            loading={loading}
                            onClick={async () => {
                                await onSaveRouting(routingRows);
                                onGeneratePo();
                            }}
                            style={{ borderRadius: 6, background: '#52c41a', borderColor: '#52c41a' }}
                        >
                            Lưu & Phát Hành PO (Gate 4)
                        </Button>
                    )}
                </Space>
            </div>

            {Object.keys(groupedRows.groups).map(productIdStr => {
                const productId = Number(productIdStr);
                const group = groupedRows.groups[productId];
                
                return (
                    <div key={productId} style={{ marginBottom: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <Text strong style={{ color: '#096dd9', fontSize: 14 }}>📦 {group.productName}</Text>
                            <Button 
                                type="dashed" 
                                size="small" 
                                icon={<PlusOutlined />} 
                                onClick={() => handleAddRow(productId, group.productName, group.plannedQuantity)}
                            >
                                Thêm công đoạn
                            </Button>
                        </div>
                        <Table
                            dataSource={group.rows}
                            columns={columns}
                            rowKey="id"
                            pagination={false}
                            size="small"
                            bordered
                            style={{ background: '#fff' }}
                            locale={{ emptyText: 'Chưa có công đoạn gia công nào' }}
                        />
                    </div>
                );
            })}

            {groupedRows.noProduct.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                    <Divider orientation="left" style={{ margin: '12px 0' }}>
                        <Text strong style={{ color: '#fa8c16' }}>⚠️ Công Đoạn Khác (Không thuộc SP nào)</Text>
                    </Divider>
                    <Table
                        dataSource={groupedRows.noProduct}
                        columns={columns}
                        rowKey="id"
                        pagination={false}
                        size="small"
                        bordered
                        style={{ background: '#fff' }}
                    />
                </div>
            )}
        </Card>
    );
};

export default PfoProcessRouting;
