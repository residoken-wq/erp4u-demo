import React, { useState, useEffect } from 'react';
import { Tabs, Table, Button, Popconfirm, message, Space, Tag } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import UnifiedDesignWorkflow from '../components/production/UnifiedDesignWorkflow';
import api from '../utils/api';

const { TabPane } = Tabs;

const PrintDesignList: React.FC = () => {
    const [designs, setDesigns] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchDesigns();
    }, []);

    const fetchDesigns = async () => {
        setLoading(true);
        try {
            const res = await api.get('/designs/print-designs');
            setDesigns(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            message.error('Lỗi khi tải danh sách sơ đồ');
        }
        setLoading(false);
    };

    const handleDelete = async (id: number) => {
        try {
            await api.delete(`/designs/print-designs/${id}`);
            message.success('Xóa sơ đồ thành công');
            fetchDesigns();
        } catch (error) {
            message.error('Lỗi khi xóa sơ đồ');
        }
    };

    const columns = [
        { title: 'Mã Sơ đồ', dataIndex: 'code', render: (t: any) => <b>{t}</b> },
        { title: 'Tên Sơ đồ', dataIndex: 'name' },
        { title: 'Khách hàng', render: (r: any) => r.customer?.name || '-' },
        { title: 'Sản phẩm / Mã', render: (r: any) => r.product ? `${r.product.sku} - ${r.product.name}` : '-' },
        { title: 'Ngày tạo', dataIndex: 'created_at', render: (t: any) => new Date(t).toLocaleString() },
        { title: 'Loại', dataIndex: 'type', render: (t: any) => <Tag color="blue">{t}</Tag> },
        {
            title: 'Thao tác',
            render: (r: any) => (
                <Space>
                    <Popconfirm title="Bạn có chắc chắn muốn xóa sơ đồ này?" onConfirm={() => handleDelete(r.id)} okText="Có" cancelText="Không">
                        <Button danger icon={<DeleteOutlined />} size="small" />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <Table 
            dataSource={designs} 
            columns={columns} 
            rowKey="id" 
            loading={loading}
            pagination={{ pageSize: 15 }}
        />
    );
};

const DesignManagementPage: React.FC = () => {
    return (
        <div style={{ padding: 24, background: '#fff', minHeight: '100vh' }}>
            <h2 style={{ marginBottom: 24 }}>Quy Trình Xếp Sơ Đồ & Thiết Kế In/Thêu</h2>
            <Tabs defaultActiveKey="workflow">
                <TabPane tab="Quy trình xếp sơ đồ (PO)" key="workflow">
                    <UnifiedDesignWorkflow />
                </TabPane>
                <TabPane tab="Danh sách Sơ đồ (Markers)" key="list">
                    <PrintDesignList />
                </TabPane>
            </Tabs>
        </div>
    );
};

export default DesignManagementPage;
