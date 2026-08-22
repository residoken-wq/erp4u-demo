import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Spin, Result, Button, message, Modal, Descriptions, Table, Tag, Typography, Form, Input, InputNumber, Steps, Card, Divider, Timeline, Space, Row, Col, Statistic } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, SendOutlined, TruckOutlined, ExclamationCircleOutlined, ClockCircleOutlined, BarChartOutlined } from '@ant-design/icons';
import { API_URL } from '../config';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const statusConfig: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
    'DRAFT': { color: '#999', label: 'Nháp', icon: <ClockCircleOutlined /> },
    'SENT': { color: '#1890ff', label: 'Chờ xác nhận', icon: <SendOutlined /> },
    'CONFIRMED': { color: '#722ed1', label: 'Đã xác nhận', icon: <CheckCircleOutlined /> },
    'ORDERED': { color: '#2f54eb', label: 'Đang thực hiện', icon: <BarChartOutlined /> },
    'PARTIAL_DELIVERED': { color: '#fa8c16', label: 'Giao 1 phần', icon: <TruckOutlined /> },
    'DELIVERED': { color: '#13c2c2', label: 'Đã giao đủ', icon: <TruckOutlined /> },
    'COMPLETED': { color: '#52c41a', label: 'Hoàn thành', icon: <CheckCircleOutlined /> },
    'CANCELLED': { color: '#ff4d4f', label: 'Đã hủy', icon: <CloseCircleOutlined /> },
};

const PortalPurchasePage: React.FC = () => {
    const { uuid } = useParams();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isProgressOpen, setIsProgressOpen] = useState(false);
    const [isRejectOpen, setIsRejectOpen] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [progressForm] = Form.useForm();
    const [rejectForm] = Form.useForm();

    const fetchData = () => {
        setLoading(true);
        axios.get(`${API_URL}/purchasing/portal/${uuid}`)
            .then(res => setData(res.data))
            .catch(() => { })
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchData(); }, [uuid]);

    const doAction = async (action: string, extraData?: any) => {
        setActionLoading(true);
        try {
            await axios.post(`${API_URL}/purchasing/portal/${uuid}/action`, { action, ...extraData });
            message.success(
                action === 'CONFIRM' ? 'Xác nhận thành công!' :
                    action === 'UPDATE_PROGRESS' ? 'Cập nhật tiến độ thành công!' :
                        action === 'MARK_COMPLETED' ? 'Đã báo hoàn thành!' :
                            'Thao tác thành công!'
            );
            fetchData();
        } catch (e: any) {
            message.error(e?.response?.data?.message || 'Có lỗi xảy ra');
        }
        setActionLoading(false);
    };

    const handleConfirm = () => {
        Modal.confirm({
            title: 'Xác nhận đơn hàng?',
            content: 'Bạn xác nhận sẽ cung cấp / gia công đơn hàng này.',
            icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
            okText: 'Xác nhận',
            cancelText: 'Hủy',
            onOk: () => doAction('CONFIRM')
        });
    };

    const handleMarkCompleted = () => {
        Modal.confirm({
            title: 'Xác nhận đã hoàn thành?',
            content: 'Bạn xác nhận đã hoàn thành toàn bộ đơn hàng và sẵn sàng giao.',
            icon: <TruckOutlined style={{ color: '#13c2c2' }} />,
            okText: 'Đã hoàn thành',
            cancelText: 'Hủy',
            onOk: () => doAction('MARK_COMPLETED')
        });
    };

    const handleProgress = async (values: any) => {
        await doAction('UPDATE_PROGRESS', {
            completed_qty: values.completed_qty,
            note: values.note
        });
        setIsProgressOpen(false);
        progressForm.resetFields();
    };

    const handleReject = async (values: any) => {
        await doAction('REJECT', { reason: values.reason, note: values.note });
        setIsRejectOpen(false);
        rejectForm.resetFields();
    };

    if (loading) return <Spin size="large" style={{ margin: '100px auto', display: 'block' }} />;
    if (!data) return <Result status="404" title="Không tìm thấy đơn hàng" subTitle="Link đã hết hạn hoặc đơn hàng không tồn tại." />;

    const sc = statusConfig[data.status] || statusConfig['DRAFT'];
    const progressUpdates = data.outsourcing_delivery_info?.progress_updates || [];
    const totalQty = (data.items || []).reduce((s: number, i: any) => s + Number(i.quantity), 0);
    const lastProgress = progressUpdates.length > 0 ? progressUpdates[progressUpdates.length - 1] : null;
    const totalCompleted = progressUpdates.reduce((s: number, p: any) => s + Number(p.completed_qty || 0), 0);
    const isActive = !['COMPLETED', 'CANCELLED', 'DELIVERED'].includes(data.status);

    // Determine step
    const stepMap: Record<string, number> = { 'DRAFT': 0, 'SENT': 0, 'CONFIRMED': 1, 'ORDERED': 2, 'PARTIAL_DELIVERED': 2, 'DELIVERED': 3, 'COMPLETED': 3, 'CANCELLED': -1 };
    const currentStep = stepMap[data.status] ?? 0;

    return (
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '30px 20px', minHeight: '100vh', background: 'linear-gradient(180deg, #f0f5ff 0%, #fff 100%)' }}>
            {/* HEADER */}
            <div style={{
                background: '#fff',
                borderRadius: 12,
                padding: '24px 32px',
                boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                marginBottom: 24,
                borderTop: `4px solid ${sc.color}`
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                    <div>
                        <Title level={3} style={{ margin: 0, color: '#1d1d1d' }}>
                            {data.type === 'OUTSOURCING' ? '📋 ĐƠN GIA CÔNG' : '📦 ĐƠN ĐẶT HÀNG (PO)'}
                        </Title>
                        <Text type="secondary" style={{ fontSize: 14 }}>
                            Mã: <b style={{ color: '#1890ff', fontSize: 16 }}>{data.po_code}</b>
                        </Text>
                    </div>
                    <Tag color={sc.color} style={{ fontSize: 15, padding: '6px 16px', borderRadius: 20 }}>
                        {sc.icon} <span style={{ marginLeft: 6 }}>{sc.label}</span>
                    </Tag>
                </div>

                {/* PROGRESS STEPS */}
                {data.status !== 'CANCELLED' && (
                    <Steps
                        current={currentStep}
                        size="small"
                        style={{ marginTop: 20 }}
                        items={[
                            { title: 'Nhận đơn' },
                            { title: 'Xác nhận' },
                            { title: 'Thực hiện' },
                            { title: 'Hoàn thành' },
                        ]}
                    />
                )}
            </div>

            {/* MAIN CONTENT */}
            <div style={{ background: '#fff', borderRadius: 12, padding: '24px 32px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', marginBottom: 24 }}>
                <Descriptions bordered column={2} size="small">
                    <Descriptions.Item label="Nhà cung cấp" span={2}><b>{data.supplier?.name || '-'}</b></Descriptions.Item>
                    <Descriptions.Item label="Ngày đặt">{dayjs(data.created_at).format('DD/MM/YYYY')}</Descriptions.Item>
                    <Descriptions.Item label="Loại đơn"><Tag color={data.type === 'OUTSOURCING' ? 'purple' : 'blue'}>{data.type === 'OUTSOURCING' ? 'Gia công' : 'Mua NPL'}</Tag></Descriptions.Item>
                    {data.note && <Descriptions.Item label="Ghi chú" span={2}>{data.note}</Descriptions.Item>}
                </Descriptions>

                <Divider orientation="left" style={{ fontSize: 14 }}>Danh sách hàng hóa</Divider>

                <Table
                    dataSource={data.items || []}
                    rowKey="id"
                    pagination={false}
                    bordered
                    size="small"
                    columns={[
                        {
                            title: 'Tên hàng / Công đoạn',
                            render: (r: any) => <b>{r.material?.name || r.product?.name || r.description || '-'}</b>
                        },
                        { title: 'ĐVT', width: 60, align: 'center' as const, render: (r: any) => r.material?.unit || r.product?.unit || 'Cái' },
                        { title: 'Số lượng', dataIndex: 'quantity', width: 90, align: 'center' as const, render: (v: any) => <b>{Number(v).toLocaleString()}</b> },
                        { title: 'Đơn giá', dataIndex: 'unit_price', width: 110, align: 'right' as const, render: (v: any) => Number(v).toLocaleString() },
                        { title: 'Thành tiền', dataIndex: 'subtotal', width: 130, align: 'right' as const, render: (v: any) => <b style={{ color: '#1890ff' }}>{Number(v).toLocaleString()}</b> },
                        { 
                            title: 'Ghi chú', 
                            render: (r: any) => (
                                <div>
                                    {r.note && <div>{r.note}</div>}
                                    {r.internal_note && <div style={{ color: '#cf1322', fontStyle: 'italic', fontSize: 11 }}>NB: {r.internal_note}</div>}
                                </div>
                            )
                        }
                    ]}
                    summary={(pageData: readonly any[]) => {
                        let total = 0;
                        pageData.forEach((item: any) => { total += Number(item.subtotal || 0); });
                        return (
                            <Table.Summary.Row style={{ background: '#fafafa' }}>
                                <Table.Summary.Cell index={0} colSpan={4} align="right"><b>TỔNG CỘNG</b></Table.Summary.Cell>
                                <Table.Summary.Cell index={1} align="right"><b style={{ fontSize: 16, color: '#1890ff' }}>{total.toLocaleString()} ₫</b></Table.Summary.Cell>
                                <Table.Summary.Cell index={2}></Table.Summary.Cell>
                            </Table.Summary.Row>
                        );
                    }}
                />
            </div>

            {/* SUPPLIER PO TEMPLATE VIEW */}
            {data.supplier?.po_template && (
                <div style={{ background: '#fff', borderRadius: 12, padding: '24px 32px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', marginBottom: 24, overflowX: 'auto' }}>
                    <Divider orientation="left" style={{ fontSize: 14, marginTop: 0 }}>📄 Mẫu Đơn Đặt Hàng</Divider>
                    <div 
                        dangerouslySetInnerHTML={{ 
                            __html: data.supplier.po_template
                                .replace(/\{\{poCode\}\}/g, data.po_code || '')
                                .replace(/\{\{supplierName\}\}/g, data.supplier?.name || '')
                                .replace(/\{\{date\}\}/g, dayjs(data.created_at).format('DD/MM/YYYY'))
                                .replace(/\{\{totalAmount\}\}/g, Number(data.total_amount || 0).toLocaleString())
                                .replace(/\{\{itemsTable\}\}/g, `<table style="width: 100%; border-collapse: collapse; margin-top: 10px;" border="1">
                                    <thead><tr><th style="padding: 5px">STT</th><th style="padding: 5px">Sản phẩm / Công đoạn</th><th style="padding: 5px">Số lượng</th><th style="padding: 5px">Đơn giá</th><th style="padding: 5px">Thành tiền</th></tr></thead>
                                    <tbody>
                                        ${data.items?.map((i: any, idx: number) => `<tr><td style="padding: 5px; text-align: center;">${idx + 1}</td><td style="padding: 5px">${i.description || i.product?.name || i.material?.name || '-'}</td><td style="padding: 5px; text-align: center;">${Number(i.quantity).toLocaleString()}</td><td style="padding: 5px; text-align: center;">${Number(i.unit_price || 0).toLocaleString()}</td><td style="padding: 5px; text-align: center;">${Number(i.subtotal || 0).toLocaleString()}</td></tr>`).join('') || ''}
                                    </tbody>
                                </table>`)
                        }} 
                        style={{ padding: 20, border: '1px solid #f0f0f0', borderRadius: 8, minHeight: 100 }}
                    />
                </div>
            )}

            {/* PRINT DESIGNS (Outsourcing) */}
            {data.type === 'OUTSOURCING' && data.items?.some((i: any) => i.print_design) && (
                <div style={{ background: '#fff', borderRadius: 12, padding: '24px 32px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', marginBottom: 24 }}>
                    <Divider orientation="left" style={{ fontSize: 14, marginTop: 0 }}>🎨 Thiết kế In ấn & Thêu</Divider>
                    <Table
                        dataSource={data.items.filter((i: any) => i.print_design)}
                        rowKey="id"
                        pagination={false}
                        bordered
                        size="small"
                        columns={[
                            {
                                title: 'Sản phẩm',
                                render: (r: any) => <b>{r.material?.name || r.product?.name || r.description || '-'}</b>
                            },
                            {
                                title: 'Tên Sơ đồ',
                                render: (r: any) => r.print_design?.name
                            },
                            {
                                title: 'Sơ đồ Bố cục',
                                render: (r: any) => r.print_design?.layout_image_url ? <a href={r.print_design.layout_image_url} target="_blank" rel="noreferrer"><img src={r.print_design.layout_image_url} style={{height: 50, objectFit: 'contain'}} alt="layout" /></a> : 'Chưa có'
                            },
                            {
                                title: 'Loại',
                                render: (r: any) => <Tag color={r.print_design?.type === 'PRINT' ? 'blue' : 'purple'}>{r.print_design?.type}</Tag>
                            }
                        ]}
                    />
                </div>
            )}

            {/* PROGRESS TRACKING (Outsourcing) */}
            {data.type === 'OUTSOURCING' && (
                <div style={{ background: '#fff', borderRadius: 12, padding: '24px 32px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', marginBottom: 24 }}>
                    <Divider orientation="left" style={{ fontSize: 14, marginTop: 0 }}>📊 Tiến độ gia công</Divider>

                    <Row gutter={16} style={{ marginBottom: 16 }}>
                        <Col span={8}>
                            <Card size="small"><Statistic title="Tổng SL đặt" value={totalQty} /></Card>
                        </Col>
                        <Col span={8}>
                            <Card size="small"><Statistic title="Đã hoàn thành" value={totalCompleted} valueStyle={{ color: '#52c41a' }} suffix={`/ ${totalQty}`} /></Card>
                        </Col>
                        <Col span={8}>
                            <Card size="small">
                                <Statistic
                                    title="Tỷ lệ"
                                    value={totalQty > 0 ? Math.round(totalCompleted / totalQty * 100) : 0}
                                    suffix="%"
                                    valueStyle={{ color: totalCompleted >= totalQty ? '#52c41a' : '#1890ff' }}
                                />
                            </Card>
                        </Col>
                    </Row>

                    {progressUpdates.length > 0 ? (
                        <Timeline style={{ marginTop: 16 }}>
                            {progressUpdates.map((p: any, idx: number) => (
                                <Timeline.Item key={idx} color={idx === progressUpdates.length - 1 ? 'green' : 'blue'}>
                                    <div><b>Lần {idx + 1}</b> — <Text type="secondary">{dayjs(p.timestamp).format('DD/MM/YYYY HH:mm')}</Text></div>
                                    <div>SL hoàn thành: <b style={{ color: '#52c41a' }}>{Number(p.completed_qty).toLocaleString()}</b></div>
                                    {p.note && <div><i>{p.note}</i></div>}
                                </Timeline.Item>
                            ))}
                        </Timeline>
                    ) : (
                        <div style={{ textAlign: 'center', color: '#999', padding: 20 }}>Chưa có cập nhật tiến độ</div>
                    )}
                </div>
            )}

            {/* ACTION BUTTONS */}
            {isActive && (
                <div style={{ background: '#fff', borderRadius: 12, padding: '20px 32px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', marginBottom: 24 }}>
                    <Divider orientation="left" style={{ fontSize: 14, marginTop: 0 }}>Thao tác</Divider>
                    <Space size={12} wrap>
                        {['DRAFT', 'SENT'].includes(data.status) && (
                            <>
                                <Button type="primary" size="large" icon={<CheckCircleOutlined />} onClick={handleConfirm} loading={actionLoading}>
                                    ✅ Xác nhận đơn hàng
                                </Button>
                                <Button danger size="large" icon={<CloseCircleOutlined />} onClick={() => setIsRejectOpen(true)}>
                                    ❌ Từ chối
                                </Button>
                            </>
                        )}
                        {['CONFIRMED', 'ORDERED', 'PARTIAL_DELIVERED'].includes(data.status) && (
                            <>
                                <Button type="default" size="large" icon={<BarChartOutlined />} onClick={() => setIsProgressOpen(true)}>
                                    📊 Cập nhật tiến độ
                                </Button>
                                <Button type="primary" size="large" style={{ background: '#13c2c2', borderColor: '#13c2c2' }} icon={<TruckOutlined />} onClick={handleMarkCompleted} loading={actionLoading}>
                                    🚚 Báo hoàn thành
                                </Button>
                            </>
                        )}
                    </Space>
                </div>
            )}

            {/* Rejection info */}
            {data.outsourcing_delivery_info?.rejection && (
                <div style={{ background: '#fff2f0', borderRadius: 12, padding: '20px 32px', border: '1px solid #ffccc7', marginBottom: 24 }}>
                    <b style={{ color: '#ff4d4f' }}>❌ Đơn hàng đã bị từ chối</b>
                    <div style={{ marginTop: 8 }}>Lý do: <i>{data.outsourcing_delivery_info.rejection.reason}</i></div>
                    <div><Text type="secondary">{dayjs(data.outsourcing_delivery_info.rejection.rejected_at).format('DD/MM/YYYY HH:mm')}</Text></div>
                </div>
            )}

            {/* Completion info */}
            {data.outsourcing_delivery_info?.completed_at && (
                <div style={{ background: '#f6ffed', borderRadius: 12, padding: '20px 32px', border: '1px solid #b7eb8f', marginBottom: 24 }}>
                    <b style={{ color: '#52c41a' }}>✅ Đã hoàn thành giao hàng</b>
                    {data.outsourcing_delivery_info.completion_note && (
                        <div style={{ marginTop: 8 }}>Ghi chú: <i>{data.outsourcing_delivery_info.completion_note}</i></div>
                    )}
                    <div><Text type="secondary">{dayjs(data.outsourcing_delivery_info.completed_at).format('DD/MM/YYYY HH:mm')}</Text></div>
                </div>
            )}

            {/* FOOTER */}
            <div style={{ textAlign: 'center', color: '#999', fontSize: 12, marginTop: 30 }}>
                ERP4U — Supplier Portal | Powered by AI
            </div>

            {/* UPDATE PROGRESS MODAL */}
            <Modal
                title="📊 Cập nhật Tiến độ Gia công"
                open={isProgressOpen}
                onCancel={() => setIsProgressOpen(false)}
                onOk={() => progressForm.submit()}
                okText="Gửi cập nhật"
                confirmLoading={actionLoading}
            >
                <Form form={progressForm} layout="vertical" onFinish={handleProgress}>
                    <Form.Item name="completed_qty" label="Số lượng đã hoàn thành (lần này)" rules={[{ required: true }]}>
                        <InputNumber min={1} style={{ width: '100%' }} placeholder="VD: 150" />
                    </Form.Item>
                    <Form.Item name="note" label="Ghi chú">
                        <Input.TextArea rows={3} placeholder="Mô tả tiến độ, vấn đề gặp phải..." />
                    </Form.Item>
                </Form>
            </Modal>

            {/* REJECT MODAL */}
            <Modal
                title="❌ Từ chối Đơn hàng"
                open={isRejectOpen}
                onCancel={() => setIsRejectOpen(false)}
                onOk={() => rejectForm.submit()}
                okText="Xác nhận từ chối"
                okButtonProps={{ danger: true }}
                confirmLoading={actionLoading}
            >
                <Form form={rejectForm} layout="vertical" onFinish={handleReject}>
                    <Form.Item name="reason" label="Lý do từ chối" rules={[{ required: true, message: 'Vui lòng nhập lý do' }]}>
                        <Input.TextArea rows={3} placeholder="Nhập lý do từ chối đơn hàng..." />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default PortalPurchasePage;