import React, { useState, useEffect } from 'react';
import { Table, Button, Space, DatePicker, Select, Tag, message } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import api from '../../utils/api';

const { Option } = Select;

const PrintSheetManager: React.FC = () => {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchPrintOrders();
    }, []);

    const fetchPrintOrders = async () => {
        setLoading(true);
        try {
            // Lấy các đơn đã chốt thiết kế hoặc đang in
            const res = await api.get('/designs/orders?status=SENT_TO_PRINT,PRINTING,PRINT_DONE');
            const data = Array.isArray(res.data) ? res.data : [];
            // Lọc tay hoặc sửa API để hỗ trợ multiple status query, ở đây lọc tay cho chắc
            const printOrders = data.filter(o => ['CUSTOMER_APPROVED', 'SENT_TO_PRINT', 'PRINTING', 'PRINT_DONE'].includes(o.status));
            setOrders(printOrders);
        } catch (error) {
            message.error('Lỗi khi tải danh sách in');
        }
        setLoading(false);
    };

    const handleExportExcel = () => {
        // Mock export
        message.info('Tính năng xuất Excel đang được xây dựng');
    };

    const columns = [
        { title: 'Tên trường', dataIndex: 'school_name', render: (t: string) => <b>{t}</b> },
        { title: 'Sản phẩm', render: (r: any) => `${r.product_type} ${r.product_style ? `(${r.product_style})` : ''}` },
        { 
            title: 'File chốt thiết kế', 
            dataIndex: 'final_design_file', 
            render: (url: string) => url ? <a href={url} target="_blank" rel="noreferrer">Tải file</a> : <span style={{color: 'red'}}>Thiếu file</span> 
        },
        { title: 'Màu nền', dataIndex: 'background_color' },
        { title: 'Màu chữ', dataIndex: 'print_text_color' },
        { title: 'Kích thước', dataIndex: 'dimensions' },
        { title: 'Loại in', dataIndex: 'print_type', render: (t: string) => t || 'In lưới' },
        { title: 'SL', dataIndex: 'quantity', render: (t: number) => <b>{t}</b> },
        { title: 'Ghi chú kỹ thuật', dataIndex: 'notes' },
        { 
            title: 'Trạng thái in', 
            dataIndex: 'status',
            render: (t: string) => {
                if (t === 'PRINT_DONE') return <Tag color="success">Đã in xong</Tag>;
                if (t === 'PRINTING') return <Tag color="processing">Đang in</Tag>;
                return <Tag color="default">Chờ in</Tag>;
            }
        },
        { title: 'Deadline', dataIndex: 'print_deadline', render: (t: string) => t ? new Date(t).toLocaleDateString() : '-' },
    ];

    return (
        <div>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                <Space>
                    <DatePicker.RangePicker />
                    <Select defaultValue="ALL" style={{ width: 150 }}>
                        <Option value="ALL">Tất cả trạng thái</Option>
                        <Option value="PENDING">Chờ in</Option>
                        <Option value="PRINTING">Đang in</Option>
                        <Option value="DONE">Đã xong</Option>
                    </Select>
                </Space>
                <Button type="primary" icon={<DownloadOutlined />} onClick={handleExportExcel} style={{ background: '#108ee9' }}>
                    Xuất Bảng Gửi Xưởng (.xlsx)
                </Button>
            </div>

            <Table 
                dataSource={orders} 
                columns={columns} 
                rowKey="id" 
                loading={loading}
                pagination={false}
                bordered
                size="small"
                scroll={{ x: 1200 }}
            />
        </div>
    );
};

export default PrintSheetManager;
