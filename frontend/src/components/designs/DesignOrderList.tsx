import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, Input, Select, Modal, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import api from '../../utils/api';
import DesignOrderForm from './DesignOrderForm';
import DesignOrderDetail from './DesignOrderDetail';

const { Search } = Input;

const DesignOrderList: React.FC = () => {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    
    // Modal states
    const [isFormVisible, setIsFormVisible] = useState(false);
    const [isDetailVisible, setIsDetailVisible] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<any>(null);

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const res = await api.get('/designs/orders');
            setOrders(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            message.error('Lỗi khi tải danh sách đơn thiết kế');
        }
        setLoading(false);
    };

    const handleDelete = async (id: number) => {
        try {
            await api.delete(`/designs/orders/${id}`);
            message.success('Đã xóa đơn thiết kế');
            fetchOrders();
        } catch (error) {
            message.error('Lỗi khi xóa đơn');
        }
    };

    const filteredOrders = orders.filter(o => {
        const matchText = !searchText || 
            (o.code?.toLowerCase().includes(searchText.toLowerCase())) ||
            (o.school_name?.toLowerCase().includes(searchText.toLowerCase()));
        
        const matchStatus = statusFilter === 'ALL' || o.status === statusFilter;
        return matchText && matchStatus;
    });

    const columns = [
        { title: 'Mã Đơn', dataIndex: 'code', render: (t: string) => <b>{t}</b> },
        { title: 'Trường', dataIndex: 'school_name' },
        { title: 'Sản phẩm', render: (r: any) => `${r.product_type || ''} ${r.product_style ? `(${r.product_style})` : ''}` },
        { title: 'Số lượng', dataIndex: 'quantity', render: (t: number) => <b>{t}</b> },
        { 
            title: 'Trạng thái', 
            dataIndex: 'status', 
            render: (t: string) => {
                let color = 'default';
                if (t === 'INFO_COLLECTED') color = 'processing';
                if (t === 'DESIGNING') color = 'warning';
                if (t === 'CUSTOMER_APPROVED') color = 'success';
                if (t === 'PRINTING') color = 'purple';
                return <Tag color={color}>{t}</Tag>;
            }
        },
        { title: 'Deadline TK', dataIndex: 'design_deadline', render: (t: string) => t ? new Date(t).toLocaleDateString() : '-' },
        { title: 'Người phụ trách', dataIndex: ['designer', 'full_name'], render: (t: string) => t || '-' },
        {
            title: 'Thao tác',
            render: (r: any) => (
                <Space>
                    <Button type="primary" size="small" icon={<EyeOutlined />} onClick={() => {
                        setSelectedOrder(r);
                        setIsDetailVisible(true);
                    }}>Chi tiết</Button>
                    <Button size="small" icon={<EditOutlined />} onClick={() => {
                        setSelectedOrder(r);
                        setIsFormVisible(true);
                    }} />
                    <Button danger size="small" icon={<DeleteOutlined />} onClick={() => handleDelete(r.id)} />
                </Space>
            )
        }
    ];

    return (
        <div>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                <Space>
                    <Search placeholder="Tìm theo mã, tên trường..." onSearch={setSearchText} onChange={e => setSearchText(e.target.value)} style={{ width: 250 }} />
                    <Select value={statusFilter} onChange={setStatusFilter} style={{ width: 150 }}>
                        <Select.Option value="ALL">Tất cả trạng thái</Select.Option>
                        <Select.Option value="INFO_COLLECTED">Mới thu thập TT</Select.Option>
                        <Select.Option value="DESIGNING">Đang thiết kế</Select.Option>
                        <Select.Option value="CUSTOMER_REVIEWING">Khách đang duyệt</Select.Option>
                        <Select.Option value="CUSTOMER_APPROVED">Khách đã chốt</Select.Option>
                        <Select.Option value="PRINTING">Đang in</Select.Option>
                    </Select>
                </Space>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => {
                    setSelectedOrder(null);
                    setIsFormVisible(true);
                }}>
                    Tạo Đơn Thiết Kế
                </Button>
            </div>

            <Table 
                dataSource={filteredOrders}
                columns={columns}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 15 }}
            />

            <Modal
                title={selectedOrder ? "Cập nhật Đơn Thiết Kế" : "Tạo Đơn Thiết Kế Mới"}
                open={isFormVisible}
                onCancel={() => setIsFormVisible(false)}
                footer={null}
                width={800}
                destroyOnClose
            >
                <DesignOrderForm 
                    initialValues={selectedOrder} 
                    onSuccess={() => {
                        setIsFormVisible(false);
                        fetchOrders();
                    }} 
                />
            </Modal>

            <Modal
                title={`Chi Tiết: ${selectedOrder?.code || ''}`}
                open={isDetailVisible}
                onCancel={() => setIsDetailVisible(false)}
                footer={null}
                width={1000}
                destroyOnClose
            >
                <DesignOrderDetail 
                    orderId={selectedOrder?.id}
                    onStatusChange={() => fetchOrders()}
                />
            </Modal>
        </div>
    );
};

export default DesignOrderList;
