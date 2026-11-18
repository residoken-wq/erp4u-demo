import React, { useEffect, useState, useCallback } from 'react';
import { Row, Col, Card, Statistic, Table, Button, Select, DatePicker, Tag, Progress, Spin, Empty, Space, Tooltip } from 'antd';
import {
    DollarOutlined, FunnelPlotOutlined, TrophyOutlined, TeamOutlined,
    ArrowUpOutlined, ArrowDownOutlined, MinusOutlined, ReloadOutlined,
    RiseOutlined, FallOutlined, FireOutlined, ClockCircleOutlined,
    CrownOutlined, StarOutlined, BankOutlined, BarChartOutlined, AppstoreOutlined, TagsOutlined, GlobalOutlined
} from '@ant-design/icons';
import { Column, Funnel, Area } from '@ant-design/plots';
import api from '../utils/api';
import dayjs from 'dayjs';
import useMobile from '../hooks/useMobile';

const { RangePicker } = DatePicker;

// ===================== BOD DASHBOARD: THE SCHOOL SALES ENGINE =====================

const BodDashboard: React.FC = () => {
    const isMobile = useMobile();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
        dayjs().startOf('year'), dayjs()
    ]);
    const [salesRepFilter, setSalesRepFilter] = useState<number | undefined>(undefined);
    const [users, setUsers] = useState<any[]>([]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [analyticsRes, usersRes] = await Promise.all([
                api.get('/sales/analytics', {
                    params: {
                        startDate: dateRange[0].format('YYYY-MM-DD'),
                        endDate: dateRange[1].format('YYYY-MM-DD'),
                        assignedToId: salesRepFilter,
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
    }, [dateRange, salesRepFilter]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const fmtVND = (v: number) => {
        if (v >= 1000000000) return `${(v / 1000000000).toFixed(1)} tỷ`;
        if (v >= 1000000) return `${(v / 1000000).toFixed(1)}tr`;
        if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
        return v.toLocaleString('vi-VN');
    };

    const fmtFullVND = (v: number) => `${v.toLocaleString('vi-VN')}₫`;

    const statusLabel: Record<string, string> = {
        NEW: 'Mới',
        CONTACTED: 'Đã liên hệ',
        QUALIFIED: 'Tiềm năng',
        SAMPLE_APPROVED: 'Đã duyệt mẫu',
        NEGOTIATION: 'Đàm phán',
        WON: 'Thành công',
        LOST: 'Thất bại',
    };

    // === TREND BADGE ===
    const TrendBadge = ({ value, suffix = '%' }: { value: number; suffix?: string }) => {
        if (value === 0) return <Tag icon={<MinusOutlined />} color="default">0{suffix}</Tag>;
        return value > 0
            ? <Tag icon={<ArrowUpOutlined />} color="success">+{value}{suffix}</Tag>
            : <Tag icon={<ArrowDownOutlined />} color="error">{value}{suffix}</Tag>;
    };

    // === KPI CARDS ===
    const KpiCards = () => {
        const kpi = data?.kpi || {};
        const cards = [
            {
                title: '💰 Doanh thu thực thu',
                value: kpi.paidRevenue || 0,
                trend: kpi.trends?.paidTrend || 0,
                gradient: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                icon: <DollarOutlined />,
            },
            {
                title: '📈 Doanh số thực tế',
                value: kpi.actualRevenue || 0,
                trend: kpi.trends?.actualTrend || 0,
                gradient: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)',
                icon: <RiseOutlined />,
            },
            {
                title: '🔵 Doanh số dự kiến',
                value: kpi.expectedRevenue || 0,
                trend: kpi.trends?.expectedTrend || 0,
                gradient: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)',
                icon: <FunnelPlotOutlined />,
            },
            {
                title: '🏆 Tỷ lệ Chốt',
                value: kpi.conversionRate || 0,
                trend: 0,
                gradient: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
                icon: <TrophyOutlined />,
                isSuffix: '%',
            },
            {
                title: '📊 Tổng Lead',
                value: kpi.totalLeads || 0,
                trend: kpi.trends?.leadsTrend || 0,
                gradient: 'linear-gradient(135deg, #475569 0%, #64748b 100%)',
                icon: <TeamOutlined />,
                isCount: true,
            },
            {
                title: '🎯 Giá trị Phễu',
                value: kpi.pipelineValue || 0,
                trend: kpi.trends?.pipelineTrend || 0,
                gradient: 'linear-gradient(135deg, #be185d 0%, #db2777 100%)',
                icon: <FireOutlined />,
            },
        ];

        return (
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                {cards.map((c, i) => (
                    <Col xs={12} sm={12} md={8} lg={4} key={i}>
                        <Card bordered={false} style={{ background: c.gradient, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <Statistic
                                    title={<span style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600, fontSize: isMobile ? 11 : 13 }}>{c.title}</span>}
                                    value={c.value}
                                    precision={0}
                                    formatter={(v) => c.isSuffix ? `${v}%` : (c.isCount ? String(v) : fmtVND(Number(v)))}
                                    valueStyle={{ color: '#fff', fontWeight: 'bold', fontSize: isMobile ? 18 : 22 }}
                                />
                            </div>
                            <div style={{ marginTop: 8 }}>
                                <TrendBadge value={c.trend} />
                                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginLeft: 4 }}>vs kỳ trước</span>
                            </div>
                        </Card>
                    </Col>
                ))}
            </Row>
        );
    };

    // === LEAD SOURCE ROI (Stacked Bar) ===
    const LeadSourceROI = () => {
        const funnelData = data?.funnelData || [];
        const chartData = funnelData.flatMap((d: any) => [
            { source: d.sourceLabel, type: 'Qualified', count: d.qualified },
            { source: d.sourceLabel, type: 'Chưa Qualified', count: d.unqualified },
        ]);

        return (
            <Card
                title={<span><FireOutlined style={{ color: '#f59e0b' }} /> Lead Source ROI</span>}
                bordered={false}
                style={{ borderRadius: 16, height: '100%' }}
            >
                {chartData.length > 0 ? (
                    <Column
                        data={chartData}
                        xField="source"
                        yField="count"
                        colorField="type"
                        stack
                        color={['#10b981', '#e5e7eb']}
                        height={isMobile ? 250 : 300}
                        label={{ position: 'middle', style: { fill: '#fff', fontWeight: 600 } }}
                        tooltip={{
                            formatter: (datum: any) => {
                                const src = funnelData.find((f: any) => f.sourceLabel === datum.source);
                                return {
                                    name: datum.type,
                                    value: `${datum.count} (GT TB: ${fmtFullVND(src?.avgOrderValue || 0)})`,
                                };
                            },
                        }}
                        legend={{ position: 'top' }}
                    />
                ) : <Empty description="Chưa có dữ liệu nguồn Lead" />}
                <div style={{ marginTop: 12, fontSize: 12, color: '#666', fontStyle: 'italic' }}>
                    💡 Hover vào cột để xem Giá trị đơn hàng trung bình của nguồn
                </div>
            </Card>
        );
    };

    // === CONVERSION FUNNEL ===
    const ConversionFunnel = () => {
        const kpi = data?.kpi || {};
        const funnel = kpi.funnelStages || {};

        const stages = [
            { stage: 'Lead Mới', count: funnel.new || 0 },
            { stage: 'Tiềm Năng', count: funnel.qualified || 0 },
            { stage: 'Đã Liên Hệ', count: funnel.contacted || 0 },
            { stage: 'Duyệt Mẫu SX', count: funnel.sample_approved || 0 },
            { stage: 'Đàm Phán / BG', count: funnel.negotiation || 0 },
            { stage: 'Thành Công (WON)', count: funnel.won || 0 },
        ];

        return (
            <Card
                title={<span><FunnelPlotOutlined style={{ color: '#3b82f6' }} /> Phễu Chuyển Đổi</span>}
                bordered={false}
                style={{ borderRadius: 16, height: '100%' }}
            >
                {stages[0].count > 0 ? (
                    <Funnel
                        data={stages}
                        xField="stage"
                        yField="count"
                        height={isMobile ? 250 : 300}
                        legend={false}
                        label={{
                            formatter: (datum: any) => `${datum.stage}\n${datum.count}`,
                            style: { fill: '#fff', fontWeight: 600, fontSize: 12 },
                        }}
                        color={['#3b82f6', '#60a5fa', '#f59e0b', '#f97316', '#10b981']}
                        conversionTag={false}
                    />
                ) : <Empty description="Chưa có dữ liệu phễu" />}
            </Card>
        );
    };

    // === SALES SCORECARD (Table) ===
    const SalesScorecard = () => {
        const scorecard = data?.scorecardData || [];

        const columns = [
            {
                title: 'Nhân sự',
                dataIndex: 'userName',
                key: 'userName',
                render: (v: string) => <b>{v}</b>,
                width: isMobile ? 80 : 120,
            },
            {
                title: 'Tiến độ Doanh số',
                key: 'progress',
                render: (_: any, r: any) => {
                    const pct = r.targetRevenue > 0 ? Math.min(100, Math.round((r.actualRevenue / r.targetRevenue) * 100)) : 0;
                    return (
                        <div>
                            <Progress
                                percent={pct}
                                size="small"
                                strokeColor={pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444'}
                                format={() => `${pct}%`}
                            />
                            <div style={{ fontSize: 11, color: '#888' }}>
                                {fmtVND(r.actualRevenue)} / {r.targetRevenue > 0 ? fmtVND(r.targetRevenue) : 'N/A'}
                            </div>
                        </div>
                    );
                },
            },
            {
                title: isMobile ? 'Leads' : 'Lead mới',
                dataIndex: 'newLeads',
                key: 'newLeads',
                align: 'center' as const,
                width: 70,
                render: (v: number) => <Tag color="blue">{v}</Tag>,
            },
            {
                title: isMobile ? 'Ngày' : 'TB ngày chốt',
                dataIndex: 'avgDaysToClose',
                key: 'avgDaysToClose',
                align: 'center' as const,
                width: 80,
                render: (v: number) => <span>{v > 0 ? `${v} ngày` : '-'}</span>,
            },
            {
                title: isMobile ? 'HĐ' : 'Hoạt động',
                dataIndex: 'activities',
                key: 'activities',
                align: 'center' as const,
                width: 70,
                render: (v: number) => <Tag color="purple">{v}</Tag>,
            },
        ];

        return (
            <Card
                title={<span><TeamOutlined style={{ color: '#8b5cf6' }} /> Bảng điểm Sales</span>}
                bordered={false}
                style={{ borderRadius: 16, height: '100%' }}
            >
                <Table
                    dataSource={scorecard}
                    columns={columns}
                    rowKey="userId"
                    pagination={false}
                    size="small"
                    scroll={{ x: isMobile ? 500 : undefined }}
                />
            </Card>
        );
    };

    // === REVENUE FORECAST (Area Chart) ===
    const RevenueForecast = () => {
        const forecast = data?.forecastData || [];
        const chartData = forecast.flatMap((d: any) => [
            { month: d.label, type: 'Thực tế', value: d.actualRevenue },
            { month: d.label, type: 'Dự báo', value: d.forecastRevenue },
        ]);

        return (
            <Card
                title={<span><RiseOutlined style={{ color: '#10b981' }} /> Dự báo Doanh thu Quý</span>}
                bordered={false}
                style={{ borderRadius: 16, height: '100%' }}
            >
                {chartData.length > 0 ? (
                    <Area
                        data={chartData}
                        xField="month"
                        yField="value"
                        colorField="type"
                        scale={{ color: { range: ['#10b981', '#3b82f6'] } }}
                        height={isMobile ? 250 : 300}
                        style={{ fillOpacity: 0.25 }}
                        axis={{
                            y: { labelFormatter: (v: number) => fmtVND(v) },
                        }}
                        legend={{ color: { position: 'top' } }}
                    />
                ) : <Empty description="Chưa có dữ liệu dự báo" />}
                <div style={{ marginTop: 8, fontSize: 12, color: '#888', fontStyle: 'italic' }}>
                    📈 Dự báo dựa trên trọng số lead pipeline
                </div>
            </Card>
        );
    };

    // === NEW: MONTHLY TREND 12 MONTHS ===
    const MonthlyTrend = () => {
        const monthlyTrend = data?.monthlyTrend || [];
        const chartData = monthlyTrend.flatMap((d: any) => [
            { month: d.label, type: 'Doanh thu thực', value: d.actualRevenue },
            { month: d.label, type: 'Đã thu', value: d.paidRevenue },
        ]);

        return (
            <Card
                title={<span><BarChartOutlined style={{ color: '#3b82f6' }} /> Xu hướng Doanh thu 12 tháng</span>}
                bordered={false}
                style={{ borderRadius: 16, marginBottom: 24 }}
            >
                {chartData.length > 0 ? (
                    <Column
                        data={chartData}
                        xField="month"
                        yField="value"
                        colorField="type"
                        group
                        color={['#3b82f6', '#10b981']}
                        height={isMobile ? 250 : 320}
                        axis={{
                            y: { labelFormatter: (v: number) => fmtVND(v) },
                        }}
                        legend={{ position: 'top' }}
                        label={false}
                        tooltip={{
                            formatter: (datum: any) => ({
                                name: datum.type,
                                value: fmtFullVND(datum.value),
                            }),
                        }}
                    />
                ) : <Empty description="Chưa có dữ liệu" />}
                <div style={{ marginTop: 12 }}>
                    <Row gutter={16}>
                        {monthlyTrend.length > 0 && (() => {
                            const current = monthlyTrend[monthlyTrend.length - 1];
                            const prev = monthlyTrend.length > 1 ? monthlyTrend[monthlyTrend.length - 2] : null;
                            const trend = prev && prev.actualRevenue > 0 
                                ? Math.round(((current.actualRevenue - prev.actualRevenue) / prev.actualRevenue) * 100) 
                                : 0;
                            return (
                                <>
                                    <Col xs={8}>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: 12, color: '#888' }}>Tháng này</div>
                                            <div style={{ fontWeight: 700, color: '#3b82f6', fontSize: 16 }}>{fmtVND(current.actualRevenue)}</div>
                                        </div>
                                    </Col>
                                    <Col xs={8}>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: 12, color: '#888' }}>Đã thu</div>
                                            <div style={{ fontWeight: 700, color: '#10b981', fontSize: 16 }}>{fmtVND(current.paidRevenue)}</div>
                                        </div>
                                    </Col>
                                    <Col xs={8}>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: 12, color: '#888' }}>vs tháng trước</div>
                                            <div style={{ fontWeight: 700, fontSize: 16 }}>
                                                <TrendBadge value={trend} />
                                            </div>
                                        </div>
                                    </Col>
                                </>
                            );
                        })()}
                    </Row>
                </div>
            </Card>
        );
    };

    // === NEW: TOP CUSTOMERS ===
    const TopCustomers = () => {
        const topCustomers = data?.topCustomers || [];

        const columns = [
            { title: '#', key: 'rank', width: 40, render: (_: any, __: any, idx: number) => <span style={{ fontWeight: 700, color: idx < 3 ? '#f59e0b' : '#888' }}>{idx + 1}</span> },
            {
                title: 'Khách hàng', dataIndex: 'customerName', key: 'name',
                render: (v: string, r: any) => <div><b>{v}</b>{r.phone && <div style={{ fontSize: 11, color: '#888' }}>{r.phone}</div>}</div>,
            },
            {
                title: 'Doanh thu', dataIndex: 'totalRevenue', key: 'totalRevenue',
                align: 'right' as const,
                render: (v: number) => <span style={{ fontWeight: 700, color: '#059669' }}>{fmtVND(v)}</span>,
                sorter: (a: any, b: any) => a.totalRevenue - b.totalRevenue,
                defaultSortOrder: 'descend' as const,
            },
            {
                title: isMobile ? 'Đơn' : 'Số đơn hàng', dataIndex: 'orderCount', key: 'orderCount',
                align: 'center' as const, width: 80,
                render: (v: number) => <Tag color="blue">{v}</Tag>,
            },
            {
                title: 'Đã thanh toán', dataIndex: 'paidAmount', key: 'paidAmount',
                align: 'right' as const,
                render: (v: number, r: any) => {
                    const pct = r.totalRevenue > 0 ? Math.round((v / r.totalRevenue) * 100) : 0;
                    return (
                        <Tooltip title={fmtFullVND(v)}>
                            <div>
                                <Progress percent={pct} size="small" strokeColor={pct >= 80 ? '#10b981' : '#f59e0b'} format={() => `${pct}%`} style={{ width: 80 }} />
                            </div>
                        </Tooltip>
                    );
                },
            },
        ];

        return (
            <Card
                title={<span><CrownOutlined style={{ color: '#f59e0b' }} /> Top Khách hàng</span>}
                bordered={false}
                style={{ borderRadius: 16, height: '100%' }}
            >
                {topCustomers.length > 0 ? (
                    <Table dataSource={topCustomers} columns={columns} rowKey="customerId" pagination={false} size="small" scroll={{ x: isMobile ? 500 : undefined }} />
                ) : <Empty description="Chưa có dữ liệu" />}
            </Card>
        );
    };

    // === NEW: TOP PRODUCTS ===
    const TopProducts = () => {
        const topProducts = data?.topProducts || [];

        const columns = [
            { title: '#', key: 'rank', width: 40, render: (_: any, __: any, idx: number) => <span style={{ fontWeight: 700, color: idx < 3 ? '#f59e0b' : '#888' }}>{idx + 1}</span> },
            {
                title: 'Sản phẩm', dataIndex: 'productName', key: 'name',
                render: (v: string, r: any) => <div><b>{v || r.sku}</b><div style={{ fontSize: 11, color: '#888' }}>{r.category}</div></div>,
            },
            {
                title: 'SL Bán', dataIndex: 'totalQuantity', key: 'totalQuantity',
                align: 'center' as const, width: 80,
                render: (v: number) => <Tag color="blue">{v}</Tag>,
            },
            {
                title: 'Doanh thu', dataIndex: 'totalRevenue', key: 'totalRevenue',
                align: 'right' as const,
                render: (v: number) => <span style={{ fontWeight: 700, color: '#059669' }}>{fmtVND(v)}</span>,
            },
        ];

        return (
            <Card
                title={<span><AppstoreOutlined style={{ color: '#10b981' }} /> Top Sản phẩm</span>}
                bordered={false}
                style={{ borderRadius: 16 }}
            >
                {topProducts.length > 0 ? (
                    <Table dataSource={topProducts} columns={columns} rowKey="sku" pagination={false} size="small" scroll={{ x: isMobile ? 400 : undefined }} />
                ) : <Empty description="Chưa có dữ liệu" />}
            </Card>
        );
    };

    // === NEW: TOP CATEGORIES ===
    const TopCategories = () => {
        const topCategories = data?.topCategories || [];

        const columns = [
            { title: '#', key: 'rank', width: 40, render: (_: any, __: any, idx: number) => <span style={{ fontWeight: 700, color: idx < 3 ? '#f59e0b' : '#888' }}>{idx + 1}</span> },
            {
                title: 'Danh mục', dataIndex: 'category', key: 'category',
                render: (v: string) => <b>{v}</b>,
            },
            {
                title: 'SL Bán', dataIndex: 'totalQuantity', key: 'totalQuantity',
                align: 'center' as const, width: 80,
                render: (v: number) => <Tag color="purple">{v}</Tag>,
            },
            {
                title: 'Doanh thu', dataIndex: 'totalRevenue', key: 'totalRevenue',
                align: 'right' as const,
                render: (v: number) => <span style={{ fontWeight: 700, color: '#059669' }}>{fmtVND(v)}</span>,
            },
        ];

        return (
            <Card
                title={<span><TagsOutlined style={{ color: '#8b5cf6' }} /> Top Danh mục</span>}
                bordered={false}
                style={{ borderRadius: 16 }}
            >
                {topCategories.length > 0 ? (
                    <Table dataSource={topCategories} columns={columns} rowKey="category" pagination={false} size="small" scroll={{ x: isMobile ? 400 : undefined }} />
                ) : <Empty description="Chưa có dữ liệu" />}
            </Card>
        );
    };

    // === NEW: REGION STATS ===
    const RegionStats = () => {
        const regionData = data?.regionData || [];

        const columns = [
            { title: '#', key: 'rank', width: 40, render: (_: any, __: any, idx: number) => <span style={{ fontWeight: 700, color: idx < 3 ? '#f59e0b' : '#888' }}>{idx + 1}</span> },
            {
                title: 'Tỉnh/Thành phố', dataIndex: 'province', key: 'province',
                render: (v: string, r: any) => <div><b>{v}</b><div style={{ fontSize: 11, color: '#888' }}>{r.district}</div></div>,
            },
            {
                title: 'Khách hàng', dataIndex: 'customerCount', key: 'customerCount',
                align: 'center' as const, width: 80,
                render: (v: number) => <Tag color="blue">{v}</Tag>,
            },
            {
                title: 'Đơn hàng', dataIndex: 'orderCount', key: 'orderCount',
                align: 'center' as const, width: 80,
                render: (v: number) => <Tag color="purple">{v}</Tag>,
            },
            {
                title: 'Doanh thu', dataIndex: 'totalRevenue', key: 'totalRevenue',
                align: 'right' as const,
                render: (v: number) => <span style={{ fontWeight: 700, color: '#059669' }}>{fmtVND(v)}</span>,
            },
        ];

        return (
            <Card
                title={<span><GlobalOutlined style={{ color: '#3b82f6' }} /> Thống kê theo Khu vực</span>}
                bordered={false}
                style={{ borderRadius: 16, height: '100%' }}
            >
                {regionData.length > 0 ? (
                    <Table dataSource={regionData} columns={columns} rowKey={(r) => `${r.province}-${r.district}`} pagination={{ pageSize: 5 }} size="small" scroll={{ x: isMobile ? 400 : undefined }} />
                ) : <Empty description="Chưa có dữ liệu khu vực" />}
            </Card>
        );
    };

    // === NEW: ACCOUNTS RECEIVABLE AGING ===
    const AccountsReceivable = () => {
        const ar = data?.accountsReceivable || { details: [], summary: {} };
        const summary = ar.summary || {};
        const totalAR = Object.values(summary).reduce((s: number, b: any) => s + (b?.total || 0), 0);

        const bucketConfig: Record<string, { color: string; label: string; bgColor: string }> = {
            '0-30': { color: '#10b981', label: '0-30 ngày', bgColor: '#f0fdf4' },
            '31-60': { color: '#f59e0b', label: '31-60 ngày', bgColor: '#fffbeb' },
            '61-90': { color: '#f97316', label: '61-90 ngày', bgColor: '#fff7ed' },
            '>90': { color: '#ef4444', label: '> 90 ngày', bgColor: '#fef2f2' },
        };

        const columns = [
            { title: 'Đơn hàng', dataIndex: 'orderCode', key: 'orderCode', render: (v: string) => <b>{v}</b>, width: 120 },
            { title: 'Khách hàng', dataIndex: 'customerName', key: 'customerName' },
            { title: 'Tổng đơn', dataIndex: 'totalAmount', key: 'totalAmount', align: 'right' as const, render: (v: number) => fmtVND(v) },
            { title: 'Đã trả', dataIndex: 'paidAmount', key: 'paidAmount', align: 'right' as const, render: (v: number) => <span style={{ color: '#10b981' }}>{fmtVND(v)}</span> },
            {
                title: 'Còn nợ', dataIndex: 'remainingAmount', key: 'remainingAmount', align: 'right' as const,
                render: (v: number) => <span style={{ fontWeight: 700, color: '#ef4444' }}>{fmtVND(v)}</span>,
            },
            {
                title: 'Số ngày', dataIndex: 'daysPast', key: 'daysPast', align: 'center' as const, width: 80,
                render: (v: number, r: any) => {
                    const cfg = bucketConfig[r.agingBucket] || bucketConfig['0-30'];
                    return <Tag color={v > 90 ? 'red' : v > 60 ? 'orange' : v > 30 ? 'gold' : 'green'}>{v} ngày</Tag>;
                },
                sorter: (a: any, b: any) => a.daysPast - b.daysPast,
            },
        ];

        return (
            <Card
                title={<span><BankOutlined style={{ color: '#ef4444' }} /> Công nợ Phải thu (Accounts Receivable)</span>}
                bordered={false}
                style={{ borderRadius: 16, marginBottom: 24 }}
                extra={
                    <Statistic
                        value={totalAR}
                        formatter={(v) => <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 16 }}>{fmtVND(Number(v))}</span>}
                        prefix={<span style={{ fontSize: 12, color: '#888' }}>Tổng nợ: </span>}
                    />
                }
            >
                {/* AGING SUMMARY CARDS */}
                <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                    {Object.entries(bucketConfig).map(([key, cfg]) => {
                        const bucket = summary[key] || { count: 0, total: 0 };
                        return (
                            <Col xs={12} sm={6} key={key}>
                                <Card bordered={false} size="small" style={{ background: cfg.bgColor, borderRadius: 12, textAlign: 'center', borderLeft: `4px solid ${cfg.color}` }}>
                                    <div style={{ fontSize: 12, color: '#666', fontWeight: 600 }}>{cfg.label}</div>
                                    <div style={{ fontWeight: 700, color: cfg.color, fontSize: 18 }}>{fmtVND(bucket.total)}</div>
                                    <div style={{ fontSize: 11, color: '#888' }}>{bucket.count} đơn</div>
                                </Card>
                            </Col>
                        );
                    })}
                </Row>

                {ar.details.length > 0 ? (
                    <Table dataSource={ar.details} columns={columns} rowKey="orderCode" pagination={{ pageSize: 10 }} size="small" scroll={{ x: isMobile ? 600 : undefined }} />
                ) : <Empty description="Không có công nợ" />}
            </Card>
        );
    };

    // === NEW: HIGH-VALUE LEADS TO WIN ===
    const HighValueLeads = () => {
        const leads = data?.highValueLeads || [];

        const columns = [
            {
                title: '', key: 'priority', width: 70,
                render: (_: any, r: any) => (
                    <Tag color={r.priority === 'HOT' ? 'red' : r.priority === 'WARM' ? 'orange' : 'default'} style={{ fontWeight: 700 }}>
                        {r.priority === 'HOT' ? '🔥 HOT' : r.priority === 'WARM' ? '⚡ WARM' : '💎'}
                    </Tag>
                ),
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
                title: 'Giá trị', dataIndex: 'potentialValue', key: 'potentialValue',
                align: 'right' as const,
                render: (v: number) => <span style={{ fontWeight: 700, color: '#059669', fontSize: 14 }}>{fmtVND(v)}</span>,
                sorter: (a: any, b: any) => a.potentialValue - b.potentialValue,
                defaultSortOrder: 'descend' as const,
            },
            {
                title: 'Phụ trách', dataIndex: 'assignedTo', key: 'assignedTo',
                width: 100,
            },
            {
                title: isMobile ? 'Ngày' : 'Idle', dataIndex: 'daysSinceLastAction', key: 'days',
                align: 'center' as const, width: 70,
                render: (v: number) => <span style={{ fontWeight: 600, color: v > 7 ? '#ef4444' : v > 3 ? '#f59e0b' : '#10b981' }}>{v}d</span>,
            },
        ];

        const totalPotential = leads.reduce((s: number, l: any) => s + l.potentialValue, 0);

        return (
            <Card
                title={<span><StarOutlined style={{ color: '#f59e0b' }} /> Leads Giá trị cao cần Win</span>}
                bordered={false}
                style={{ borderRadius: 16, border: '2px solid #fef3c7', marginBottom: 24 }}
                extra={
                    <Space>
                        <Statistic value={totalPotential} formatter={(v) => <span style={{ color: '#059669', fontWeight: 700, fontSize: 14 }}>{fmtVND(Number(v))}</span>} />
                    </Space>
                }
            >
                {leads.length > 0 ? (
                    <Table
                        dataSource={leads}
                        columns={columns}
                        rowKey="id"
                        pagination={false}
                        size="small"
                        scroll={{ x: isMobile ? 600 : undefined }}
                        onRow={(r: any) => ({
                            style: { background: r.priority === 'HOT' ? '#fef2f2' : r.priority === 'WARM' ? '#fffbeb' : 'transparent' }
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
                <div>
                    <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 24, fontWeight: 700 }}>
                        🏫 The School Sales Engine
                    </h2>
                    <span style={{ color: '#888', fontSize: 13 }}>BOD Dashboard • Real-time</span>
                </div>
                <Space wrap size={isMobile ? 'small' : 'middle'}>
                    <RangePicker
                        value={dateRange}
                        onChange={(v) => v && setDateRange(v as [dayjs.Dayjs, dayjs.Dayjs])}
                        format="DD/MM/YYYY"
                        size={isMobile ? 'small' : 'middle'}
                    />
                    <Select
                        placeholder="Tất cả NV"
                        allowClear
                        style={{ width: isMobile ? 100 : 150 }}
                        size={isMobile ? 'small' : 'middle'}
                        value={salesRepFilter}
                        onChange={setSalesRepFilter}
                        options={users.map((u: any) => ({ label: u.full_name || u.username, value: u.id }))}
                    />
                    <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading} size={isMobile ? 'small' : 'middle'}>
                        {isMobile ? '' : 'Làm mới'}
                    </Button>
                </Space>
            </div>

            <Spin spinning={loading}>
                {/* TOP ROW: KPI Cards */}
                {KpiCards()}

                {/* HIGH-VALUE LEADS (Manager Focus) */}
                {HighValueLeads()}

                {/* MONTHLY TREND */}
                {MonthlyTrend()}

                {/* MIDDLE ROW: Charts */}
                <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
                    <Col xs={24} lg={12}>
                        {LeadSourceROI()}
                    </Col>
                    <Col xs={24} lg={12}>
                        {ConversionFunnel()}
                    </Col>
                </Row>

                {/* BOTTOM ROW: Scorecard + Forecast */}
                <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
                    <Col xs={24} lg={12}>
                        {SalesScorecard()}
                    </Col>
                    <Col xs={24} lg={12}>
                        {RevenueForecast()}
                    </Col>
                </Row>

                {/* TOP CUSTOMERS + TOP PRODUCTS/CATEGORIES */}
                <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
                    <Col xs={24} lg={12} style={{ display: 'flex', flexDirection: 'column' }}>
                        {TopCustomers()}
                    </Col>
                    <Col xs={24} lg={12}>
                        <Space direction="vertical" size="large" style={{ display: 'flex' }}>
                            {TopProducts()}
                            {TopCategories()}
                        </Space>
                    </Col>
                </Row>

                {/* REGION STATS */}
                <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
                    <Col xs={24}>
                        {RegionStats()}
                    </Col>
                </Row>

                {/* ACCOUNTS RECEIVABLE */}
                {AccountsReceivable()}
            </Spin>
        </div>
    );
};

export default BodDashboard;
