import React, { useEffect, useState, useCallback } from 'react';
import { Row, Col, Card, Statistic, Tag, Table, Button, Badge, Tooltip, Empty, Spin, Space, Segmented } from 'antd';
import {
    WalletOutlined, ArrowUpOutlined, ArrowDownOutlined,
    AlertOutlined, ReloadOutlined, UserOutlined, ShopOutlined,
    ClockCircleOutlined, WarningOutlined, InfoCircleOutlined
} from '@ant-design/icons';
import { Line, Area } from '@ant-design/plots';
import api from '../../utils/api';
import dayjs from 'dayjs';

interface CashFlowSummary {
    currentBalance: number;
    todayIncome: number;
    todayExpense: number;
    forecast7Days: number;
    receivablesTotal: number;
    payablesTotal: number;
}

interface CashFlowChartPoint {
    date: string;
    income: number;
    expense: number;
    balance: number;
}

interface Receivable {
    customer_id: number;
    customer_name: string;
    total_amount: number;
    paid_amount: number;
    remaining: number;
    overdue_count: number;
    orders: { order_code: string; amount: number; remaining: number; delivery_date: Date }[];
}

interface Payable {
    supplier_id: number;
    supplier_name: string;
    total_amount: number;
    paid_amount: number;
    remaining: number;
    upcoming_count: number;
    orders: { po_code: string; amount: number; remaining: number }[];
}

interface Alert {
    id: string;
    type: string;
    severity: 'warning' | 'error' | 'info';
    title: string;
    description: string;
    link?: string;
}

const REFRESH_INTERVAL = 30000; // 30 seconds

const CashFlowDashboard: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState<CashFlowSummary | null>(null);
    const [chartData, setChartData] = useState<CashFlowChartPoint[]>([]);
    const [receivables, setReceivables] = useState<Receivable[]>([]);
    const [payables, setPayables] = useState<Payable[]>([]);
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [chartDays, setChartDays] = useState<number>(30);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [sumRes, chartRes, recRes, payRes, alertRes] = await Promise.all([
                api.get('/finance/cash-flow/summary'),
                api.get(`/finance/cash-flow/chart?days=${chartDays}`),
                api.get('/finance/cash-flow/receivables'),
                api.get('/finance/cash-flow/payables'),
                api.get('/finance/cash-flow/alerts'),
            ]);
            setSummary(sumRes.data);
            setChartData(chartRes.data);
            setReceivables(recRes.data);
            setPayables(payRes.data);
            setAlerts(alertRes.data);
        } catch (e) {
            console.error('Error fetching cash flow data:', e);
        }
        setLoading(false);
    }, [chartDays]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, REFRESH_INTERVAL);
        return () => clearInterval(interval);
    }, [fetchData]);

    // --- QUICK STATS CARDS ---
    const StatCards = () => (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} md={6}>
                <Card bordered={false} style={{ background: 'linear-gradient(135deg, #096dd9 0%, #1890ff 100%)', borderRadius: 12 }}>
                    <Statistic
                        title={<span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>💵 Quỹ tiền mặt</span>}
                        value={summary?.currentBalance || 0}
                        precision={0}
                        valueStyle={{ color: '#fff', fontWeight: 'bold', fontSize: 22 }}
                        prefix={<WalletOutlined />}
                        suffix="đ"
                    />
                </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
                <Card bordered={false} style={{ background: 'linear-gradient(135deg, #3f8600 0%, #52c41a 100%)', borderRadius: 12 }}>
                    <Statistic
                        title={<span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>⬆️ Thu hôm nay</span>}
                        value={summary?.todayIncome || 0}
                        precision={0}
                        valueStyle={{ color: '#fff', fontWeight: 'bold', fontSize: 22 }}
                        prefix={<ArrowUpOutlined />}
                        suffix="đ"
                    />
                </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
                <Card bordered={false} style={{ background: 'linear-gradient(135deg, #cf1322 0%, #ff4d4f 100%)', borderRadius: 12 }}>
                    <Statistic
                        title={<span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>⬇️ Chi hôm nay</span>}
                        value={summary?.todayExpense || 0}
                        precision={0}
                        valueStyle={{ color: '#fff', fontWeight: 'bold', fontSize: 22 }}
                        prefix={<ArrowDownOutlined />}
                        suffix="đ"
                    />
                </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
                <Card bordered={false} style={{ background: 'linear-gradient(135deg, #d48806 0%, #faad14 100%)', borderRadius: 12 }}>
                    <Statistic
                        title={<span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>📈 Dự báo 7 ngày</span>}
                        value={summary?.forecast7Days || 0}
                        precision={0}
                        valueStyle={{ color: '#fff', fontWeight: 'bold', fontSize: 22 }}
                        prefix={summary?.forecast7Days && summary.forecast7Days >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                        suffix="đ"
                    />
                </Card>
            </Col>
        </Row>
    );

    // --- CASH FLOW CHART ---
    const CashFlowChart = () => {
        // Transform data for dual-line chart
        const chartPoints: { date: string; type: string; value: number }[] = [];
        chartData.forEach(d => {
            chartPoints.push({ date: d.date, type: 'Thu', value: d.income });
            chartPoints.push({ date: d.date, type: 'Chi', value: d.expense });
        });

        return (
            <Card
                title={<span><WalletOutlined /> Biểu đồ dòng tiền</span>}
                bordered={false}
                style={{ borderRadius: 12, marginBottom: 24 }}
                extra={
                    <Space>
                        <Segmented
                            options={[
                                { label: '7 ngày', value: 7 },
                                { label: '14 ngày', value: 14 },
                                { label: '30 ngày', value: 30 },
                            ]}
                            value={chartDays}
                            onChange={(v) => setChartDays(v as number)}
                        />
                    </Space>
                }
            >
                {chartData.length > 0 ? (
                    <Line
                        data={chartPoints}
                        xField="date"
                        yField="value"
                        colorField="type"
                        color={({ type }: { type: string }) => type === 'Thu' ? '#52c41a' : '#f5222d'}
                        height={300}
                        smooth
                        point={{ size: 3 }}
                        xAxis={{
                            label: {
                                formatter: (v: string) => dayjs(v).format('DD/MM'),
                            },
                        }}
                        yAxis={{
                            label: {
                                formatter: (v: string) => `${(Number(v) / 1000000).toFixed(0)}M`,
                            },
                        }}
                        tooltip={{
                            formatter: (datum: { type: string; value: number }) => ({
                                name: datum.type,
                                value: `${Number(datum.value).toLocaleString()}đ`,
                            }),
                        }}
                        legend={{ position: 'top' }}
                    />
                ) : (
                    <Empty description="Không có dữ liệu" />
                )}
            </Card>
        );
    };

    // --- ALERTS PANEL ---
    const AlertsPanel = () => (
        <Card
            title={
                <span>
                    <AlertOutlined style={{ color: '#faad14' }} /> Cảnh báo
                    <Badge count={alerts.length} style={{ marginLeft: 8 }} />
                </span>
            }
            bordered={false}
            style={{ borderRadius: 12, height: '100%' }}
            bodyStyle={{ padding: alerts.length > 0 ? 16 : undefined }}
        >
            {alerts.length > 0 ? (
                <div>
                    {alerts.map((alert) => (
                        <div
                            key={alert.id}
                            style={{
                                padding: '12px 16px',
                                marginBottom: 10,
                                borderRadius: 8,
                                background: alert.severity === 'error' ? '#fff1f0' : alert.severity === 'warning' ? '#fffbe6' : '#e6f7ff',
                                borderLeft: `4px solid ${alert.severity === 'error' ? '#ff4d4f' : alert.severity === 'warning' ? '#faad14' : '#1890ff'}`,
                            }}
                        >
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>
                                {alert.severity === 'error' && <WarningOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />}
                                {alert.severity === 'warning' && <AlertOutlined style={{ color: '#faad14', marginRight: 8 }} />}
                                {alert.severity === 'info' && <InfoCircleOutlined style={{ color: '#1890ff', marginRight: 8 }} />}
                                {alert.title}
                            </div>
                            <div style={{ fontSize: 12, color: '#666' }}>{alert.description}</div>
                        </div>
                    ))}
                </div>
            ) : (
                <Empty description="Không có cảnh báo" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
        </Card>
    );

    // --- RECEIVABLES TABLE ---
    const ReceivablesTable = () => (
        <Card
            title={
                <span>
                    <UserOutlined style={{ color: '#1890ff' }} /> Công nợ phải thu
                    <Tag color="blue" style={{ marginLeft: 8 }}>{(summary?.receivablesTotal || 0).toLocaleString()}đ</Tag>
                </span>
            }
            bordered={false}
            style={{ borderRadius: 12 }}
        >
            <Table
                dataSource={receivables.slice(0, 5)}
                rowKey="customer_id"
                size="small"
                pagination={false}
                columns={[
                    {
                        title: 'Khách hàng',
                        dataIndex: 'customer_name',
                        render: (name: string, r: Receivable) => (
                            <span>
                                <b>{name}</b>
                                {r.overdue_count > 0 && (
                                    <Tooltip title={`${r.overdue_count} đơn quá hạn`}>
                                        <Tag color="red" style={{ marginLeft: 8 }}>Quá hạn</Tag>
                                    </Tooltip>
                                )}
                            </span>
                        ),
                    },
                    {
                        title: 'Còn nợ',
                        dataIndex: 'remaining',
                        align: 'right' as const,
                        render: (v: number) => <b style={{ color: '#cf1322' }}>{v.toLocaleString()}đ</b>,
                    },
                ]}
            />
            {receivables.length > 5 && (
                <div style={{ textAlign: 'center', marginTop: 12 }}>
                    <Button type="link">Xem tất cả ({receivables.length})</Button>
                </div>
            )}
        </Card>
    );

    // --- PAYABLES TABLE ---
    const PayablesTable = () => (
        <Card
            title={
                <span>
                    <ShopOutlined style={{ color: '#722ed1' }} /> Công nợ phải trả
                    <Tag color="purple" style={{ marginLeft: 8 }}>{(summary?.payablesTotal || 0).toLocaleString()}đ</Tag>
                </span>
            }
            bordered={false}
            style={{ borderRadius: 12 }}
        >
            <Table
                dataSource={payables.slice(0, 5)}
                rowKey="supplier_id"
                size="small"
                pagination={false}
                columns={[
                    {
                        title: 'Nhà cung cấp',
                        dataIndex: 'supplier_name',
                        render: (name: string, r: Payable) => (
                            <span>
                                <b>{name}</b>
                                {r.upcoming_count > 0 && (
                                    <Tooltip title={`${r.upcoming_count} PO gần đây`}>
                                        <Tag color="orange" style={{ marginLeft: 8 }}>Sắp hạn</Tag>
                                    </Tooltip>
                                )}
                            </span>
                        ),
                    },
                    {
                        title: 'Còn nợ',
                        dataIndex: 'remaining',
                        align: 'right' as const,
                        render: (v: number) => <b style={{ color: '#722ed1' }}>{v.toLocaleString()}đ</b>,
                    },
                ]}
            />
            {payables.length > 5 && (
                <div style={{ textAlign: 'center', marginTop: 12 }}>
                    <Button type="link">Xem tất cả ({payables.length})</Button>
                </div>
            )}
        </Card>
    );

    return (
        <div style={{ padding: '0 0 24px' }}>
            {/* HEADER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 style={{ margin: 0 }}>💰 Quản lý Dòng tiền</h2>
                <Space>
                    <Tooltip title="Tự động làm mới mỗi 30 giây">
                        <Tag icon={<ClockCircleOutlined />} color="blue">Auto-refresh</Tag>
                    </Tooltip>
                    <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
                        Làm mới
                    </Button>
                </Space>
            </div>

            <Spin spinning={loading}>
                {/* QUICK STATS */}
                <StatCards />

                {/* CHART + ALERTS */}
                <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
                    <Col xs={24} lg={16}>
                        <CashFlowChart />
                    </Col>
                    <Col xs={24} lg={8}>
                        <AlertsPanel />
                    </Col>
                </Row>

                {/* RECEIVABLES + PAYABLES */}
                <Row gutter={[24, 24]}>
                    <Col xs={24} md={12}>
                        <ReceivablesTable />
                    </Col>
                    <Col xs={24} md={12}>
                        <PayablesTable />
                    </Col>
                </Row>
            </Spin>
        </div>
    );
};

export default CashFlowDashboard;
