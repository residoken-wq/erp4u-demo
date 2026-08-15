import React, { useState } from 'react'; // Bổ sung useState
import { Table, Button, message, Card, Form, Select, InputNumber, Popconfirm, Row, Col, Tag, Checkbox, Input } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../../utils/api';

interface ProductRoutingTabProps {
    editingItem: any;
    routings: any[];
    suppliers: any[];
    processes: any[];
    fetchDetailData: (id: number) => void;
    setRoutings: React.Dispatch<React.SetStateAction<any[]>>;
}

const ProductRoutingTab: React.FC<ProductRoutingTabProps> = ({ editingItem, routings, suppliers, processes, fetchDetailData, setRoutings }) => {
    const [routingForm] = Form.useForm();

    // Tạo danh sách tùy chọn Process để có thể lấy tên khi lưu
    const processOptions = processes.map(p => ({
        label: p.name,
        value: p.id,
        name: p.name // Lưu trữ tên để gán vào step_name
    }));

    const handleSaveRouting = async (values: any) => {
        try {
            // Lấy tên Process đã chọn từ danh sách options
            const processName = processOptions.find(p => p.value === values.process_id)?.name || 'N/A';

            const itemToAdd = {
                ...values,
                step_name: processName, // Gán TÊN CÔNG ĐOẠN từ tên Process (DM)
                id: Date.now()
            };

            const items = [...routings, itemToAdd];
            setRoutings(items);

            const payload = items.map(i => ({
                step_name: i.step_name, // Gửi về Backend
                process_id: i.process_id,
                supplier_id: i.supplier_id,
                cost: i.cost,
                is_required: i.is_required || false,
            }));

            await api.post(`/products/${editingItem.id}/routings`, payload);
            message.success('Đã lưu Quy trình');
            fetchDetailData(editingItem.id);
            routingForm.resetFields();
        } catch (e) { message.error('Lỗi lưu Quy trình'); }
    };

    const handleRemoveRouting = async (idToRemove: number) => {
        const updatedRoutings = routings.filter(r => r.id !== idToRemove);
        setRoutings(updatedRoutings);

        const payload = updatedRoutings.map(i => ({
            step_name: i.step_name,
            process_id: i.process_id,
            supplier_id: i.supplier_id,
            cost: i.cost,
            is_required: i.is_required || false,
        }));

        await api.post(`/products/${editingItem.id}/routings`, payload);
        message.success('Đã xóa Quy trình');
        fetchDetailData(editingItem.id);
    };

    const routingColumns = [
        { title: 'Công đoạn', dataIndex: 'step_name' },
        { title: 'NCC', dataIndex: 'supplier_id', render: (id: number) => suppliers.find(s => s.id === id)?.name || '-' },
        { title: 'Bắt buộc', dataIndex: 'is_required', render: (val: boolean) => val ? <Tag color="green">Có</Tag> : <Tag color="red">Không</Tag> },
        { title: 'Chi phí', dataIndex: 'cost', width: 100, align: 'right' as const, render: (v: number) => Number(v).toLocaleString() },
        { title: '', key: 'action', width: 70, align: 'center' as const, render: (r: any) => (<Popconfirm title="Xóa?" onConfirm={() => handleRemoveRouting(r.id)}><Button icon={<DeleteOutlined />} size="small" danger /></Popconfirm>) },
    ];

    return (
        <Row gutter={16}>
            <Col span={8}>
                <Card title="Thêm Công Đoạn" size="small">
                    <Form form={routingForm} layout="vertical" onFinish={handleSaveRouting}>

                        {/* FIX: Chỉ giữ lại SELECT Loại Công Đoạn (DM) */}
                        <Form.Item name="process_id" label="Loại Công Đoạn" rules={[{ required: true }]}>
                            <Select options={processOptions} placeholder="Chọn Loại Công Đoạn..." />
                        </Form.Item>

                        <Form.Item name="supplier_id" label="Nhà Gia Công">
                            <Select
                                showSearch
                                optionFilterProp="label"
                                options={suppliers.filter(s => s.type !== 'MATERIAL').map(s => ({ label: s.name, value: s.id }))}
                                placeholder="Chọn NCC/Xưởng GC"
                            />
                        </Form.Item>
                        <Form.Item name="cost" label="Chi phí (₫)" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} min={0} addonAfter="₫" /></Form.Item>
                        <Form.Item name="is_required" valuePropName="checked">
                            <Checkbox>Công đoạn bắt buộc (Tính vào giá vốn)</Checkbox>
                        </Form.Item>
                        <Button type="primary" htmlType="submit" block><PlusOutlined /> Thêm</Button>
                    </Form>
                </Card>
            </Col>
            <Col span={16}>
                <Table dataSource={routings} columns={routingColumns} rowKey="id" pagination={false} size="small" bordered />
            </Col>
        </Row>
    );
}

export default ProductRoutingTab;