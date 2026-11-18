import React, { useMemo } from 'react';
import { Table, Button, message, Card, Form, Input, InputNumber, Popconfirm, Row, Col, Statistic } from 'antd';
import { PlusOutlined, DeleteOutlined, DollarOutlined, CarOutlined } from '@ant-design/icons';
import api from '../../utils/api';

interface ProductLogisticsTabProps {
    editingItem: any;
    logistics: any[];
    fetchDetailData: (id: number) => void;
    setLogistics: React.Dispatch<React.SetStateAction<any[]>>;
}

const ProductLogisticsTab: React.FC<ProductLogisticsTabProps> = ({ editingItem, logistics, fetchDetailData, setLogistics }) => {
    const [form] = Form.useForm();

    // --- TÍNH TỔNG CHI PHÍ ---
    const totalCost = useMemo(() => {
        return logistics.reduce((sum, item) => sum + Number(item.cost || 0), 0);
    }, [logistics]);

    // --- HÀM LƯU (THÊM MỚI) ---
    const handleSave = async (values: any) => {
        try {
            const newItem = {
                ...values,
                id: Date.now(), // ID tạm
            };
            
            const updatedList = [...logistics, newItem];
            setLogistics(updatedList);

            // Gửi toàn bộ danh sách về Backend (theo logic của products.service.ts)
            await api.post(`/products/${editingItem.id}/logistics`, updatedList);
            
            message.success('Đã lưu chi phí');
            form.resetFields();
            fetchDetailData(editingItem.id); // Tải lại để lấy ID thật và cập nhật giá vốn
        } catch(e) {
            message.error('Lỗi khi lưu chi phí');
        }
    };

    // --- HÀM XÓA ---
    const handleRemove = async (idToRemove: number) => {
        try {
            const updatedList = logistics.filter(item => item.id !== idToRemove);
            setLogistics(updatedList);

            await api.post(`/products/${editingItem.id}/logistics`, updatedList);
            
            message.success('Đã xóa chi phí');
            fetchDetailData(editingItem.id);
        } catch (e) {
            message.error('Lỗi khi xóa');
        }
    };

    const columns = [
        { title: 'Khoản mục chi phí', dataIndex: 'name', render: (t:string) => <b>{t}</b> },
        { 
            title: 'Chi phí (₫/sp)', 
            dataIndex: 'cost', 
            width: 150, 
            align: 'right' as const, 
            render: (v: number) => <span style={{color: '#cf1322'}}>{Number(v).toLocaleString()} ₫</span> 
        },
        { title: 'Ghi chú', dataIndex: 'note' },
        { 
            title: '', key: 'action', width: 60, align: 'center' as const, 
            render: (r:any) => (
                <Popconfirm title="Xóa khoản này?" onConfirm={() => handleRemove(r.id)}>
                    <Button icon={<DeleteOutlined />} size="small" danger />
                </Popconfirm>
            ) 
        },
    ];

    return (
        <Row gutter={16}>
            {/* FORM NHẬP LIỆU BÊN TRÁI */}
            <Col span={8}>
                <Card title="Thêm Chi Phí Khác" size="small">
                    <Form form={form} layout="vertical" onFinish={handleSave}>
                        <Form.Item name="name" label="Tên khoản mục" rules={[{required: true, message: 'Nhập tên (VD: Bao bì)'}]}>
                            <Input placeholder="VD: Hộp giấy, Vận chuyển, Điện..." prefix={<CarOutlined/>} />
                        </Form.Item>
                        
                        <Form.Item name="cost" label="Chi phí / 1 Sản phẩm" rules={[{required: true}]}>
                            <InputNumber 
                                style={{width: '100%'}} 
                                min={0} 
                                addonAfter="₫" 
                                formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                            />
                        </Form.Item>

                        <Form.Item name="note" label="Ghi chú">
                            <Input.TextArea rows={2} placeholder="Diễn giải chi tiết..." />
                        </Form.Item>

                        <Button type="primary" htmlType="submit" block icon={<PlusOutlined />}>Thêm Chi Phí</Button>
                    </Form>
                </Card>
            </Col>

            {/* BẢNG DỮ LIỆU BÊN PHẢI */}
            <Col span={16}>
                <Table 
                    dataSource={logistics} 
                    columns={columns} 
                    rowKey="id" 
                    pagination={false} 
                    size="small" 
                    bordered
                    summary={() => (
                        <Table.Summary.Row>
                            <Table.Summary.Cell index={0} colSpan={1}>
                                <div style={{textAlign: 'right', fontWeight: 'bold'}}>TỔNG CỘNG:</div>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={1} colSpan={3}>
                                <Statistic 
                                    value={totalCost} 
                                    precision={0} 
                                    valueStyle={{ color: '#cf1322', fontSize: 16, fontWeight: 'bold' }} 
                                    prefix={<DollarOutlined />}
                                    suffix="₫"
                                />
                            </Table.Summary.Cell>
                        </Table.Summary.Row>
                    )}
                />
            </Col>
        </Row>
    );
};

export default ProductLogisticsTab;