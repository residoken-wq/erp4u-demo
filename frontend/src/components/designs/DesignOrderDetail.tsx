import React, { useState } from 'react';
import { Steps, Card, Button, Divider, Upload, message, Typography, Descriptions, Row, Col, Tag, Modal, Input } from 'antd';
import { UploadOutlined, CheckCircleOutlined, SyncOutlined } from '@ant-design/icons';
import api from '../../utils/api';
import PrintSheetManager from './PrintSheetManager';

const { Step } = Steps;
const { Title, Text } = Typography;

interface DesignOrderDetailProps {
    orderId: number;
    onStatusChange: () => void;
}

const STATUS_STEPS = [
    'INFO_COLLECTED',
    'DESIGN_ASSIGNED',
    'DESIGNING',
    'DEMO_SENT',
    'CUSTOMER_REVIEWING',
    'CUSTOMER_APPROVED',
    'SENT_TO_PRINT',
    'PRINTING',
    'PRINT_DONE',
    'DELIVERED'
];

const DesignOrderDetail: React.FC<DesignOrderDetailProps> = ({ orderId, onStatusChange }) => {
    const [order, setOrder] = React.useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    
    // For Demo Approval demo
    const [isDemoModalVisible, setIsDemoModalVisible] = useState(false);

    React.useEffect(() => {
        if (orderId) fetchOrderDetail();
    }, [orderId]);

    const fetchOrderDetail = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/designs/orders/${orderId}`);
            setOrder(res.data);
        } catch (error) {
            message.error('Lỗi lấy chi tiết đơn');
        }
        setLoading(false);
    };

    const updateStatus = async (newStatus: string) => {
        try {
            await api.put(`/designs/orders/${orderId}/status`, { status: newStatus });
            message.success('Đã cập nhật trạng thái');
            fetchOrderDetail();
            onStatusChange();
        } catch (error) {
            message.error('Lỗi cập nhật trạng thái');
        }
    };

    const currentStepIndex = STATUS_STEPS.indexOf(order?.status || 'INFO_COLLECTED');

    const handleUploadAI = async (options: any) => {
        const { file, onSuccess, onError } = options;
        const formData = new FormData();
        formData.append('file', file);
        formData.append('source', 'erp');
        setUploading(true);
        try {
            // Using existing image upload endpoint for now, ideally needs a generic file upload
            const res = await api.post('/upload/image', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            const currentFiles = order.design_files || [];
            await api.put(`/designs/orders/${orderId}`, {
                design_files: [...currentFiles, { url: res.data.url, name: file.name, uploaded_at: new Date().toISOString() }],
                final_design_file: res.data.url
            });
            message.success('Tải file thiết kế thành công');
            fetchOrderDetail();
            onSuccess();
        } catch (error) {
            onError(error);
            message.error('Lỗi tải file');
        }
        setUploading(false);
    };

    if (!order) return <div>Loading...</div>;

    return (
        <div>
            <Steps current={currentStepIndex} size="small" style={{ marginBottom: 24, flexWrap: 'wrap', rowGap: 16 }}>
                <Step title="Thu thập TT" />
                <Step title="Giao Thiết kế" />
                <Step title="Đang Thiết kế" />
                <Step title="Gửi Demo" />
                <Step title="Khách duyệt" />
                <Step title="Đã Chốt" />
                <Step title="Gửi Xưởng" />
                <Step title="Đang In" />
                <Step title="In Xong" />
                <Step title="Hoàn Thành" />
            </Steps>

            <Row gutter={16}>
                <Col span={16}>
                    <Card title="Thông tin chi tiết" size="small">
                        <Descriptions column={2} size="small" bordered>
                            <Descriptions.Item label="Mã Đơn">{order.code}</Descriptions.Item>
                            <Descriptions.Item label="Trường">{order.school_name}</Descriptions.Item>
                            <Descriptions.Item label="Sản phẩm">{order.product_type} {order.product_style ? `(${order.product_style})` : ''}</Descriptions.Item>
                            <Descriptions.Item label="Kích thước">{order.dimensions}</Descriptions.Item>
                            <Descriptions.Item label="Số lượng">{order.quantity}</Descriptions.Item>
                            <Descriptions.Item label="Màu nền">{order.background_color}</Descriptions.Item>
                            <Descriptions.Item label="Màu chữ in">{order.print_text_color}</Descriptions.Item>
                            <Descriptions.Item label="Nguồn Logo">{order.logo_source}</Descriptions.Item>
                            <Descriptions.Item label="Deadline TK">{order.design_deadline ? new Date(order.design_deadline).toLocaleDateString() : '-'}</Descriptions.Item>
                            <Descriptions.Item label="Nội dung cần in" span={2}>{order.print_content?.details || '-'}</Descriptions.Item>
                            <Descriptions.Item label="Ghi chú" span={2}>{order.notes || '-'}</Descriptions.Item>
                        </Descriptions>
                    </Card>

                    <Card title="Quản lý File Thiết kế (.AI, .PNG)" size="small" style={{ marginTop: 16 }}>
                        <Upload customRequest={handleUploadAI} showUploadList={false}>
                            <Button icon={<UploadOutlined />} loading={uploading}>Tải lên File Thiết kế</Button>
                        </Upload>
                        <Divider style={{ margin: '12px 0' }} />
                        {order.design_files && order.design_files.map((file: any, index: number) => (
                            <div key={index} style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', padding: '8px', background: '#f5f5f5', borderRadius: 4 }}>
                                <span>{file.name}</span>
                                <div>
                                    <Text type="secondary" style={{ marginRight: 16 }}>{new Date(file.uploaded_at).toLocaleString()}</Text>
                                    <a href={file.url} target="_blank" rel="noreferrer">Tải xuống</a>
                                </div>
                            </div>
                        ))}
                    </Card>
                </Col>

                <Col span={8}>
                    <Card title="Cập nhật Tiến độ" size="small">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <Button disabled={currentStepIndex >= 1} onClick={() => updateStatus('DESIGN_ASSIGNED')}>Giao cho Thiết kế</Button>
                            <Button disabled={currentStepIndex >= 2} onClick={() => updateStatus('DESIGNING')}>Bắt đầu Thiết kế</Button>
                            <Button disabled={currentStepIndex >= 3} onClick={() => {
                                updateStatus('DEMO_SENT');
                                setIsDemoModalVisible(true);
                            }} type={currentStepIndex === 2 ? 'primary' : 'default'}>
                                Gửi Demo cho Khách
                            </Button>
                            <Button disabled={currentStepIndex >= 4} onClick={() => updateStatus('CUSTOMER_REVIEWING')}>Khách đang phản hồi</Button>
                            <Button disabled={currentStepIndex >= 5} onClick={() => updateStatus('CUSTOMER_APPROVED')} type="primary" style={{ background: '#52c41a' }} icon={<CheckCircleOutlined />}>
                                Khách Đã Chốt Mẫu
                            </Button>
                            <Button disabled={currentStepIndex >= 6} onClick={() => updateStatus('SENT_TO_PRINT')}>Gửi Xưởng In</Button>
                            <Button disabled={currentStepIndex >= 7} onClick={() => updateStatus('PRINTING')}>Đang In</Button>
                            <Button disabled={currentStepIndex >= 8} onClick={() => updateStatus('PRINT_DONE')}>In Xong</Button>
                            <Button disabled={currentStepIndex >= 9} onClick={() => updateStatus('DELIVERED')}>Hoàn Thành (Giao hàng)</Button>
                        </div>
                    </Card>
                </Col>
            </Row>

            <Modal title="Tạo Link Gửi Khách Duyệt Mẫu" open={isDemoModalVisible} onCancel={() => setIsDemoModalVisible(false)} onOk={() => setIsDemoModalVisible(false)}>
                <p>Hệ thống hỗ trợ gửi link duyệt mẫu qua Portal.</p>
                <div style={{ padding: 16, background: '#f0f2f5', borderRadius: 4, wordBreak: 'break-all' }}>
                    <Text copyable>https://erp4u.vn/portal/quotes/{order.sales_order_id || 'preview'}</Text>
                </div>
                <p style={{ marginTop: 16 }}>Gửi link này cho khách hàng qua Zalo hoặc Email để họ xem và phản hồi trực tiếp trên hệ thống.</p>
            </Modal>
        </div>
    );
};

export default DesignOrderDetail;
