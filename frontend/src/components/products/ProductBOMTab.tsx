// src/components/products/ProductBOMTab.tsx

import React, { useMemo } from 'react';
import { Table, Button, message, Card, Form, Select, InputNumber, Popconfirm, Row, Col, Space, Statistic } from 'antd';
import { PlusOutlined, DeleteOutlined, DollarOutlined } from '@ant-design/icons';
import api from '../../utils/api';

interface ProductBOMTabProps {
    editingItem: any;
    boms: any[];
    materials: any[]; // Đã được chuẩn hóa thành { value, label } trong ProductsPage
    fetchDetailData: (id: number) => void;
    setBoms: React.Dispatch<React.SetStateAction<any[]>>;
}

// Hàm tính Thành tiền (Giá vốn NPL)
const calculateItemCost = (record: any): number => {
    // Ưu tiên lấy giá từ trường cost_price hoặc cost_per_unit của material
    const materialCost = Number(record.material?.cost_price || record.material?.cost_per_unit || 0);
    const quantity = Number(record.quantity || 0);
    const wastePercent = Number(record.waste_percent || 0);
    const wasteFactor = 1 + (wastePercent / 100);
    
    return materialCost * quantity * wasteFactor;
};

const ProductBOMTab: React.FC<ProductBOMTabProps> = ({ editingItem, boms, materials, fetchDetailData, setBoms }) => {
    const [bomForm] = Form.useForm();

    const handleSaveBOM = async (values: any) => {
        try {
            // Lấy ID cao nhất để tránh trùng lặp tạm thời
            const maxId = Math.max(0, ...boms.map(b => b.id || 0));
            const newId = maxId + 1;

            // Thêm tạm ID giả và thông tin material cơ bản
            const materialItem = materials.find(m => m.value === values.material_id);
            
            const itemToAdd = { 
                ...values, 
                id: newId, 
                // Gán tạm thông tin material (để hiển thị ngay)
                material: { 
                    sku: materialItem?.label.split(' - ')[0],
                    name: materialItem?.label.split(' - ')[1],
                    // Giá cost_price sẽ được fetch lại sau khi lưu
                }
            };
            
            const items = [...boms, itemToAdd];
            setBoms(items);
            
            const payload = items.map(i => ({
                material_id: i.material_id, 
                quantity: i.quantity, 
                waste_percent: i.waste_percent 
            }));

            await api.post(`/products/${editingItem.id}/boms`, payload);
            message.success('Đã lưu BOM');
            fetchDetailData(editingItem.id);
            bomForm.resetFields();
        } catch(e) { message.error('Lỗi lưu BOM'); }
    };
    
    const handleRemoveBOM = async (idToRemove: number) => {
        const updatedBoms = boms.filter(b => b.id !== idToRemove);
        setBoms(updatedBoms);

        const payload = updatedBoms.map(i => ({
            material_id: i.material_id, 
            quantity: i.quantity, 
            waste_percent: i.waste_percent 
        }));

        await api.post(`/products/${editingItem.id}/boms`, payload);
        message.success('Đã xóa BOM');
        fetchDetailData(editingItem.id);
    };
    
    // Tính tổng chi phí NPL
    const totalMaterialCost = useMemo(() => {
        return boms.reduce((sum, item) => sum + calculateItemCost(item), 0);
    }, [boms]);


    const bomColumns = [
        { 
            title: 'Mã NPL', 
            dataIndex: 'material_id', 
            width: 150,
            render: (id: number, record: any) => {
                // Ưu tiên lấy từ Material object (khi Backend JOIN)
                if (record.material?.sku) return record.material.sku;
                // Fallback: Lấy từ Master Data đã chuẩn hóa
                const materialItem = materials.find(m => m.value === id);
                return materialItem ? materialItem.label.split(' - ')[0] : '-';
            }
        },
        { 
            title: 'Tên NPL', 
            dataIndex: 'material_id', 
            render: (id: number, record: any) => {
                // Ưu tiên lấy từ Material object (khi Backend JOIN)
                if (record.material?.name) return record.material.name;
                // Fallback: Lấy từ Master Data đã chuẩn hóa
                const materialItem = materials.find(m => m.value === id);
                return materialItem ? materialItem.label.split(' - ')[1] : '-';
            }
        },
        { title: 'SL', dataIndex: 'quantity', width: 70, align: 'right' as const, render: (v: number) => Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
        { title: 'Hao hụt (%)', dataIndex: 'waste_percent', width: 90, align: 'right' as const },
        
        // --- MỚI: CỘT THÀNH TIỀN ---
        {
            title: 'Thành tiền',
            key: 'cost',
            width: 120,
            align: 'right' as const,
            render: (_: any, record: any) => (
                <b>{calculateItemCost(record).toLocaleString()} ₫</b>
            )
        },
        // ----------------------------
        
        { title: '', key: 'action', width: 70, align: 'center' as const, render: (r:any) => (<Popconfirm title="Xóa?" onConfirm={() => handleRemoveBOM(r.id)}><Button icon={<DeleteOutlined />} size="small" danger /></Popconfirm>) },
    ];

    return (
        <Row gutter={16}>
            <Col span={8}>
                <Card title="Thêm NPL" size="small">
                    <Form form={bomForm} layout="vertical" onFinish={handleSaveBOM}>
                        <Form.Item name="material_id" label="Nguyên Vật Liệu" rules={[{required:true}]}>
                            <Select showSearch options={materials} optionFilterProp="label" placeholder="Chọn NPL..." />
                        </Form.Item>
                        <Row gutter={8}>
                            <Col span={12}><Form.Item name="quantity" label="Số lượng" rules={[{required:true}]}><InputNumber style={{width:'100%'}} min={0} /></Form.Item></Col>
                            <Col span={12}><Form.Item name="waste_percent" label="Hao hụt (%)"><InputNumber style={{width:'100%'}} min={0} max={100}/></Form.Item></Col>
                        </Row>
                        <Button type="primary" htmlType="submit" block><PlusOutlined /> Thêm</Button>
                    </Form>
                </Card>
            </Col>
            <Col span={16}>
                <Table 
                    dataSource={boms} 
                    columns={bomColumns} 
                    rowKey="id" 
                    pagination={false} 
                    size="small" 
                    bordered
                    // --- MỚI: FOOTER HIỂN THỊ TỔNG TIỀN NPL ---
                    summary={() => (
                        <Table.Summary.Row>
                            <Table.Summary.Cell index={0} colSpan={4}>
                                <Statistic 
                                    title="TỔNG CHI PHÍ NPL" 
                                    value={totalMaterialCost} 
                                    precision={0} 
                                    valueStyle={{ color: '#cf1322' }} 
                                    prefix={<DollarOutlined />}
                                    suffix="₫"
                                />
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={1} colSpan={2} /> 
                        </Table.Summary.Row>
                    )}
                    // ------------------------------------------
                />
            </Col>
        </Row>
    );
}

export default ProductBOMTab;