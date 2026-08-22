import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Spin, Result, Button, message, Modal, Typography, Table, Tag, Input, Tabs, Card, Row, Col, Progress, Space, Divider } from 'antd';
import { LockOutlined, ShopOutlined, FileTextOutlined, UnorderedListOutlined, CheckCircleOutlined, SyncOutlined } from '@ant-design/icons';
import { API_URL } from '../config';
import dayjs from 'dayjs';
import useMobile from '../hooks/useMobile';

const { Title, Text } = Typography;

const PortalSupplierDashboard: React.FC = () => {
    const { uuid } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isPasswordCorrect, setIsPasswordCorrect] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const isMobile = useMobile();

    const fetchPortalData = async () => {
        try {
            const res = await axios.get(`${API_URL}/purchasing/supplier-portal/${uuid}`);
            setData(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPortalData();
    }, [uuid]);

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spin size="large" tip="Đang tải dữ liệu..." /></div>;
    if (!data) return <Result status="404" title="404" subTitle="Không tìm thấy dữ liệu hoặc đường dẫn không hợp lệ." />;

    if (!isPasswordCorrect) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f4f7f6' }}>
                <Modal
                    title={<span style={{ fontWeight: 700 }}><LockOutlined /> Mật Khẩu Truy Cập NCC</span>}
                    open={true}
                    closable={false}
                    maskClosable={false}
                    footer={[
                        <Button key="submit" type="primary" onClick={() => {
                            if (['erp4u', 'ERP4U', 'ERP4U'].includes(passwordInput.trim())) {
                                setIsPasswordCorrect(true);
                            } else {
                                message.error('Mật khẩu không chính xác!');
                            }
                        }}>
                            Xác nhận truy cập
                        </Button>
                    ]}
                >
                    <div style={{ marginBottom: 16 }}>
                        Để bảo mật thông tin, vui lòng nhập mật khẩu để xem Dashboard Nhà Cung Cấp.
                    </div>
                    <Input.Password
                        placeholder="Nhập mật khẩu (erp4u)..."
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        onPressEnter={() => {
                            if (['erp4u', 'ERP4U', 'ERP4U'].includes(passwordInput.trim())) {
                                setIsPasswordCorrect(true);
                            } else {
                                message.error('Mật khẩu không chính xác!');
                            }
                        }}
                        autoFocus
                    />
                </Modal>
            </div>
        );
    }

    const { supplier, pos, qcLogs } = data;

    // TABS 1: POs
    const poColumns = [
        { title: 'Mã Đơn', dataIndex: 'po_code', key: 'po_code', render: (text: string, record: any) => <a onClick={() => window.open(`/portal/po/${record.uuid}`, '_blank')}>{text}</a> },
        { title: 'Ngày tạo', dataIndex: 'created_at', key: 'created_at', render: (val: any) => dayjs(val).format('DD/MM/YYYY HH:mm') },
        { 
            title: 'Trạng thái', dataIndex: 'status', key: 'status', 
            render: (status: string) => {
                let color = 'default';
                if (status === 'CONFIRMED') color = 'blue';
                if (status === 'ORDERED') color = 'cyan';
                if (status === 'DELIVERED') color = 'green';
                if (status === 'COMPLETED') color = 'success';
                if (status === 'CANCELLED') color = 'red';
                return <Tag color={color}>{status}</Tag>;
            }
        },
        { title: 'Tổng tiền', dataIndex: 'total_amount', key: 'total_amount', render: (val: any) => `${Number(val).toLocaleString()} đ` },
    ];

    // TABS 2: Items
    const allItems = pos.flatMap((po: any) => (po.items || []).map((item: any) => ({ ...item, po_code: po.po_code, po_status: po.status, po_uuid: po.uuid })));
    const itemColumns = [
        { title: 'Mã Đơn (PO)', dataIndex: 'po_code', key: 'po_code', render: (text: string, record: any) => <a onClick={() => window.open(`/portal/po/${record.po_uuid}`, '_blank')}>{text}</a> },
        { title: 'Sản phẩm/NPL', key: 'product_name', render: (_: any, record: any) => record.product?.name || record.material?.name || record.description || 'Không rõ' },
        { title: 'Số lượng', dataIndex: 'quantity', key: 'quantity', render: (val: any) => Number(val).toLocaleString() },
        { title: 'Đơn giá', dataIndex: 'unit_price', key: 'unit_price', render: (val: any) => `${Number(val).toLocaleString()} đ` },
        { title: 'Thành tiền', dataIndex: 'subtotal', key: 'subtotal', render: (val: any) => `${Number(val).toLocaleString()} đ` },
    ];

    // TABS 3: Processing Status
    const processingColumns = [
        { title: 'Mã Đơn', dataIndex: 'po_code', key: 'po_code' },
        { 
            title: 'Tiến độ', key: 'progress', render: (_: any, record: any) => {
                const info = record.outsourcing_delivery_info || {};
                const updates = info.progress_updates || [];
                const latest = updates.length > 0 ? updates[updates.length - 1] : null;
                const totalCompleted = latest ? latest.completed_qty : 0;
                // Calculate total PO quantity roughly
                const totalPOQty = (record.items || []).reduce((sum: number, i: any) => sum + Number(i.quantity), 0);
                const percent = totalPOQty > 0 ? Math.round((totalCompleted / totalPOQty) * 100) : 0;

                return (
                    <div style={{ width: 200 }}>
                        <Progress percent={percent > 100 ? 100 : percent} size="small" />
                        <div style={{ fontSize: 12, color: '#888' }}>
                            {totalCompleted} / {totalPOQty} hoàn thành
                        </div>
                    </div>
                );
            }
        },
        { 
            title: 'Cập nhật gần nhất', key: 'latest_update', render: (_: any, record: any) => {
                const info = record.outsourcing_delivery_info || {};
                const updates = info.progress_updates || [];
                const latest = updates.length > 0 ? updates[updates.length - 1] : null;
                if (!latest) return <Text type="secondary">Chưa cập nhật</Text>;
                return (
                    <div>
                        <div style={{ fontSize: 12 }}>{dayjs(latest.timestamp).format('DD/MM/YYYY HH:mm')}</div>
                        <div style={{ fontSize: 13, fontStyle: 'italic' }}>{latest.note}</div>
                    </div>
                );
            }
        }
    ];

    // TABS 4: QC Updates
    const qcColumns = [
        { title: 'Mã QC', dataIndex: 'code', key: 'code' },
        { title: 'Ngày kiểm', dataIndex: 'inspection_date', key: 'inspection_date', render: (val: any) => val ? dayjs(val).format('DD/MM/YYYY') : '-' },
        { 
            title: 'Trạng thái', dataIndex: 'status', key: 'status',
            render: (status: string) => {
                let color = 'default';
                if (status === 'PASSED') color = 'success';
                if (status === 'FAILED') color = 'error';
                if (status === 'CONDITIONAL') color = 'warning';
                if (status === 'IN_PROGRESS') color = 'processing';
                return <Tag color={color}>{status}</Tag>;
            }
        },
        { title: 'SL Kiểm / Nhận', key: 'qty', render: (_: any, r: any) => `${r.inspected_quantity} / ${r.total_quantity}` },
        { title: 'SL Đạt', dataIndex: 'passed_quantity', key: 'passed_quantity', render: (val: any) => <Text type="success" strong>{val}</Text> },
        { title: 'SL Lỗi', dataIndex: 'defect_quantity', key: 'defect_quantity', render: (val: any) => val > 0 ? <Text type="danger" strong>{val}</Text> : val },
        { title: 'Ghi chú', dataIndex: 'note', key: 'note' },
    ];

    return (
        <div style={{ minHeight: '100vh', background: '#f0f2f5', padding: isMobile ? '10px' : '20px 40px' }}>
            <Card style={{ marginBottom: 20, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <Row align="middle" justify="space-between">
                    <Col>
                        <Title level={isMobile ? 4 : 3} style={{ margin: 0, color: '#0050b3' }}>
                            <ShopOutlined style={{ marginRight: 10 }} />
                            {supplier.name} - Supplier Portal
                        </Title>
                        <Text type="secondary">Mã NCC: <b>{supplier.code}</b></Text>
                    </Col>
                    <Col>
                        <Button type="primary" icon={<SyncOutlined />} onClick={fetchPortalData}>Làm mới</Button>
                    </Col>
                </Row>
            </Card>

            <Tabs 
                defaultActiveKey="1" 
                type="card"
                items={[
                    {
                        key: '1',
                        label: <span><FileTextOutlined /> Đơn Đặt Hàng</span>,
                        children: (
                            <Card style={{ borderRadius: 12 }}>
                                <Table 
                                    dataSource={pos} 
                                    columns={poColumns} 
                                    rowKey="id" 
                                    scroll={{ x: 'max-content' }}
                                    pagination={{ pageSize: 15 }}
                                />
                            </Card>
                        )
                    },
                    {
                        key: '2',
                        label: <span><UnorderedListOutlined /> Danh Sách Items</span>,
                        children: (
                            <Card style={{ borderRadius: 12 }}>
                                <Table 
                                    dataSource={allItems} 
                                    columns={itemColumns} 
                                    rowKey="id" 
                                    scroll={{ x: 'max-content' }}
                                    pagination={{ pageSize: 20 }}
                                />
                            </Card>
                        )
                    },
                    {
                        key: '3',
                        label: <span><SyncOutlined spin /> Trạng Thái Xử Lý</span>,
                        children: (
                            <Card style={{ borderRadius: 12 }}>
                                <Table 
                                    dataSource={pos.filter((p: any) => p.status !== 'DRAFT' && p.status !== 'CANCELLED')} 
                                    columns={processingColumns} 
                                    rowKey="id" 
                                    scroll={{ x: 'max-content' }}
                                    pagination={{ pageSize: 15 }}
                                />
                            </Card>
                        )
                    },
                    {
                        key: '4',
                        label: <span><CheckCircleOutlined /> Lịch Sử QC (Kiểm Chất Lượng)</span>,
                        children: (
                            <Card style={{ borderRadius: 12 }}>
                                <Table 
                                    dataSource={qcLogs} 
                                    columns={qcColumns} 
                                    rowKey="id" 
                                    scroll={{ x: 'max-content' }}
                                    pagination={{ pageSize: 15 }}
                                />
                            </Card>
                        )
                    }
                ]}
            />
        </div>
    );
};

export default PortalSupplierDashboard;
