import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Progress, Spin, Divider, Empty, Tabs } from 'antd';
import {
    DashboardOutlined, CheckCircleOutlined, ClockCircleOutlined,
    WarningOutlined, TruckOutlined, ExperimentOutlined, ShopOutlined,
    RiseOutlined, FallOutlined
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { API_URL } from '../config';

const ProductionDashboardPage: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [plans, setPlans] = useState<any[]>([]);
    const [pos, setPOs] = useState<any[]>([]);
    const [qcSummary, setQcSummary] = useState<any>(null);
    const [assignments, setAssignments] = useState<any[]>([]);

    const fetchDashboard = async () => {
        setLoading(true);
        try {
            const [plansRes, posRes, qcRes, assignRes] = await Promise.all([
                axios.get(`${API_URL}/planning`),
                axios.get(`${API_URL}/purchasing`),
                axios.get(`${API_URL}/qc/summary`).catch(() => ({ data: null })),
                axios.get(`${API_URL}/production/assignments`).catch(() => ({ data: [] }))
            ]);
            setPlans(Array.isArray(plansRes.data) ? plansRes.data : []);
            setPOs(Array.isArray(posRes.data) ? posRes.data : []);
            setQcSummary(qcRes.data);
            setAssignments(Array.isArray(assignRes.data) ? assignRes.data : []);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => { fetchDashboard(); }, []);

    if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

    // --- COMPUTE METRICS ---
    const activePlans = plans.filter(p => ['CALCULATED', 'IN_PRODUCTION'].includes(p.status));
    const completedPlans = plans.filter(p => p.status === 'COMPLETED');
    const overduePlans = activePlans.filter(p => p.end_date && dayjs(p.end_date).isBefore(dayjs()));

    const outsourcingPOs = pos.filter(p => p.type === 'OUTSOURCING');
    const materialPOs = pos.filter(p => p.type === 'MATERIAL');
    const deliveredPOs = pos.filter(p => ['DELIVERED', 'COMPLETED'].includes(p.status));
    const pendingPOs = pos.filter(p => ['DRAFT', 'SENT', 'CONFIRMED', 'ORDERED'].includes(p.status));
    const overduePOs = pendingPOs.filter(p => p.expected_delivery_date && dayjs(p.expected_delivery_date).isBefore(dayjs()));

    // On-time delivery rate
    const totalDelivered = deliveredPOs.length;
    // Simple heuristic: if delivered and no explicit late flag, count as on-time
    const onTimeRate = totalDelivered > 0 ? Math.round((totalDelivered / (totalDelivered + overduePOs.length)) * 100) : 0;

    // Cost aggregation
    const totalPOAmount = pos.reduce((s, p) => s + Number(p.total_amount || 0), 0);
    const totalPaid = pos.reduce((s, p) => s + Number(p.paid_amount || 0), 0);
    const totalOutsourcingCost = outsourcingPOs.reduce((s, p) => s + Number(p.total_amount || 0), 0);
    const totalMaterialCost = materialPOs.reduce((s, p) => s + Number(p.total_amount || 0), 0);

    // Assignment metrics
    const activeAssignments = assignments.filter(a => ['ASSIGNED', 'IN_PROGRESS'].includes(a.status));
    const completedAssignments = assignments.filter(a => a.status === 'COMPLETED');
    const totalAssignedQty = assignments.reduce((s, a) => s + Number(a.assigned_quantity || 0), 0);
    const totalCompletedQty = assignments.reduce((s, a) => s + Number(a.completed_quantity || 0), 0);

    const poStatusColor = (s: string) => {
        switch (s) {
            case 'COMPLETED': case 'DELIVERED': return 'green';
            case 'ORDERED': case 'CONFIRMED': return 'blue';
            case 'PARTIAL_DELIVERED': return 'orange';
            case 'CANCELLED': return 'red';
            default: return 'default';
        }
    };

    return (
        <div>
            <h2 style={{ marginBottom: 16 }}>📊 Dashboard Sản Xuất</h2>

            {/* ROW 1: Overview Cards */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={12} sm={6}>
                    <Card size="small" style={{ borderTop: '3px solid #1890ff' }}>
                        <Statistic title="Kế hoạch đang SX" value={activePlans.length} prefix={<ClockCircleOutlined />} valueStyle={{ color: '#1890ff' }} />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card size="small" style={{ borderTop: '3px solid #52c41a' }}>
                        <Statistic title="KH Hoàn thành" value={completedPlans.length} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card size="small" style={{ borderTop: '3px solid #ff4d4f' }}>
                        <Statistic title="KH Quá hạn" value={overduePlans.length} prefix={<WarningOutlined />} valueStyle={{ color: overduePlans.length > 0 ? '#ff4d4f' : '#999' }} />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card size="small" style={{ borderTop: '3px solid #13c2c2' }}>
                        <Statistic
                            title="Tỷ lệ giao đúng hạn"
                            value={onTimeRate}
                            suffix="%"
                            prefix={onTimeRate >= 80 ? <RiseOutlined /> : <FallOutlined />}
                            valueStyle={{ color: onTimeRate >= 80 ? '#52c41a' : onTimeRate >= 60 ? '#fa8c16' : '#ff4d4f' }}
                        />
                    </Card>
                </Col>
            </Row>

            {/* ROW 2: Financial & Production Summary */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={12} sm={6}>
                    <Card size="small">
                        <Statistic title="Tổng giá trị PO" value={totalPOAmount} formatter={(v) => Number(v).toLocaleString() + ' ₫'} />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card size="small">
                        <Statistic title="Chi phí NPL" value={totalMaterialCost} formatter={(v) => Number(v).toLocaleString() + ' ₫'} valueStyle={{ color: '#722ed1' }} />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card size="small">
                        <Statistic title="Chi phí Gia công" value={totalOutsourcingCost} formatter={(v) => Number(v).toLocaleString() + ' ₫'} valueStyle={{ color: '#eb2f96' }} />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card size="small">
                        <Statistic title="Đã thanh toán" value={totalPaid} formatter={(v) => Number(v).toLocaleString() + ' ₫'} valueStyle={{ color: '#52c41a' }} />
                    </Card>
                </Col>
            </Row>

            <Tabs defaultActiveKey="plans" items={[
                {
                    key: 'plans', label: '📋 Kế hoạch SX', children: (
                        <Table
                            dataSource={activePlans.concat(completedPlans).slice(0, 20)}
                            rowKey="id"
                            size="small"
                            pagination={false}
                            columns={[
                                { title: 'Mã KH', dataIndex: 'code', width: 120, render: (t: any) => <b>{t}</b> },
                                { title: 'Tên đợt', dataIndex: 'name', ellipsis: true },
                                { title: 'Thời gian', width: 160, render: (r: any) => <small>{dayjs(r.start_date).format('DD/MM')} → {dayjs(r.end_date).format('DD/MM/YY')}</small> },
                                {
                                    title: 'Trạng thái', dataIndex: 'status', width: 120, align: 'center' as const,
                                    render: (s: string) => <Tag color={s === 'COMPLETED' ? 'green' : s === 'IN_PRODUCTION' ? 'blue' : s === 'CALCULATED' ? 'cyan' : 'default'}>{s === 'COMPLETED' ? '✅ Xong' : s === 'IN_PRODUCTION' ? '🔄 Đang SX' : s === 'CALCULATED' ? '📐 Đã tính' : '📝 Mới'}</Tag>
                                },
                                {
                                    title: 'Quá hạn', width: 80, align: 'center' as const,
                                    render: (r: any) => {
                                        if (!r.end_date) return '-';
                                        const days = dayjs().diff(dayjs(r.end_date), 'day');
                                        return days > 0 ? <Tag color="red">{days}d</Tag> : <Tag color="green">OK</Tag>;
                                    }
                                }
                            ]}
                        />
                    )
                },
                {
                    key: 'pos', label: '📦 Đơn mua hàng / GC', children: (
                        <Table
                            dataSource={pos.slice(0, 30)}
                            rowKey="id"
                            size="small"
                            pagination={{ pageSize: 15 }}
                            columns={[
                                { title: 'Mã PO', dataIndex: 'po_code', width: 140, render: (t: any) => <b>{t}</b> },
                                { title: 'Loại', dataIndex: 'type', width: 90, align: 'center' as const, render: (t: string) => <Tag color={t === 'OUTSOURCING' ? 'purple' : 'blue'}>{t === 'OUTSOURCING' ? 'GC' : 'NPL'}</Tag> },
                                { title: 'Giá trị', dataIndex: 'total_amount', width: 120, align: 'right' as const, render: (v: any) => Number(v).toLocaleString() },
                                { title: 'Trạng thái', dataIndex: 'status', width: 130, align: 'center' as const, render: (s: string) => <Tag color={poStatusColor(s)}>{s}</Tag> }
                            ]}
                        />
                    )
                },
                {
                    key: 'qc', label: '🔬 Chất lượng (QC)', children: qcSummary ? (
                        <div>
                            <Row gutter={16} style={{ marginBottom: 16 }}>
                                <Col span={4}><Card size="small"><Statistic title="Tổng phiếu QC" value={qcSummary.total_inspections} /></Card></Col>
                                <Col span={4}><Card size="small"><Statistic title="Đạt" value={qcSummary.passed} valueStyle={{ color: '#52c41a' }} /></Card></Col>
                                <Col span={4}><Card size="small"><Statistic title="Đạt ĐK" value={qcSummary.conditional} valueStyle={{ color: '#fa8c16' }} /></Card></Col>
                                <Col span={4}><Card size="small"><Statistic title="Không đạt" value={qcSummary.failed} valueStyle={{ color: '#ff4d4f' }} /></Card></Col>
                                <Col span={4}>
                                    <Card size="small">
                                        <Statistic
                                            title="Tỷ lệ đạt"
                                            value={qcSummary.total_inspections > 0 ? Math.round(((qcSummary.passed + qcSummary.conditional) / qcSummary.total_inspections) * 100) : 0}
                                            suffix="%" valueStyle={{ color: '#52c41a' }}
                                        />
                                    </Card>
                                </Col>
                                <Col span={4}><Card size="small"><Statistic title="Đang kiểm" value={qcSummary.in_progress} valueStyle={{ color: '#1890ff' }} /></Card></Col>
                            </Row>

                            <Divider orientation="left" style={{ fontSize: 13 }}>Thống kê theo NCC</Divider>
                            {qcSummary.by_supplier?.length > 0 ? (
                                <Table
                                    dataSource={qcSummary.by_supplier}
                                    rowKey="supplier_id"
                                    size="small"
                                    pagination={false}
                                    columns={[
                                        { title: 'Nhà cung cấp', dataIndex: 'supplier_name' },
                                        { title: 'Tổng', dataIndex: 'total', width: 60, align: 'center' as const },
                                        { title: 'Đạt', dataIndex: 'passed', width: 60, align: 'center' as const, render: (v: number) => <span style={{ color: '#52c41a' }}>{v}</span> },
                                        { title: 'Fail', dataIndex: 'failed', width: 60, align: 'center' as const, render: (v: number) => <span style={{ color: v > 0 ? '#ff4d4f' : '#999' }}>{v}</span> },
                                        {
                                            title: 'Tỷ lệ đạt', width: 100, render: (r: any) => {
                                                const rate = r.total > 0 ? Math.round(r.passed / r.total * 100) : 0;
                                                return <Progress percent={rate} size="small" strokeColor={rate >= 80 ? '#52c41a' : rate >= 60 ? '#fa8c16' : '#ff4d4f'} />;
                                            }
                                        },
                                        {
                                            title: '% Lỗi TB', width: 100, align: 'center' as const, render: (r: any) => {
                                                const rate = r.total_inspected > 0 ? (r.total_defects / r.total_inspected * 100) : 0;
                                                return <Tag color={rate > 5 ? 'red' : rate > 2 ? 'orange' : 'green'}>{rate.toFixed(1)}%</Tag>;
                                            }
                                        }
                                    ]}
                                />
                            ) : <Empty description="Chưa có dữ liệu" />}
                        </div>
                    ) : <Empty description="QC module chưa có dữ liệu" />
                },
                {
                    key: 'outsourcing', label: '🏭 Gia công', children: (
                        <div>
                            <Row gutter={16} style={{ marginBottom: 16 }}>
                                <Col span={6}><Card size="small"><Statistic title="Phân bổ đang chạy" value={activeAssignments.length} valueStyle={{ color: '#1890ff' }} /></Card></Col>
                                <Col span={6}><Card size="small"><Statistic title="Hoàn thành" value={completedAssignments.length} valueStyle={{ color: '#52c41a' }} /></Card></Col>
                                <Col span={6}><Card size="small"><Statistic title="Tổng SL giao" value={totalAssignedQty} /></Card></Col>
                                <Col span={6}>
                                    <Card size="small">
                                        <Statistic
                                            title="SL hoàn thành"
                                            value={totalCompletedQty}
                                            suffix={`/ ${totalAssignedQty}`}
                                            valueStyle={{ color: '#52c41a' }}
                                        />
                                        {totalAssignedQty > 0 && (
                                            <Progress percent={Math.round(totalCompletedQty / totalAssignedQty * 100)} size="small" />
                                        )}
                                    </Card>
                                </Col>
                            </Row>

                            {assignments.length > 0 ? (
                                <Table
                                    dataSource={assignments.slice(0, 20)}
                                    rowKey="id"
                                    size="small"
                                    pagination={false}
                                    columns={[
                                        { title: 'Mã', dataIndex: 'code', width: 130, render: (t: any) => <b>{t}</b> },
                                        { title: 'NCC', render: (r: any) => r.supplier?.name || '-' },
                                        { title: 'SL giao', dataIndex: 'assigned_quantity', width: 80, align: 'right' as const },
                                        { title: 'SL xong', dataIndex: 'completed_quantity', width: 80, align: 'right' as const, render: (v: number) => <span style={{ color: '#52c41a' }}>{v}</span> },
                                        { title: 'SL lỗi', dataIndex: 'defect_quantity', width: 70, align: 'right' as const, render: (v: number) => <span style={{ color: v > 0 ? '#ff4d4f' : '#999' }}>{v}</span> },
                                        {
                                            title: 'Tiến độ', width: 120, render: (r: any) => {
                                                const pct = Number(r.assigned_quantity) > 0 ? Math.round(Number(r.completed_quantity) / Number(r.assigned_quantity) * 100) : 0;
                                                return <Progress percent={pct} size="small" />;
                                            }
                                        },
                                        {
                                            title: 'Status', dataIndex: 'status', width: 110, align: 'center' as const,
                                            render: (s: string) => <Tag color={s === 'COMPLETED' ? 'green' : s === 'IN_PROGRESS' ? 'blue' : s === 'CANCELLED' ? 'red' : 'default'}>{s}</Tag>
                                        }
                                    ]}
                                />
                            ) : <Empty description="Chưa có phân bổ gia công" />}
                        </div>
                    )
                }
            ]} />
        </div>
    );
};

export default ProductionDashboardPage;
