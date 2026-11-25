import React, { useEffect, useState, useCallback } from 'react';
import {
    Card, Tabs, Table, Tag, Button, DatePicker, Select, Input,
    Space, Modal, message, Typography, Row, Col, Alert, Badge
} from 'antd';
import {
    SafetyCertificateOutlined, ReloadOutlined, DownloadOutlined,
    ExclamationCircleOutlined, InfoCircleOutlined, CheckCircleOutlined,
    WarningOutlined, PoweroffOutlined
} from '@ant-design/icons';
import api from '../utils/api';
import dayjs from 'dayjs';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { brandColors } from '../theme/brand';

const { Title, Text, Paragraph } = Typography;
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

interface ReadinessRouteItem {
    method: string;
    route: string;
    required: string | null;
    would_deny: number;
    distinct_users: number;
    last_seen: string;
}

interface ReadinessData {
    days: number;
    routes: ReadinessRouteItem[];
    unclassified_routes: UnclassifiedRouteItem[];
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
        // Fallback
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
    // Current user & permissions check
    const userStr = typeof localStorage !== 'undefined' ? localStorage.getItem('user') : null;
    const currentUser = userStr ? JSON.parse(userStr) : null;
    const isAdmin = currentUser?.username === 'admin';
    const canManageRbac =
        isAdmin ||
        (currentUser?.permissions || []).some(
            (p: any) => p.module_code === 'SYSTEM' && (p.can_update === true || p.can_update === 1)
        );

    // RBAC Mode
    const [modeInfo, setModeInfo] = useState<{ mode: string; effective_mode: string; forced: boolean }>({
        mode: 'SHADOW',
        effective_mode: 'SHADOW',
        forced: false,
    });
    const [modeLoading, setModeLoading] = useState(false);

    // Enforce Modal state
    const [enforceModalVisible, setEnforceModalVisible] = useState(false);
    const [enforceInputText, setEnforceInputText] = useState('');
    const [enforceUpdating, setEnforceUpdating] = useState(false);

    // Readiness (Tab 1 - Sẵn sàng bật thực thi)
    const [readinessData, setReadinessData] = useState<ReadinessData | null>(null);
    const [readinessDays, setReadinessDays] = useState<number>(7);
    const [readinessLoading, setReadinessLoading] = useState(false);

    // Reports (Tab 2 - Aggregated)
    const [reports, setReports] = useState<RbacReportItem[]>([]);
    const [reportsLoading, setReportsLoading] = useState(false);
    const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
        dayjs().subtract(7, 'day').startOf('day'),
        dayjs().endOf('day')
    ]);
    const [decisionFilter, setDecisionFilter] = useState<string>('ALL');

    // Unclassified (Tab 3)
    const [unclassified, setUnclassified] = useState<UnclassifiedRouteItem[]>([]);
    const [unclassifiedLoading, setUnclassifiedLoading] = useState(false);

    // Fetch Mode
    const fetchMode = useCallback(async () => {
        setModeLoading(true);
        try {
            const res = await api.get('/auth/rbac/mode');
            if (res.data) {
                setModeInfo({
                    mode: res.data.mode || 'SHADOW',
                    effective_mode: res.data.effective_mode || res.data.mode || 'SHADOW',
                    forced: !!res.data.forced,
                });
            }
        } catch (err: any) {
            console.error('Lỗi tải chế độ RBAC:', err);
        } finally {
            setModeLoading(false);
        }
    }, []);

    // Fetch Readiness
    const fetchReadiness = useCallback(async (days: number = 7) => {
        setReadinessLoading(true);
        try {
            const res = await api.get('/auth/rbac/readiness', { params: { days } });
            if (res.data) {
                setReadinessData(res.data);
            }
        } catch (err: any) {
            console.error('Lỗi tải báo cáo sẵn sàng:', err);
            message.error(err.response?.data?.message || 'Không thể tải báo cáo sẵn sàng bật thực thi');
        } finally {
            setReadinessLoading(false);
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
        fetchReadiness(readinessDays);
        if (isAdmin) {
            fetchReports();
        }
    }, [fetchMode, fetchReadiness, readinessDays, fetchReports, isAdmin]);

    // Handle Switch to ENFORCE (with typing confirmation)
    const handleConfirmEnforce = async () => {
        if (enforceInputText.trim() !== 'ENFORCE') {
            message.warning('Vui lòng gõ chính xác "ENFORCE" để xác nhận');
            return;
        }

        setEnforceUpdating(true);
        try {
            const res = await api.put('/auth/rbac/mode', { mode: 'ENFORCE' });
            if (res.data) {
                setModeInfo({
                    mode: res.data.mode || 'ENFORCE',
                    effective_mode: res.data.effective_mode || res.data.mode || 'ENFORCE',
                    forced: !!res.data.forced,
                });
            }
            message.success('Đã kích hoạt chế độ THỰC THI (ENFORCE) thành công');
            setEnforceModalVisible(false);
            setEnforceInputText('');
            fetchReadiness(readinessDays);
        } catch (err: any) {
            message.error(err.response?.data?.message || 'Không thể đổi chế độ sang ENFORCE');
        } finally {
            setEnforceUpdating(false);
        }
    };

    // Handle Switch to SHADOW
    const handleSwitchToShadow = () => {
        Modal.confirm({
            title: 'Xác nhận chuyển về chế độ GHI LOG (SHADOW)?',
            icon: <ExclamationCircleOutlined style={{ color: brandColors.orange }} />,
            content: (
                <div>
                    <Paragraph>
                        Hệ thống sẽ chuyển về chế độ <b>SHADOW</b>:
                    </Paragraph>
                    <Paragraph type="secondary">
                        Các truy cập thiếu quyền vẫn được tiếp tục và ghi nhận vào nhật ký kiểm tra mà không chặn thao tác của người dùng.
                    </Paragraph>
                </div>
            ),
            okText: 'Xác nhận về SHADOW',
            cancelText: 'Hủy',
            okButtonProps: { style: { backgroundColor: brandColors.navy, borderColor: brandColors.navy } },
            onOk: async () => {
                try {
                    const res = await api.put('/auth/rbac/mode', { mode: 'SHADOW' });
                    if (res.data) {
                        setModeInfo({
                            mode: res.data.mode || 'SHADOW',
                            effective_mode: res.data.effective_mode || res.data.mode || 'SHADOW',
                            forced: !!res.data.forced,
                        });
                    }
                    message.success('Đã chuyển hệ thống về chế độ SHADOW');
                    fetchReadiness(readinessDays);
                } catch (err: any) {
                    message.error(err.response?.data?.message || 'Không thể đổi chế độ sang SHADOW');
                }
            }
        });
    };

    // Export to Excel
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

            worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            worksheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF272F72' }
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

    const getModeBadge = (effectiveMode: string, forced: boolean) => {
        if (effectiveMode === 'ENFORCE') {
            return (
                <Tag color="error" style={{ fontSize: 13, padding: '4px 12px', fontWeight: 600 }}>
                    <CheckCircleOutlined /> ENFORCE (Đang chặn truy cập trái phép)
                </Tag>
            );
        }
        return (
            <Tag color="warning" style={{ fontSize: 13, padding: '4px 12px', fontWeight: 600 }}>
                <WarningOutlined /> SHADOW (Ghi log vi phạm, không chặn)
            </Tag>
        );
    };

    // Columns: Readiness Report
    const readinessColumns = [
        {
            title: 'Phương thức',
            dataIndex: 'method',
            key: 'method',
            width: 110,
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
            title: 'Quyền yêu cầu',
            dataIndex: 'required',
            key: 'required',
            width: 200,
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
            title: 'Số lần sẽ bị chặn',
            dataIndex: 'would_deny',
            key: 'would_deny',
            width: 170,
            sorter: (a: ReadinessRouteItem, b: ReadinessRouteItem) => a.would_deny - b.would_deny,
            render: (val: number) => (
                <Badge
                    count={val}
                    overflowCount={99999}
                    style={{ backgroundColor: brandColors.orange, fontSize: 13 }}
                />
            )
        },
        {
            title: 'Số người dùng ảnh hưởng',
            dataIndex: 'distinct_users',
            key: 'distinct_users',
            width: 190,
            sorter: (a: ReadinessRouteItem, b: ReadinessRouteItem) => a.distinct_users - b.distinct_users,
            render: (val: number) => (
                <Badge
                    count={val}
                    overflowCount={99999}
                    style={{ backgroundColor: brandColors.navy, fontSize: 13 }}
                />
            )
        },
        {
            title: 'Lần cuối xuất hiện',
            dataIndex: 'last_seen',
            key: 'last_seen',
            width: 180,
            render: (val: string) => val ? dayjs(val).format('YYYY-MM-DD HH:mm:ss') : '-'
        }
    ];

    // Columns: General Report
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
                <Badge count={count} overflowCount={99999} style={{ backgroundColor: brandColors.navy }} />
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
            <Card style={{ borderRadius: 12 }}>
                <Row align="middle" justify="space-between" gutter={[16, 16]}>
                    <Col>
                        <Space align="center" size={12}>
                            <SafetyCertificateOutlined style={{ fontSize: 32, color: brandColors.navy }} />
                            <div>
                                <Title level={4} style={{ margin: 0, color: brandColors.navy }}>
                                    Quản trị Phân quyền RBAC & Kiểm soát Thực thi
                                </Title>
                                <Text type="secondary">
                                    Giám sát lưu lượng, đánh giá an toàn và kiểm soát chế độ phân quyền toàn hệ thống
                                </Text>
                            </div>
                        </Space>
                    </Col>
                    <Col>
                        <Space align="center" size={16} wrap>
                            <Space size={8}>
                                <Text strong>Chế độ hiệu lực:</Text>
                                {getModeBadge(modeInfo.effective_mode, modeInfo.forced)}
                            </Space>

                            {canManageRbac && (
                                <Space size={8}>
                                    {modeInfo.effective_mode === 'SHADOW' ? (
                                        <Button
                                            type="primary"
                                            icon={<SafetyCertificateOutlined />}
                                            style={{
                                                backgroundColor: brandColors.orange,
                                                borderColor: brandColors.orange,
                                                fontWeight: 600,
                                            }}
                                            onClick={() => {
                                                setEnforceInputText('');
                                                setEnforceModalVisible(true);
                                            }}
                                            disabled={modeLoading || modeInfo.forced}
                                        >
                                            Bật thực thi (ENFORCE)
                                        </Button>
                                    ) : (
                                        <Button
                                            icon={<PoweroffOutlined />}
                                            onClick={handleSwitchToShadow}
                                            disabled={modeLoading || modeInfo.forced}
                                        >
                                            Về chế độ ghi log (SHADOW)
                                        </Button>
                                    )}
                                </Space>
                            )}
                        </Space>
                    </Col>
                </Row>

                {modeInfo.forced && (
                    <Alert
                        type="warning"
                        showIcon
                        icon={<WarningOutlined />}
                        message="Chế độ RBAC đang bị ghi đè bởi máy chủ"
                        description="Biến môi trường RBAC_FORCE_MODE đang có hiệu lực. Mọi thay đổi chế độ từ giao diện người dùng sẽ chỉ có hiệu lực sau khi biến môi trường máy chủ được gỡ bỏ."
                        style={{ marginTop: 16 }}
                    />
                )}
            </Card>

            {/* Modal Xác nhận bật ENFORCE */}
            <Modal
                title={
                    <Space>
                        <ExclamationCircleOutlined style={{ color: brandColors.orange, fontSize: 22 }} />
                        <span>Xác nhận kích hoạt chế độ THỰC THI (ENFORCE)</span>
                    </Space>
                }
                open={enforceModalVisible}
                onCancel={() => {
                    setEnforceModalVisible(false);
                    setEnforceInputText('');
                }}
                footer={[
                    <Button key="cancel" onClick={() => setEnforceModalVisible(false)}>
                        Hủy
                    </Button>,
                    <Button
                        key="confirm"
                        type="primary"
                        danger
                        style={{
                            backgroundColor: enforceInputText.trim() === 'ENFORCE' ? brandColors.orange : undefined,
                            borderColor: enforceInputText.trim() === 'ENFORCE' ? brandColors.orange : undefined,
                        }}
                        loading={enforceUpdating}
                        disabled={enforceInputText.trim() !== 'ENFORCE'}
                        onClick={handleConfirmEnforce}
                    >
                        Xác nhận bật ENFORCE
                    </Button>
                ]}
            >
                <div style={{ marginTop: 12 }}>
                    <Alert
                        type="error"
                        showIcon
                        message="LƯU Ý QUAN TRỌNG VỀ HẬU QUẢ"
                        description={
                            <div>
                                <Paragraph style={{ margin: '8px 0 4px 0' }}>
                                    Khi kích hoạt chế độ <b>ENFORCE</b>, hệ thống sẽ thực thi chặn truy cập đối với tất cả yêu cầu không hợp lệ:
                                </Paragraph>
                                <ul style={{ paddingLeft: 20, margin: 0 }}>
                                    <li>Yêu cầu thiếu token đăng nhập: trả về mã lỗi <b>401 (Unauthorized)</b>.</li>
                                    <li>Yêu cầu tài khoản không có quyền trong nhóm: trả về mã lỗi <b>403 (Forbidden)</b>.</li>
                                </ul>
                                <Paragraph style={{ margin: '8px 0 0 0' }}>
                                    Người dùng không được cấp quyền sẽ bị từ chối truy cập ngay lập tức.
                                </Paragraph>
                            </div>
                        }
                        style={{ marginBottom: 16 }}
                    />

                    <Paragraph strong>
                        Để đảm bảo bạn đã đọc rõ cảnh báo trên, vui lòng nhập chữ <code>ENFORCE</code> vào ô bên dưới:
                    </Paragraph>
                    <Input
                        placeholder="Gõ ENFORCE để xác nhận"
                        value={enforceInputText}
                        onChange={(e) => setEnforceInputText(e.target.value)}
                        autoFocus
                    />
                </div>
            </Modal>

            {/* Tabs */}
            <Card style={{ borderRadius: 12 }}>
                <Tabs
                    defaultActiveKey="readiness"
                    items={[
                        {
                            key: 'readiness',
                            label: '🎯 Sẵn sàng bật thực thi',
                            children: (
                                <div>
                                    <Alert
                                        type="info"
                                        showIcon
                                        icon={<InfoCircleOutlined />}
                                        message="Đánh giá mức độ sẵn sàng chuyển sang ENFORCE"
                                        description="Bảng thống kê tổng hợp các API đã phát sinh vi phạm quyền (DENY_NO_PERM) trong chế độ SHADOW. Nếu số lần sẽ bị chặn và số người dùng ảnh hưởng về 0 (hoặc là các truy cập bất thường hợp lý), hệ thống đã an toàn để bật chế độ ENFORCE."
                                        style={{ marginBottom: 16 }}
                                    />

                                    <Row justify="space-between" align="middle" style={{ marginBottom: 16 }} gutter={[12, 12]}>
                                        <Col>
                                            <Space wrap>
                                                <Text strong>Khoảng thời gian khảo sát:</Text>
                                                <Select
                                                    value={readinessDays}
                                                    onChange={(val) => {
                                                        setReadinessDays(val);
                                                        fetchReadiness(val);
                                                    }}
                                                    style={{ width: 150 }}
                                                    options={[
                                                        { label: '7 ngày qua', value: 7 },
                                                        { label: '14 ngày qua', value: 14 },
                                                        { label: '30 ngày qua', value: 30 },
                                                    ]}
                                                />
                                                <Button
                                                    icon={<ReloadOutlined />}
                                                    onClick={() => fetchReadiness(readinessDays)}
                                                    loading={readinessLoading}
                                                >
                                                    Làm mới
                                                </Button>
                                            </Space>
                                        </Col>
                                        <Col>
                                            <Text type="secondary">
                                                Tổng số route sẽ bị ảnh hưởng: <b>{readinessData?.routes?.length || 0}</b>
                                            </Text>
                                        </Col>
                                    </Row>

                                    <Table
                                        dataSource={readinessData?.routes || []}
                                        columns={readinessColumns}
                                        rowKey={(r) => `${r.method}_${r.route}_${r.required || 'none'}`}
                                        loading={readinessLoading}
                                        pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: ['10', '20', '50'] }}
                                        scroll={{ x: 900 }}
                                        locale={{
                                            emptyText: 'Tuyệt vời! Không có route nào phát sinh vi phạm quyền trong thời gian khảo sát.'
                                        }}
                                    />

                                    {readinessData?.unclassified_routes && readinessData.unclassified_routes.length > 0 && (
                                        <div style={{ marginTop: 24 }}>
                                            <Title level={5} style={{ color: brandColors.orange }}>
                                                ⚠️ Route chưa phân loại đã nhận request trong {readinessDays} ngày qua ({readinessData.unclassified_routes.length})
                                            </Title>
                                            <Table
                                                dataSource={readinessData.unclassified_routes}
                                                columns={unclassifiedColumns}
                                                rowKey={(r) => `${r.method}_${r.route}`}
                                                size="small"
                                                pagination={{ pageSize: 10 }}
                                            />
                                        </div>
                                    )}
                                </div>
                            )
                        },
                        ...(isAdmin ? [{
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
                                                        { label: 'UNCLASSIFIED (Chưa phân loại)', value: 'UNCLASSIFIED' },
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
                                                style={{ backgroundColor: brandColors.navy, borderColor: brandColors.navy }}
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
                        }] : []),
                        {
                            key: 'unclassified',
                            label: '⚠️ Route chưa phân loại',
                            children: (
                                <div>
                                    <Alert
                                        type="info"
                                        showIcon
                                        icon={<InfoCircleOutlined />}
                                        message="Các route chưa phân loại"
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
                        if (activeKey === 'readiness' && !readinessData) {
                            fetchReadiness(readinessDays);
                        } else if (activeKey === 'report' && isAdmin && reports.length === 0) {
                            fetchReports();
                        } else if (activeKey === 'unclassified' && unclassified.length === 0) {
                            fetchUnclassified();
                        }
                    }}
                />
            </Card>
        </div>
    );
};

export default RbacLogPage;
