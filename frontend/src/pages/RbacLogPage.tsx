import React, { useEffect, useState, useCallback } from 'react';
import {
    Card, Tabs, Table, Tag, Segmented, Button, DatePicker, Select,
    Space, Tooltip, Modal, message, Typography, Row, Col, Alert, Badge
} from 'antd';
import {
    SafetyCertificateOutlined, ReloadOutlined, DownloadOutlined,
    ExclamationCircleOutlined, InfoCircleOutlined
} from '@ant-design/icons';
import api from '../utils/api';
import dayjs from 'dayjs';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

interface RbacReportItem {
    method: string;
    route: string;
    decision: string;
    required: string | null;
    username: string | null;
    count: number;
    last_seen: string;
    ips: string[] | string | null;
}

interface UnclassifiedRouteItem {
    route: string;
    method: string;
    hit_count: number;
    first_seen: string;
    last_seen: string;
}

const METHOD_COLORS: Record<string, string> = {
    GET: 'blue',
    POST: 'green',
    PUT: 'orange',
    DELETE: 'red',
    PATCH: 'purple',
};

const parseRequired = (requiredStr: string | null) => {
    if (!requiredStr) return { module: '-', action: '-' };
    try {
        if (requiredStr.startsWith('{')) {
            const parsed = JSON.parse(requiredStr);
            return {
                module: parsed.module || '-',
                action: parsed.action || '-'
            };
        }
    } catch {
        // Fallback for non-JSON format
    }
    if (requiredStr.includes(':')) {
        const [mod, act] = requiredStr.split(':');
        return { module: mod, action: act || '-' };
    }
    return { module: requiredStr, action: '-' };
};

const formatIps = (ips: string[] | string | null): string => {
    if (!ips) return '-';
    if (Array.isArray(ips)) {
        return ips.filter(Boolean).join(', ') || '-';
    }
    return String(ips);
};

const RbacLogPage: React.FC = () => {
    // RBAC Mode
    const [currentMode, setCurrentMode] = useState<string>('SHADOW');
    const [modeLoading, setModeLoading] = useState(false);

    // Reports (Tab 1 - Aggregated)
    const [reports, setReports] = useState<RbacReportItem[]>([]);
    const [reportsLoading, setReportsLoading] = useState(false);
    const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
        dayjs().subtract(7, 'day').startOf('day'),
        dayjs().endOf('day')
    ]);
    const [decisionFilter, setDecisionFilter] = useState<string>('ALL');

    // Unclassified (Tab 2)
    const [unclassified, setUnclassified] = useState<UnclassifiedRouteItem[]>([]);
    const [unclassifiedLoading, setUnclassifiedLoading] = useState(false);

    // Fetch Mode
    const fetchMode = useCallback(async () => {
        setModeLoading(true);
        try {
            const res = await api.get('/auth/rbac/mode');
            if (res.data?.mode) {
                setCurrentMode(res.data.mode);
            }
        } catch (err: any) {
            console.error('Lỗi tải chế độ RBAC:', err);
        } finally {
            setModeLoading(false);
        }
    }, []);

    // Fetch Reports
    const fetchReports = useCallback(async () => {
        setReportsLoading(true);
        try {
            const from = dateRange[0].toISOString();
            const to = dateRange[1].toISOString();
            const res = await api.get('/auth/rbac/report', {
                params: {
                    from,
                    to,
                    decision: decisionFilter !== 'ALL' ? decisionFilter : undefined
                }
            });
            if (Array.isArray(res.data)) {
                setReports(res.data);
            }
        } catch (err: any) {
            message.error(err.response?.data?.message || 'Lỗi tải báo cáo phân quyền RBAC');
        } finally {
            setReportsLoading(false);
        }
    }, [dateRange, decisionFilter]);

    // Fetch Unclassified
    const fetchUnclassified = useCallback(async () => {
        setUnclassifiedLoading(true);
        try {
            const res = await api.get('/auth/rbac/unclassified');
            if (Array.isArray(res.data)) {
                setUnclassified(res.data);
            }
        } catch (err: any) {
            message.error(err.response?.data?.message || 'Lỗi tải danh sách route chưa phân hạng');
        } finally {
            setUnclassifiedLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMode();
        fetchReports();
    }, [fetchMode, fetchReports]);

    const handleModeChange = (newMode: string) => {
        if (newMode === currentMode) return;

        Modal.confirm({
            title: `Xác nhận đổi chế độ RBAC sang [${newMode}]?`,
            icon: <ExclamationCircleOutlined />,
            content: newMode === 'OFF'
                ? 'Ở chế độ OFF, hệ thống sẽ bỏ qua kiểm tra quyền RBAC đối với mọi request.'
                : 'Ở chế độ SHADOW, hệ thống sẽ ghi log các vi phạm quyền mà không chặn request của người dùng.',
            okText: 'Xác nhận',
            cancelText: 'Hủy',
            onOk: async () => {
                try {
                    const res = await api.put('/auth/rbac/mode', { mode: newMode });
                    setCurrentMode(res.data.mode);
                    message.success(`Đã chuyển RBAC sang chế độ ${res.data.mode}`);
                } catch (e: any) {
                    message.error(e.response?.data?.message || 'Không thể đổi chế độ RBAC');
                }
            }
        });
    };

    // Export to Excel (Aggregated columns matching spec A3)
    const handleExportExcel = async () => {
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('RBAC Summary Report');

            worksheet.columns = [
                { header: 'Phương thức', key: 'method', width: 14 },
                { header: 'Đường dẫn (Route)', key: 'route', width: 34 },
                { header: 'Quyền yêu cầu (Required)', key: 'required', width: 24 },
                { header: 'Người dùng', key: 'username', width: 18 },
                { header: 'Quyết định', key: 'decision', width: 18 },
                { header: 'Số lần (Hit Count)', key: 'count', width: 18 },
                { header: 'Lần cuối xuất hiện', key: 'last_seen', width: 22 },
                { header: 'Danh sách IP', key: 'ips', width: 30 },
            ];

            // Header styling
            worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            worksheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF1890FF' }
            };

            reports.forEach(item => {
                worksheet.addRow({
                    method: item.method,
                    route: item.route,
                    required: item.required || '-',
                    username: item.username || '(Anonymous)',
                    decision: item.decision,
                    count: item.count,
                    last_seen: item.last_seen ? dayjs(item.last_seen).format('YYYY-MM-DD HH:mm:ss') : '-',
                    ips: formatIps(item.ips),
                });
            });

            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `RBAC_Report_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`);
            message.success('Xuất file Excel thành công');
        } catch (err) {
            console.error('Lỗi xuất Excel:', err);
            message.error('Không thể xuất file Excel');
        }
    };

    const getModeBadge = (mode: string) => {
        switch (mode) {
            case 'OFF':
                return <Tag color="default" style={{ fontSize: 13, padding: '4px 10px' }}>OFF (Không kiểm tra)</Tag>;
            case 'SHADOW':
                return <Tag color="warning" style={{ fontSize: 13, padding: '4px 10px' }}>SHADOW (Ghi log vi phạm, không chặn)</Tag>;
            case 'ENFORCE':
                return <Tag color="success" style={{ fontSize: 13, padding: '4px 10px' }}>ENFORCE (Chặn truy cập trái phép)</Tag>;
            default:
                return <Tag>{mode}</Tag>;
        }
    };

    // Columns: Method, Route, Quyền cần, User, Số lần, Lần cuối, IP (A3)
    const reportColumns = [
        {
            title: 'Phương thức',
            dataIndex: 'method',
            key: 'method',
            width: 90,
            render: (method: string) => (
                <Tag color={METHOD_COLORS[method] || 'default'}>{method}</Tag>
            )
        },
        {
            title: 'Đường dẫn (Route)',
            dataIndex: 'route',
            key: 'route',
            render: (route: string) => (
                <code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: 4 }}>{route}</code>
            )
        },
        {
            title: 'Quyền cần',
            dataIndex: 'required',
            key: 'required',
            width: 180,
            render: (reqStr: string | null) => {
                if (!reqStr) return <span style={{ color: '#999' }}>-</span>;
                const { module, action } = parseRequired(reqStr);
                if (module === '-') return <Tag>{reqStr}</Tag>;
                return (
                    <Space size={4}>
                        <Tag color="cyan">{module}</Tag>
                        <Tag>{action}</Tag>
                    </Space>
                );
            }
        },
        {
            title: 'Người dùng',
            dataIndex: 'username',
            key: 'username',
            width: 130,
            render: (user: string | null) => user ? (
                <Tag color={user === 'admin' ? 'gold' : 'blue'}><b>{user}</b></Tag>
            ) : <span style={{ color: '#999' }}>(Ẩn danh)</span>
        },
        {
            title: 'Quyết định',
            dataIndex: 'decision',
            key: 'decision',
            width: 140,
            render: (dec: string) => {
                switch (dec) {
                    case 'ALLOW':
                        return <Tag color="success">ALLOW</Tag>;
                    case 'DENY_NO_AUTH':
                    case 'SHADOW_DENIED':
                        return <Tag color="gold">{dec}</Tag>;
                    case 'DENY_NO_PERM':
                    case 'DENIED':
                        return <Tag color="error">{dec}</Tag>;
                    case 'UNCLASSIFIED':
                        return <Tag color="default">UNCLASSIFIED</Tag>;
                    default:
                        return <Tag>{dec}</Tag>;
                }
            }
        },
        {
            title: 'Số lần',
            dataIndex: 'count',
            key: 'count',
            width: 110,
            sorter: (a: RbacReportItem, b: RbacReportItem) => a.count - b.count,
            render: (count: number) => (
                <Badge count={count} overflowCount={99999} style={{ backgroundColor: '#108ee9' }} />
            )
        },
        {
            title: 'Lần cuối',
            dataIndex: 'last_seen',
            key: 'last_seen',
            width: 170,
            render: (val: string) => val ? dayjs(val).format('YYYY-MM-DD HH:mm:ss') : '-'
        },
        {
            title: 'IP',
            dataIndex: 'ips',
            key: 'ips',
            width: 150,
            render: (ips: string[] | string | null) => formatIps(ips)
        }
    ];

    const unclassifiedColumns = [
        {
            title: 'Đường dẫn (Route)',
            dataIndex: 'route',
            key: 'route',
            render: (route: string) => (
                <code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: 4 }}>{route}</code>
            )
        },
        {
            title: 'Phương thức',
            dataIndex: 'method',
            key: 'method',
            width: 100,
            render: (method: string) => (
                <Tag color={METHOD_COLORS[method] || 'default'}>{method}</Tag>
            )
        },
        {
            title: 'Số lần gọi (Hit Count)',
            dataIndex: 'hit_count',
            key: 'hit_count',
            width: 160,
            sorter: (a: UnclassifiedRouteItem, b: UnclassifiedRouteItem) => a.hit_count - b.hit_count,
            render: (count: number) => (
                <Badge count={count} overflowCount={99999} style={{ backgroundColor: '#52c41a' }} />
            )
        },
        {
            title: 'Lần đầu ghi nhận',
            dataIndex: 'first_seen',
            key: 'first_seen',
            width: 180,
            render: (val: string) => val ? dayjs(val).format('YYYY-MM-DD HH:mm:ss') : '-'
        },
        {
            title: 'Lần cuối ghi nhận',
            dataIndex: 'last_seen',
            key: 'last_seen',
            width: 180,
            render: (val: string) => val ? dayjs(val).format('YYYY-MM-DD HH:mm:ss') : '-'
        }
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Header / Mode Status */}
            <Card>
                <Row align="middle" justify="space-between" gutter={[16, 16]}>
                    <Col>
                        <Space align="center" size={12}>
                            <SafetyCertificateOutlined style={{ fontSize: 28, color: '#1890ff' }} />
                            <div>
                                <Title level={4} style={{ margin: 0 }}>Quản trị Phân quyền RBAC & Nhật ký Truy cập</Title>
                                <Text type="secondary">Giám sát và kiểm soát phân quyền hệ thống</Text>
                            </div>
                        </Space>
                    </Col>
                    <Col>
                        <Space align="center" size={16}>
                            <Space size={6}>
                                <Text strong>Chế độ hiện tại:</Text>
                                {getModeBadge(currentMode)}
                            </Space>

                            <Segmented
                                options={[
                                    { label: 'OFF', value: 'OFF' },
                                    { label: 'SHADOW', value: 'SHADOW' },
                                    {
                                        label: (
                                            <Tooltip title="Mở ở Phase 2">
                                                <span style={{ color: '#bbb' }}>ENFORCE</span>
                                            </Tooltip>
                                        ),
                                        value: 'ENFORCE',
                                        disabled: true
                                    }
                                ]}
                                value={currentMode}
                                onChange={(val) => handleModeChange(val as string)}
                                disabled={modeLoading}
                            />
                        </Space>
                    </Col>
                </Row>
            </Card>

            {/* Tabs */}
            <Card>
                <Tabs
                    defaultActiveKey="report"
                    items={[
                        {
                            key: 'report',
                            label: '🛡️ Báo cáo Quyền (Tổng hợp)',
                            children: (
                                <div>
                                    {/* Filters */}
                                    <Row justify="space-between" align="middle" style={{ marginBottom: 16 }} gutter={[12, 12]}>
                                        <Col>
                                            <Space wrap>
                                                <RangePicker
                                                    value={dateRange}
                                                    onChange={(dates) => {
                                                        if (dates && dates[0] && dates[1]) {
                                                            setDateRange([dates[0].startOf('day'), dates[1].endOf('day')]);
                                                        }
                                                    }}
                                                    format="YYYY-MM-DD"
                                                />
                                                <Select
                                                    value={decisionFilter}
                                                    onChange={setDecisionFilter}
                                                    style={{ width: 220 }}
                                                    options={[
                                                        { label: 'Tất cả quyết định', value: 'ALL' },
                                                        { label: 'ALLOW (Hợp lệ)', value: 'ALLOW' },
                                                        { label: 'DENY_NO_AUTH (Chưa đăng nhập)', value: 'DENY_NO_AUTH' },
                                                        { label: 'DENY_NO_PERM (Thiếu quyền)', value: 'DENY_NO_PERM' },
                                                        { label: 'UNCLASSIFIED (Chưa phân hạng)', value: 'UNCLASSIFIED' },
                                                    ]}
                                                />
                                                <Button
                                                    icon={<ReloadOutlined />}
                                                    onClick={fetchReports}
                                                    loading={reportsLoading}
                                                >
                                                    Tải lại
                                                </Button>
                                            </Space>
                                        </Col>
                                        <Col>
                                            <Button
                                                type="primary"
                                                icon={<DownloadOutlined />}
                                                onClick={handleExportExcel}
                                                disabled={reports.length === 0}
                                            >
                                                Xuất Excel ({reports.length} dòng tổng hợp)
                                            </Button>
                                        </Col>
                                    </Row>

                                    <Table
                                        dataSource={reports}
                                        columns={reportColumns}
                                        rowKey={(r) => `${r.method}_${r.route}_${r.decision}_${r.username || 'anon'}_${r.required || 'none'}`}
                                        loading={reportsLoading}
                                        pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100'] }}
                                        scroll={{ x: 1000 }}
                                    />
                                </div>
                            )
                        },
                        {
                            key: 'unclassified',
                            label: '⚠️ Route chưa phân hạng',
                            children: (
                                <div>
                                    <Alert
                                        type="info"
                                        showIcon
                                        icon={<InfoCircleOutlined />}
                                        message="Các route chưa phân hạng"
                                        description="Danh sách các API đã nhận request nhưng chưa được khai báo decorator phân quyền (@Perm, @AnyPerm, @AuthOnly, @Public). Cần phân loại các route này trước khi kích hoạt ENFORCE."
                                        style={{ marginBottom: 16 }}
                                    />

                                    <Row justify="end" style={{ marginBottom: 12 }}>
                                        <Button
                                            icon={<ReloadOutlined />}
                                            onClick={fetchUnclassified}
                                            loading={unclassifiedLoading}
                                        >
                                            Làm mới
                                        </Button>
                                    </Row>

                                    <Table
                                        dataSource={unclassified}
                                        columns={unclassifiedColumns}
                                        rowKey={(r) => `${r.method}_${r.route}`}
                                        loading={unclassifiedLoading}
                                        pagination={{ pageSize: 20 }}
                                    />
                                </div>
                            )
                        }
                    ]}
                    onChange={(activeKey) => {
                        if (activeKey === 'unclassified' && unclassified.length === 0) {
                            fetchUnclassified();
                        }
                    }}
                />
            </Card>
        </div>
    );
};

export default RbacLogPage;
