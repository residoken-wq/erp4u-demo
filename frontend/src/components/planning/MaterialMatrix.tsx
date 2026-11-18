import React, { useState } from 'react';
import { Table, Tag, InputNumber, Button, Space, Typography, Tooltip, Select, Empty, Alert, Checkbox } from 'antd';
import { 
    InfoCircleOutlined, 
    SaveOutlined,
    ShoppingCartOutlined,
    CalculatorOutlined
} from '@ant-design/icons';

const { Text } = Typography;
const { Option } = Select;

interface MaterialMatrixProps {
    requirements: any[];
    suppliers?: any[];
    loading?: boolean;
    onSaveReqs?: (updatedReqs: any[]) => void;
    onGeneratePo?: (reqs?: any[]) => void;
    onCalculateBom?: () => void;
}

const MaterialMatrix: React.FC<MaterialMatrixProps> = ({ 
    requirements, 
    suppliers,
    loading, 
    onSaveReqs, 
    onGeneratePo,
    onCalculateBom 
}) => {
    const [editableData, setEditableData] = useState<any[]>(requirements || []);

    // Sync state if props change (only when data actually changes, preventing overwrite of local edits)
    React.useEffect(() => {
        setEditableData(requirements || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(requirements)]);

    const handleFieldChange = (id: number, field: string, value: any) => {
        const newData = editableData.map(item => {
            if (item.id === id) {
                const updatedItem = { ...item, [field]: value };
                if (field === 'use_inventory') {
                    if (value) {
                        const ceilPlanned = Math.ceil(item.planned_quantity || 0);
                        updatedItem.inventory_used_quantity = Math.min(ceilPlanned, item.available_stock || 0);
                        updatedItem.actual_order_quantity = Math.max(0, (item.planned_quantity || 0) - updatedItem.inventory_used_quantity);
                    } else {
                        updatedItem.inventory_used_quantity = 0;
                        updatedItem.actual_order_quantity = item.planned_quantity || 0;
                    }
                } else if (field === 'inventory_used_quantity') {
                    updatedItem.actual_order_quantity = Math.max(0, (item.planned_quantity || 0) - (value || 0));
                }
                return updatedItem;
            }
            return item;
        });
        setEditableData(newData);
    };

    const columns = [
        {
            title: 'Mã Vật Tư',
            dataIndex: 'material_code',
            key: 'material_code',
            render: (text: string, record: any) => (
                <Space direction="vertical" size={0}>
                    <Text strong>{text || record.material?.code || `MAT-${record.id}`}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{record.material_name || record.material?.name || 'Vật tư'}</Text>
                </Space>
            )
        },
        {
            title: (
                <Space>
                    Nhu cầu BOM
                    <Tooltip title="Định mức gốc từ BOM (Đã bao gồm hao hụt)"><InfoCircleOutlined /></Tooltip>
                </Space>
            ),
            dataIndex: 'planned_quantity',
            key: 'planned_quantity',
            align: 'right' as const,
            render: (val: number) => <Text strong>{Number(val || 0).toLocaleString()}</Text>
        },
        {
            title: 'Tồn Kho',
            dataIndex: 'available_stock',
            key: 'available_stock',
            align: 'right' as const,
            render: (val: number) => (
                <Text style={{ color: val > 0 ? '#52c41a' : '#bfbfbf' }}>
                    {val ? Number(val).toLocaleString() : 0}
                </Text>
            )
        },
        {
            title: 'Hình Thức Cấp',
            dataIndex: 'supply_method',
            key: 'supply_method',
            render: (text: string, record: any) => (
                <Select 
                    value={text || 'COMPANY_SUPPLIED'} 
                    onChange={(val) => handleFieldChange(record.id, 'supply_method', val)}
                    style={{ width: 140 }}
                    size="small"
                >
                    <Option value="COMPANY_SUPPLIED">ERP4U Cấp</Option>
                    <Option value="VENDOR_SUPPLIED">Xưởng Tự Lo</Option>
                </Select>
            )
        },
        {
            title: 'Dùng Tồn Kho',
            dataIndex: 'use_inventory',
            key: 'use_inventory',
            align: 'center' as const,
            render: (val: boolean, record: any) => (
                <Space>
                    <Checkbox 
                        checked={val} 
                        onChange={(e) => handleFieldChange(record.id, 'use_inventory', e.target.checked)}
                        disabled={!record.available_stock || record.available_stock <= 0}
                    />
                    {val && (
                        <InputNumber
                            size="small"
                            value={record.inventory_used_quantity ?? 0}
                            onChange={(v) => handleFieldChange(record.id, 'inventory_used_quantity', v)}
                            style={{ width: 70 }}
                            max={record.available_stock}
                            min={0}
                        />
                    )}
                </Space>
            )
        },
        {
            title: 'Nhà Cung Cấp (NCC)',
            dataIndex: 'supplier_id',
            key: 'supplier_id',
            render: (text: any, record: any) => (
                <Select
                    showSearch
                    allowClear
                    placeholder="Chọn NCC"
                    optionFilterProp="children"
                    value={record.supplier_id}
                    onChange={(val) => handleFieldChange(record.id, 'supplier_id', val)}
                    style={{ width: 160 }}
                    size="small"
                >
                    {(suppliers || []).map(s => (
                        <Option key={s.id} value={s.id}>{s.name || s.supplier_name}</Option>
                    ))}
                </Select>
            )
        },
        {
            title: 'Giá Tham Khảo',
            dataIndex: 'unit_price',
            key: 'unit_price',
            align: 'right' as const,
            render: (_: any, record: any) => (
                <InputNumber 
                    size="small" 
                    value={record.unit_price}
                    onChange={(val) => handleFieldChange(record.id, 'unit_price', val)}
                    style={{ width: 100 }}
                    formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={value => value?.replace(/\$\s?|(,*)/g, '') as unknown as number}
                />
            )
        },
        {
            title: 'SL Thực Đặt',
            key: 'actual_order_quantity',
            align: 'right' as const,
            render: (_: any, record: any) => {
                const suggested = record.use_inventory 
                    ? Math.max(0, (record.planned_quantity || 0) - (record.inventory_used_quantity || 0))
                    : (record.planned_quantity || 0);
                return (
                    <InputNumber 
                        size="small" 
                        value={record.actual_order_quantity ?? suggested}
                        onChange={(val) => handleFieldChange(record.id, 'actual_order_quantity', val)}
                        style={{ width: 80 }}
                    />
                );
            }
        },
        {
            title: 'Total',
            key: 'total',
            align: 'right' as const,
            render: (_: any, record: any) => {
                const suggested = record.use_inventory 
                    ? Math.max(0, (record.planned_quantity || 0) - (record.inventory_used_quantity || 0))
                    : (record.planned_quantity || 0);
                const qty = record.actual_order_quantity ?? suggested;
                const price = record.unit_price || 0;
                return <Text strong style={{ color: '#cf1322' }}>{(qty * price).toLocaleString()}</Text>;
            }
        },
        {
            title: 'Trạng Thái',
            key: 'status',
            render: (_: any, record: any) => {
                if (record.issued_quantity >= record.planned_quantity && record.planned_quantity > 0) return <Tag color="success">Đã Xuất Đủ</Tag>;
                if (record.supply_method === 'VENDOR_SUPPLIED') return <Tag color="warning">PO Xưởng</Tag>;
                return <Tag color="processing">Chờ Cấp / Mua</Tag>;
            }
        }
    ];

    if (!editableData || editableData.length === 0) {
        return (
            <div style={{ padding: '24px 0', textAlign: 'center' }}>
                <Alert 
                    message="Chưa có dữ liệu vật tư (BOM)" 
                    description="Lệnh sản xuất này chưa được bóc tách nhu cầu Nguyên phụ liệu. Hãy nhấn nút tính toán BOM bên dưới để hệ thống tự nổ BOM từ đơn hàng gốc."
                    type="info"
                    showIcon
                    style={{ marginBottom: 16, textAlign: 'left', borderRadius: 8 }}
                />
                {onCalculateBom && (
                    <Button 
                        type="primary" 
                        size="large"
                        icon={<CalculatorOutlined />} 
                        onClick={onCalculateBom}
                        loading={loading}
                        style={{ borderRadius: 8 }}
                    >
                        Tính Toán Lại BOM
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text type="secondary">Phân tích nhu cầu vật tư (MRP) & Quyết định phương thức cung ứng</Text>
                <Space>
                    <Button 
                        icon={<SaveOutlined />} 
                        onClick={() => onSaveReqs && onSaveReqs(editableData)}
                    >
                        Lưu Cấu Hình
                    </Button>
                    <Button 
                        type="primary" 
                        icon={<ShoppingCartOutlined />} 
                        onClick={() => onGeneratePo && onGeneratePo(editableData)}
                    >
                        Tạo PO Vật Tư
                    </Button>
                </Space>
            </div>
            
            <Table 
                dataSource={editableData}
                columns={columns}
                rowKey="id"
                pagination={false}
                size="middle"
                loading={loading}
                scroll={{ y: 350 }}
                expandable={{
                    expandedRowRender: record => {
                        if (!record.bom_details || record.bom_details.length === 0) {
                            return <Text type="secondary" style={{ marginLeft: 32 }}>Không có chi tiết bóc tách (Nhập tay hoặc BOM tĩnh)</Text>;
                        }
                        
                        const detailCols = [
                            { title: 'Sản phẩm', dataIndex: 'product_name', key: 'product_name' },
                            { title: 'SL Yêu cầu (A)', dataIndex: 'order_quantity', key: 'order_quantity', align: 'right' as const, render: (v: number) => Number(v || 0).toLocaleString() },
                            { title: 'ĐM gốc (B)', dataIndex: 'original_norm', key: 'original_norm', align: 'right' as const, render: (v: number) => Number(v || 0).toLocaleString() },
                            { title: 'Waste % (C)', dataIndex: 'waste', key: 'waste', align: 'right' as const },
                            { 
                                title: 'Tổng nhu cầu (A * B * (1 + C%))', 
                                dataIndex: 'total', 
                                key: 'total', 
                                align: 'right' as const, 
                                render: (val: number) => <Text strong style={{ color: '#1890ff' }}>{Number(val || 0).toLocaleString()}</Text> 
                            }
                        ];
                        
                        return (
                            <div style={{ padding: '8px 24px', backgroundColor: '#fcfcfc', border: '1px dashed #d9d9d9', borderRadius: 6, margin: '8px 16px' }}>
                                <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 12, color: '#595959' }}>
                                    Chi tiết bóc tách NPL:
                                </Text>
                                <Table 
                                    columns={detailCols} 
                                    dataSource={record.bom_details} 
                                    pagination={false} 
                                    size="small" 
                                    rowKey={(r, i) => i?.toString() || '0'} 
                                    bordered
                                />
                            </div>
                        );
                    }
                }}
            />
        </div>
    );
};

export default MaterialMatrix;
