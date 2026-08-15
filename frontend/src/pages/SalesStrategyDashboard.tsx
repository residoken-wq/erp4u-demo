import React, { useEffect, useState, useCallback } from 'react';
import { Row, Col, Card, Statistic, Table, Button, Select, DatePicker, Tag, Progress, Spin, Empty, Space, message, Popconfirm, Input, Tooltip } from 'antd';
import {
    DollarOutlined, FunnelPlotOutlined, TrophyOutlined, TeamOutlined,
    ReloadOutlined, BellOutlined, WarningOutlined, RiseOutlined,
    ThunderboltOutlined, ClockCircleOutlined, SearchOutlined,
    FallOutlined, CrownOutlined, StarOutlined, FireOutlined
} from '@ant-design/icons';
import { Funnel, Area, Pie } from '@ant-design/plots';
import api from '../utils/api';
import dayjs from 'dayjs';
import useMobile from '../hooks/useMobile';

const { RangePicker } = DatePicker;

// ===================== SALES STRATEGY DASHBOARD =====================

const SalesStrategyDashboard: React.FC = () => {
    const isMobile = useMobile();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
        dayjs().startOf('year'), dayjs()
    ]);
    const [salesRepFilter, setSalesRepFilter] = useState<number | undefined>(undefined);
    const [productTypeFilter, setProductTypeFilter] = useState<string | undefined>(undefined);
    const [users, setUsers] = useState<any[]>([]);
    const [pushingId, setPushingId] = useState<number | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [analyticsRes, usersRes] = await Promise.all([
                api.get('/sales/analytics', {
                    params: {
                        startDate: dateRange[0].format('YYYY-MM-DD'),
                        endDate: dateRange[1].format('YYYY-MM-DD'),
                        assignedToId: salesRepFilter,
                        productType: productTypeFilter,
                    }
                }),
                api.get('/users'),
            ]);
            setData(analyticsRes.data);
            setUsers(usersRes.data || []);
        } catch (e) {
            console.error('Error fetching analytics:', e);
        }
        setLoading(false);
    }, [dateRange, salesRepFilter, productTypeFilter]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const fmtVND = (v: number) => {
        if (v >= 1000000000) return `${(v / 1000000000).toFixed(1)} tỷ`;
        if (v >= 1000000) return `${(v / 1000000).toFixed(1)}tr`;
        if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
        return v.toLocaleString('vi-VN');
    };

    const statusLabel: Record<string, string> = {
        NEW: 'Mới',
        CONTACTED: 'Đã liên hệ',
        QUALIFIED: 'Tiềm năng',
        SAMPLE_APPROVED: 'Đã duyệt mẫu',
        NEGOTIATION: 'Đàm phán',
        WON: 'Thành công',
        LOST: 'Thất bại',
    };

    // === KPI CARDS ===
    const KpiCards = () => {
        const kpi = data?.kpi || {};
        return (
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={12} sm={6}>
                    <Card bordered={false} style={{ borderRadius: 12, borderLeft: '4px solid #10b981' }}>
                        <Statistic title="Tổng Lead" value={kpi.totalLeads || 0} prefix={<TeamOutlined />} valueStyle={{ color: '#10b981', fontWeight: 700, fontSize: isMobile ? 20 : 28 }} />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card bordered={false} style={{ borderRadius: 12, borderLeft: '4px solid #f59e0b' }}>
                        <Statistic title="Tỷ lệ chuyển đổi" value={kpi.conversionRate || 0} suffix="%" prefix={<TrophyOutlined />} valueStyle={{ color: '#f59e0b', fontWeight: 700, fontSize: isMobile ? 20 : 28 }} />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card bordered={false} style={{ borderRadius: 12, borderLeft: '4px solid #3b82f6' }}>
                        <Statistic title="Giá trị Phễu" value={kpi.pipelineValue || 0} prefix={<FunnelPlotOutlined />} formatter={(v) => fmtVND(Number(v))} valueStyle={{ color: '#3b82f6', fontWeight: 700, fontSize: isMobile ? 20 : 28 }} />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card bordered={false} style={{ borderRadius: 12, borderLeft: '4px solid #059669' }}>
                        <Statistic title="Doanh thu thực" value={kpi.actualRevenue || 0} prefix={<DollarOutlined />} formatter={(v) => fmtVND(Number(v))} valueStyle={{ color: '#059669', fontWeight: 700, fontSize: isMobile ? 20 : 28 }} />
                    </Card>
                </Col>
            </Row>
        );
    };

    // === REPORT 1: LEAD SOURCE FUNNEL ===
    const LeadSourceFunnel = () => {
        const funnelData = data?.funnelData || [];

        const funnelChartData = funnelData.map((d: any) => ({
            stage: d.sourceLabel,
            count: d.leads,
        }));

        const columns = [
            { title: 'Nguồn', dataIndex: 'sourceLabel', key: 'source', render: (v: string) => <b>{v}</b> },
            { title: 'Leads', dataIndex: 'leads', key: 'leads', align: 'center' as const },
            { title: 'Qualified', dataIndex: 'qualified', key: 'qualified', align: 'center' as const, render: (v: number) => <Tag color="green">{v}</Tag> },
            { title: 'Won', dataIndex: 'won', key: 'won', align: 'center' as const, render: (v: number) => <Tag color="gold">{v}</Tag> },
            { title: 'Win%', dataIndex: 'winRate', key: 'winRate', align: 'center' as const, render: (v: number) => <span style={{ fontWeight: 600, color: v >= 30 ? '#10b981' : v >= 10 ? '#f59e0b' : '#ef4444' }}>{v}%</span> },
            { title: isMobile ? 'GT TB' : 'GT Đơn TB', dataIndex: 'avgOrderValue', key: 'avgOrderValue', align: 'right' as const, render: (v: number) => v > 0 ? fmtVND(v) : '-' },
        ];

        return (
            <Card
                title={<span><FunnelPlotOutlined style={{ color: '#3b82f6' }} /> Báo cáo 1: Nguồn Lead & Chuyển đổi</span>}
                bordered={false}
                style={{ borderRadius: 16, marginBottom: 24 }}
            >
                <Row gutter={24}>
                    <Col xs={24} md={10}>
                        {funnelChartData.length > 0 ? (
                            <Funnel
                                data={funnelChartData}
                                xField="stage"
                                yField="count"
                                height={250}
                                legend={false}
                                color={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']}
                                conversionTag={false}
                                label={{ style: { fill: '#fff', fontWeight: 600 } }}
                            />
                        ) : <Empty description="Chưa có dữ liệu" />}
                    </Col>
                    <Col xs={24} md={14}>
                        <Table
                            dataSource={funnelData}
                            columns={columns}
                            rowKey="source"
                            pagination={false}
                            size="small"
                            scroll={{ x: isMobile ? 500 : undefined }}
                        />
                    </Col>
                </Row>
            </Card>
        );
    };

    // === REPORT 2: SAMPLE & QUOTE VELOCITY ===
    const VelocityAlerts = () => {
        const velocity = data?.velocityData || [];

        const handlePush = async (record: any) => {
            setPushingId(record.customerId);
            try {
                await api.post('/sales/analytics/push-reminder', {
                    userId: record.assignedToId,
                    customerName: record.customerName,
                    message: `⚡ Khách hàng ${record.customerName} (${statusLabel[record.status] || record.status}) đã ${record.daysSinceLastAction} ngày chưa có follow-up. Vui lòng xử lý ngay!`,
                });
                message.success(`Đã gửi nhắc nhở cho ${record.assignedTo}`);
            } catch (e) {
                message.error('Lỗi gửi nhắc nhở');
            }
            setPushingId(null);
        };

        const getRowBg = (r: any) => {
            if (r.alertLevel === 'red') return '#fef2f2';
            if (r.alertLevel === 'orange') return '#fffbeb';
            return 'transparent';
        };

        const columns = [
            {
                title: '', key: 'alert', width: 30,
                render: (_: any, r: any) => r.alertLevel === 'red'
                    ? <WarningOutlined style={{ color: '#ef4444', fontSize: 16 }} />
                    : r.alertLevel === 'orange'
                        ? <ClockCircleOutlined style={{ color: '#f59e0b', fontSize: 16 }} />
                        : null,
            },
            {
                title: 'Khách hàng', dataIndex: 'customerName', key: 'name',
                render: (v: string, r: any) => <div><b>{v}</b><div style={{ fontSize: 11, color: '#888' }}>{r.phone}</div></div>,
            },
            {
                title: 'Trạng thái', dataIndex: 'status', key: 'status',
                render: (v: string) => <Tag color={v === 'QUALIFIED' ? 'blue' : v === 'SAMPLE_APPROVED' ? 'purple' : 'default'}>{statusLabel[v] || v}</Tag>,
            },
            {
                title: isMobile ? 'Ngày' : 'Số ngày chờ', dataIndex: 'daysSinceLastAction', key: 'days',
                align: 'center' as const,
                render: (v: number, r: any) => <span style={{ fontWeight: 700, color: r.alertLevel === 'red' ? '#ef4444' : r.alertLevel === 'orange' ? '#f59e0b' : '#333' }}>{v} ngày</span>,
                sorter: (a: any, b: any) => b.daysSinceLastAction - a.daysSinceLastAction,
                defaultSortOrder: 'ascend' as const,
            },
            {
                title: isMobile ? 'GT' : 'Giá trị', dataIndex: 'potentialValue', key: 'value',
                align: 'right' as const,
                render: (v: number) => v > 0 ? fmtVND(v) : '-',
            },
            {
                title: 'Phụ trách', dataIndex: 'assignedTo', key: 'assigned',
                width: 100,
            },
            {
                title: '', key: 'push', width: 80,
                render: (_: any, r: any) => (
                    <Button
                        type="primary"
                        danger={r.alertLevel === 'red'}
                        size="small"
                        icon={<BellOutlined />}
                        loading={pushingId === r.customerId}
                        onClick={() => handlePush(r)}
                    >
                        Push
                    </Button>
                ),
            },
        ];

        return (
            <Card
                title={<span><ThunderboltOutlined style={{ color: '#f59e0b' }} /> Báo cáo 2: Tốc độ xử lý Mẫu & Báo giá</span>}
                bordered={false}
                style={{ borderRadius: 16, marginBottom: 24 }}
                extra={
                    <Space>
                        <Tag color="red">🔴 QUALIFIED &gt; 3 ngày</Tag>
                        <Tag color="orange">🟠 SAMPLE &gt; 5 ngày</Tag>
                    </Space>
                }
            >
                <Table
                    dataSource={velocity}
                    columns={columns}
                    rowKey="customerId"
                    pagination={false}
                    size="small"
                    scroll={{ x: isMobile ? 600 : undefined }}
                    onRow={(record) => ({
                        style: { background: getRowBg(record) },
                    })}
                />
            </Card>
        );
    };

    // === REPORT 3: INDIVIDUAL KPI SCORECARD ===
    const KpiScorecard = () => {
        const scorecard = data?.scorecardData || [];

        return (
            <Card
                title={<span><TeamOutlined style={{ color: '#8b5cf6' }} /> Báo cáo 3: KPI Scorecard</span>}
                bordered={false}
                style={{ borderRadius: 16, marginBottom: 24 }}
            >
                <Row gutter={[16, 16]}>
                    {scorecard.map((rep: any) => {
                        const revPct = rep.targetRevenue > 0 ? Math.min(100, Math.round((rep.actualRevenue / rep.targetRevenue) * 100)) : 0;
                        const leadPct = rep.targetLeads > 0 ? Math.min(100, Math.round((rep.newLeads / rep.targetLeads) * 100)) : 0;
                        const actPct = rep.targetActivities > 0 ? Math.min(100, Math.round((rep.activities / rep.targetActivities) * 100)) : 0;

                        return (
                            <Col xs={24} md={8} key={rep.userId}>
                                <Card
                                    bordered
                                    size="small"
                                    style={{ borderRadius: 12, background: '#fafafa' }}
                                    title={<span style={{ fontWeight: 700 }}>{rep.userName}</span>}
                                >
                                    <div style={{ marginBottom: 12 }}>
                                        <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>💰 Doanh số</div>
                                        <Progress percent={revPct} strokeColor={revPct >= 80 ? '#10b981' : '#f59e0b'} size="small" />
                                        <div style={{ fontSize: 11, color: '#888' }}>{fmtVND(rep.actualRevenue)} / {rep.targetRevenue > 0 ? fmtVND(rep.targetRevenue) : 'Chưa set'}</div>
                                    </div>
                                    <div style={{ marginBottom: 12 }}>
                                        <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>🎯 Lead mới</div>
                                        <Progress percent={leadPct} strokeColor="#3b82f6" size="small" />
                                        <div style={{ fontSize: 11, color: '#888' }}>{rep.newLeads} / {rep.targetLeads > 0 ? rep.targetLeads : 'N/A'}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>📞 Hoạt động</div>
                                        <Progress percent={actPct} strokeColor="#8b5cf6" size="small" />
                                        <div style={{ fontSize: 11, color: '#888' }}>{rep.activities} / {rep.targetActivities > 0 ? rep.targetActivities : 'N/A'}</div>
                                    </div>
                                    <div style={{ marginTop: 12, textAlign: 'center' }}>
                                        <Tag icon={<ClockCircleOutlined />} color="default">TB {rep.avgDaysToClose} ngày chốt</Tag>
                                    </div>
                                </Card>
                            </Col>
                        );
                    })}
                    {scorecard.length === 0 && <Col span={24}><Empty description="Chưa có dữ liệu nhân sự" /></Col>}
                </Row>
            </Card>
        );
    };

    // === REPORT 4: WEIGHTED REVENUE FORECAST ===
    const RevenueForecast = () => {
        const forecast = data?.forecastData || [];
        const chartData = forecast.flatMap((d: any) => [
            { month: d.label, type: 'Thực tế', value: d.actualRevenue },
            { month: d.label, type: 'Dự báo (Weighted)', value: d.forecastRevenue },
        ]);

        return (
            <Card
                title={<span><RiseOutlined style={{ color: '#10b981' }} /> Báo cáo 4: Dự báo Doanh thu Quý</span>}
                bordered={false}
                style={{ borderRadius: 16, marginBottom: 24 }}
                extra={<span style={{ fontSize: 11, color: '#888' }}>Trọng số: NEW 5% | QUALIFIED 20% | SAMPLE 50% | NEGOTIATION 80%</span>}
            >
                {chartData.length > 0 ? (
                    <Area
                        data={chartData}
                        xField="month"
                        yField="value"
                        colorField="type"
                        scale={{ color: { range: ['#10b981', '#3b82f6'] } }}
                        height={isMobile ? 250 : 320}
                        style={{ fillOpacity: 0.25 }}
                        axis={{
                            y: { labelFormatter: (v: number) => fmtVND(v) },
                        }}
                        legend={{ color: { position: 'top' } }}
                    />
                ) : <Empty description="Chưa có dữ liệu" />}
            </Card>
        );
    };

    // === REPORT 5: LOST DEAL ANALYSIS ===
    const LostDealAnalysis = () => {
        const lostReasons = data?.lostReasons || [];

        const pieData = lostReasons.map((d: any) => ({
            type: d.sourceLabel,
            value: d.lostCount,
        }));

        const columns = [
            { title: 'Nguồn Lead', dataIndex: 'sourceLabel', key: 'source', render: (v: string) => <b>{v}</b> },
            { title: 'Số deal mất', dataIndex: 'lostCount', key: 'lostCount', align: 'center' as const, render: (v: number) => <Tag color="red">{v}</Tag> },
            { title: 'Tổng giá trị mất', dataIndex: 'lostValue', key: 'lostValue', align: 'right' as const, render: (v: number) => <span style={{ color: '#ef4444', fontWeight: 600 }}>{fmtVND(v)}</span> },
            { title: 'Tổng Lead', dataIndex: 'totalLeads', key: 'totalLeads', align: 'center' as const },
            { title: 'Tỷ lệ mất', dataIndex: 'lostRate', key: 'lostRate', align: 'center' as const, render: (v: number) => <span style={{ fontWeight: 600, color: v >= 50 ? '#ef4444' : v >= 30 ? '#f59e0b' : '#10b981' }}>{v}%</span> },
        ];

        return (
            <Card
                title={<span><FallOutlined style={{ color: '#ef4444' }} /> Báo cáo 5: Phân tích Deal Thất bại</span>}
                bordered={false}
                style={{ borderRadius: 16, marginBottom: 24 }}
            >
                {lostReasons.length > 0 ? (
                    <Row gutter={24}>
                        <Col xs={24} md={10}>
                            <Pie
                                data={pieData}
                                angleField="value"
                                colorField="type"
                                radius={0.85}
                                innerRadius={0.55}
                                height={250}
                                label={{ text: 'type', position: 'outside', style: { fontSize: 11 } }}
                                legend={false}
                                color={['#ef4444', '#f97316', '#eab308', '#6366f1', '#ec4899', '#8b5cf6']}
                            />
                            <div style={{ textAlign: 'center', marginTop: 8 }}>
                                <Statistic
                                    title="Tổng giá trị mất"
                                    value={lostReasons.reduce((s: number, r: any) => s + r.lostValue, 0)}
                                    formatter={(v) => <span style={{ color: '#ef4444' }}>{fmtVND(Number(v))}</span>}
                                />
                            </div>
                        </Col>
                        <Col xs={24} md={14}>
                            <Table dataSource={lostReasons} columns={columns} rowKey="source" pagination={false} size="small" scroll={{ x: isMobile ? 500 : undefined }} />
                        </Col>
                    </Row>
                ) : <Empty description="Không có deal thất bại trong kỳ" />}
            </Card>
        );
    };

    // === REPORT 6: TOP PRODUCTS ===
    const TopProducts = () => {
        const topProducts = data?.topProducts || [];

        const columns = [
            { title: '#', key: 'rank', width: 40, render: (_: any, __: any, idx: number) => <span style={{ fontWeight: 700, color: idx < 3 ? '#f59e0b' : '#888' }}>{idx + 1}</span> },
            { title: 'Mã SP (SKU)', dataIndex: 'sku', key: 'sku', render: (v: string) => <b>{v}</b> },
            { title: 'SL bán', dataIndex: 'totalQuantity', key: 'totalQuantity', align: 'center' as const, render: (v: number) => v.toLocaleString('vi-VN') },
            { title: 'Doanh thu', dataIndex: 'totalRevenue', key: 'totalRevenue', align: 'right' as const, render: (v: number) => <span style={{ fontWeight: 600, color: '#059669' }}>{fmtVND(v)}</span> },
            { title: isMobile ? 'Đơn' : 'Số đơn hàng', dataIndex: 'orderCount', key: 'orderCount', align: 'center' as const },
        ];

        return (
            <Card
                title={<span><CrownOutlined style={{ color: '#f59e0b' }} /> Báo cáo 6: Top Sản Phẩm Bán Chạy</span>}
                bordered={false}
                style={{ borderRadius: 16, marginBottom: 24 }}
            >
                {topProducts.length > 0 ? (
                    <Table dataSource={topProducts} columns={columns} rowKey="sku" pagination={false} size="small" scroll={{ x: isMobile ? 450 : undefined }} />
                ) : <Empty description="Chưa có dữ liệu sản phẩm" />}
            </Card>
        );
    };

    // === REPORT 7: HIGH-VALUE LEADS TO WIN ===
    const HighValueLeads = () => {
        const leads = data?.highValueLeads || [];

        const priorityConfig: Record<string, { color: string; label: string }> = {
            HOT: { color: '#ef4444', label: '🔥 HOT' },
            WARM: { color: '#f59e0b', label: '⚡ WARM' },
            NORMAL: { color: '#64748b', label: '💎 NORMAL' },
        };

        const columns = [
            {
                title: '', key: 'priority', width: 70,
                render: (_: any, r: any) => {
                    const p = priorityConfig[r.priority] || priorityConfig.NORMAL;
                    return <Tag color={r.priority === 'HOT' ? 'red' : r.priority === 'WARM' ? 'orange' : 'default'} style={{ fontWeight: 700 }}>{p.label}</Tag>;
                },
            },
            {
                title: 'Khách hàng', dataIndex: 'name', key: 'name',
                render: (v: string, r: any) => <div><b>{v}</b><div style={{ fontSize: 11, color: '#888' }}>{r.phone} • {r.sourceLabel}</div></div>,
            },
            {
                title: 'Trạng thái', dataIndex: 'status', key: 'status',
                render: (v: string) => <Tag color={v === 'NEGOTIATION' ? 'orange' : v === 'QUALIFIED' ? 'blue' : v === 'SAMPLE_APPROVED' ? 'purple' : 'default'}>{statusLabel[v] || v}</Tag>,
            },
            {
                title: 'Giá trị tiềm năng', dataIndex: 'potentialValue', key: 'potentialValue',
                align: 'right' as const,
                render: (v: number) => <span style={{ fontWeight: 700, color: '#059669', fontSize: 14 }}>{fmtVND(v)}</span>,
                sorter: (a: any, b: any) => a.potentialValue - b.potentialValue,
                defaultSortOrder: 'descend' as const,
            },
            {
                title: isMobile ? 'GT W.' : 'Giá trị Weighted', dataIndex: 'weightedValue', key: 'weightedValue',
                align: 'right' as const,
                render: (v: number) => <span style={{ color: '#3b82f6' }}>{fmtVND(v)}</span>,
            },
            {
                title: 'Phụ trách', dataIndex: 'assignedTo', key: 'assignedTo',
                width: 100,
            },
            {
                title: isMobile ? 'Ngày' : 'Ngày chưa action', dataIndex: 'daysSinceLastAction', key: 'days',
                align: 'center' as const,
                render: (v: number) => <span style={{ fontWeight: 600, color: v > 7 ? '#ef4444' : v > 3 ? '#f59e0b' : '#10b981' }}>{v} ngày</span>,
            },
        ];

        const totalPotential = leads.reduce((s: number, l: any) => s + l.potentialValue, 0);
        const totalWeighted = leads.reduce((s: number, l: any) => s + l.weightedValue, 0);
        const hotCount = leads.filter((l: any) => l.priority === 'HOT').length;

        return (
            <Card
                title={<span><StarOutlined style={{ color: '#f59e0b' }} /> Báo cáo 7: Leads Giá trị cao cần Win</span>}
                bordered={false}
                style={{ borderRadius: 16, marginBottom: 24, border: '2px solid #fef3c7' }}
                extra={
                    <Space>
                        {hotCount > 0 && <Tag color="red" style={{ fontWeight: 600 }}>🔥 {hotCount} HOT</Tag>}
                        <span style={{ fontSize: 12, color: '#888' }}>Top {leads.length} leads</span>
                    </Space>
                }
            >
                {/* SUMMARY ROW */}
                <Row gutter={16} style={{ marginBottom: 16 }}>
                    <Col xs={8}>
                        <Card bordered={false} style={{ background: '#f0fdf4', borderRadius: 12, textAlign: 'center' }}>
                            <Statistic title="Tổng giá trị tiềm năng" value={totalPotential} formatter={(v) => <span style={{ color: '#059669', fontSize: 16 }}>{fmtVND(Number(v))}</span>} />
                        </Card>
                    </Col>
                    <Col xs={8}>
                        <Card bordered={false} style={{ background: '#eff6ff', borderRadius: 12, textAlign: 'center' }}>
                            <Statistic title="Giá trị Weighted" value={totalWeighted} formatter={(v) => <span style={{ color: '#3b82f6', fontSize: 16 }}>{fmtVND(Number(v))}</span>} />
                        </Card>
                    </Col>
                    <Col xs={8}>
                        <Card bordered={false} style={{ background: '#fef2f2', borderRadius: 12, textAlign: 'center' }}>
                            <Statistic title="Leads cần focus" value={leads.length} valueStyle={{ color: '#ef4444', fontWeight: 700, fontSize: 24 }} />
                        </Card>
                    </Col>
                </Row>

                {leads.length > 0 ? (
                    <Table
                        dataSource={leads}
                        columns={columns}
                        rowKey="id"
                        pagination={false}
                        size="small"
                        scroll={{ x: isMobile ? 700 : undefined }}
                        onRow={(r: any) => ({
                            style: {
                                background: r.priority === 'HOT' ? '#fef2f2' : r.priority === 'WARM' ? '#fffbeb' : 'transparent',
                            }
                        })}
                    />
                ) : <Empty description="Không có leads giá trị cao" />}
            </Card>
        );
    };

    return (
        <div style={{ padding: isMobile ? 8 : 0, fontFamily: "'Inter', -apple-system, sans-serif" }}>
            {/* HEADER */}
            <div style={{
                display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between',
                alignItems: 'center', marginBottom: 20, gap: 12
            }}>
                <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 24, fontWeight: 700 }}>
                    📊 Sales Strategy Dashboard
                </h2>
                <Space wrap size={isMobile ? 'small' : 'middle'}>
                    <RangePicker
                        value={dateRange}
                        onChange={(v) => v && setDateRange(v as [dayjs.Dayjs, dayjs.Dayjs])}
                        format="DD/MM/YYYY"
                        size={isMobile ? 'small' : 'middle'}
                    />
                    <Select
                        placeholder="Nhân viên"
                        allowClear
                        style={{ width: isMobile ? 100 : 150 }}
                        size={isMobile ? 'small' : 'middle'}
                        value={salesRepFilter}
                        onChange={setSalesRepFilter}
                        options={users.map((u: any) => ({ label: u.full_name || u.username, value: u.id }))}
                    />
                    <Select
                        placeholder="Nhóm SP"
                        allowClear
                        style={{ width: isMobile ? 100 : 140 }}
                        size={isMobile ? 'small' : 'middle'}
                        value={productTypeFilter}
                        onChange={setProductTypeFilter}
                        options={[
                            { label: 'Nệm', value: 'NEM' },
                            { label: 'Balo', value: 'BALO' },
                            { label: 'Đồng phục', value: 'DONG_PHUC' },
                        ]}
                    />
                    <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading} size={isMobile ? 'small' : 'middle'} />
                </Space>
            </div>

            <Spin spinning={loading}>
                {KpiCards()}
                {HighValueLeads()}
                {LeadSourceFunnel()}
                {VelocityAlerts()}
                {KpiScorecard()}
                {RevenueForecast()}
                {LostDealAnalysis()}
                {TopProducts()}
            </Spin>
        </div>
    );
};

export default SalesStrategyDashboard;
