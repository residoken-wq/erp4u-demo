import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Button, Typography, Tag, List, Avatar, Skeleton, Progress, Empty, Tooltip, Badge, Divider } from 'antd';
import {
    ShoppingCartOutlined, DropboxOutlined, DollarOutlined,
    ClockCircleOutlined, UserOutlined, ShopOutlined, CheckCircleOutlined,
    AlertOutlined, PlusOutlined, ExperimentOutlined, FileTextOutlined,
    CheckSquareOutlined, TeamOutlined, RightOutlined, FireOutlined,
    PhoneOutlined, MessageOutlined, IdcardOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';
import api from '../utils/api';
import LeadCareModal from '../components/crm/LeadCareModal';

dayjs.extend(relativeTime);
dayjs.locale('vi');

const { Title, Text } = Typography;

const DashboardPage: React.FC = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [recentLogs, setRecentLogs] = useState<any[]>([]);
    const [myTasks, setMyTasks] = useState<any[]>([]);
    const [incompleteLeads, setIncompleteLeads] = useState<any[]>([]);
    const [leadCareOpen, setLeadCareOpen] = useState(false);
    const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);

    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    const permissions = user?.permissions || [];

    const hasPerm = (moduleCode: string) => {
        if (user?.username === 'admin') return true;
        const p = permissions.find((perm: any) => perm.module_code === moduleCode);
        return !!(p && (p.can_view === true || p.can_view === 1));
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [statRes, logRes, tasksRes, leadsRes] = await Promise.all([
                    api.get('/system/dashboard/stats'),
                    api.get('/system/logs?limit=5'),
                    api.get('/tasks').catch(() => ({ data: [] })),
                    api.get('/customers').catch(() => ({ data: [] }))
                ]);
                setStats(statRes.data);
                setRecentLogs(logRes.data || []);

                // Filter tasks assigned to current user
                const allTasks = tasksRes.data || [];
                const userId = user?.id;
                const filtered = allTasks.filter((t: any) =>
                    t.status !== 'DONE' && (t.assigned_to_id === userId || t.assigned_to?.id === userId)
                );
                setMyTasks(filtered.slice(0, 5));

                // Filter incomplete leads (LEADs not yet CUSTOMER)
                const allCustomers = leadsRes.data || [];
                const leads = allCustomers.filter((c: any) =>
                    c.type === 'LEAD' && (!c.orders || c.orders.length === 0 || c.orders.every((o: any) => o.status === 'QUOTATION'))
                );
                setIncompleteLeads(leads.slice(0, 5));

            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // --- HELPER: Priority Color ---
    const getPriorityColor = (priority: string) => {
        switch (priority?.toUpperCase()) {
            case 'HIGH': return '#ff4d4f';
            case 'MEDIUM': return '#faad14';
            default: return '#52c41a';
        }
    };

    const getStatusTag = (status: string) => {
        const map: any = {
            'TODO': { color: 'default', text: 'Chờ làm' },
            'IN_PROGRESS': { color: 'processing', text: 'Đang làm' },
            'DONE': { color: 'success', text: 'Hoàn thành' }
        };
        const s = map[status] || { color: 'default', text: status };
        return <Tag color={s.color}>{s.text}</Tag>;
    };

    // --- QUICK WIDGETS ---
    const QuickAction: React.FC<{ title: string, icon: any, color: string, onClick: () => void }> = ({ title, icon, color, onClick }) => (
        <Card
            hoverable
            style={{
                textAlign: 'center',
                height: '100%',
                borderRadius: 12,
                border: 'none',
                background: `linear-gradient(135deg, ${color}15, ${color}05)`
            }}
            bodyStyle={{ padding: 16 }}
            onClick={onClick}
        >
            <div style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: `linear-gradient(135deg, ${color}, ${color}99)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
                fontSize: 22,
                color: 'white'
            }}>
                {icon}
            </div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{title}</div>
        </Card>
    );

    // --- TASK CARD ---
    const TaskCard = ({ task }: { task: any }) => (
        <div
            style={{
                padding: '12px 16px',
                background: '#fafafa',
                borderRadius: 10,
                marginBottom: 10,
                borderLeft: `4px solid ${getPriorityColor(task.priority)}`,
                cursor: 'pointer',
                transition: 'all 0.2s'
            }}
            onClick={() => navigate('/tasks')}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong style={{ fontSize: 14 }}>{task.title}</Text>
                {getStatusTag(task.status)}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                    <ClockCircleOutlined /> {task.due_date ? dayjs(task.due_date).format('DD/MM') : 'Không hạn'}
                </Text>
                {task.sales_order && (
                    <Tag color="blue" style={{ fontSize: 11 }}>#{task.sales_order.order_code}</Tag>
                )}
            </div>
        </div>
    );

    // --- LEAD CARD ---
    const LeadCard = ({ lead }: { lead: any }) => (
        <div
            style={{
                padding: '12px 16px',
                background: 'linear-gradient(135deg, #fff7e6, #fffbe6)',
                borderRadius: 10,
                marginBottom: 10,
                cursor: 'pointer',
                transition: 'all 0.2s',
                border: '1px solid #ffe58f'
            }}
            onClick={() => {
                setSelectedLeadId(lead.id);
                setLeadCareOpen(true);
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar style={{ background: 'linear-gradient(135deg, #fa8c16, #faad14)' }} icon={<UserOutlined />} />
                    <div>
                        <Text strong style={{ fontSize: 14 }}>{lead.name}</Text>
                        <div style={{ fontSize: 11, color: '#999' }}>
                            {lead.contacts?.[0]?.full_name || lead.phone || 'Chưa có liên hệ'}
                        </div>
                    </div>
                </div>
                <Tag color="orange">Tiềm năng</Tag>
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                {lead.phone && (
                    <Tooltip title="Gọi điện">
                        <Button size="small" type="text" icon={<PhoneOutlined />} style={{ fontSize: 11 }}>
                            ***{lead.phone.slice(-3)}
                        </Button>
                    </Tooltip>
                )}
                <Tooltip title="Chăm sóc">
                    <Button size="small" type="text" icon={<MessageOutlined />} style={{ fontSize: 11 }}>
                        Liên hệ
                    </Button>
                </Tooltip>
            </div>
        </div>
    );

    return (
        <div style={{ padding: '0 0 24px' }}>
            {/* HEADER */}
            <Row gutter={16} align="middle" style={{ marginBottom: 24 }}>
                <Col flex="auto">
                    <Title level={3} style={{ margin: 0, background: 'linear-gradient(135deg, #1890ff, #722ed1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        👋 Xin chào, {user?.full_name || 'User'}!
                    </Title>
                    <Text type="secondary">
                        <ClockCircleOutlined /> {dayjs().format('dddd, DD/MM/YYYY')}
                    </Text>
                </Col>
                <Col>
                    {hasPerm('SALES') && (
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => navigate('/sales/pos')}
                            style={{ borderRadius: 8, background: 'linear-gradient(135deg, #1890ff, #722ed1)' }}
                        >
                            Bán hàng nhanh
                        </Button>
                    )}
                </Col>
            </Row>

            <Skeleton loading={loading} active>
                {/* 1. STATS GRID */}
                <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                    {hasPerm('SALES') && (
                        <>
                            <Col xs={24} sm={12} md={6}>
                                <Card
                                    size="small"
                                    style={{ borderRadius: 12, background: 'linear-gradient(135deg, #e6f7ff, #bae7ff)', border: 'none' }}
                                >
                                    <Statistic
                                        title={<span style={{ fontWeight: 600, color: '#0050b3' }}>Đơn hàng hôm nay</span>}
                                        value={stats?.sales?.ordersToday || 0}
                                        prefix={<ShoppingCartOutlined style={{ color: '#1890ff' }} />}
                                        valueStyle={{ color: '#0050b3' }}
                                    />
                                </Card>
                            </Col>
                            <Col xs={24} sm={12} md={6}>
                                <Card
                                    size="small"
                                    style={{ borderRadius: 12, background: 'linear-gradient(135deg, #f6ffed, #d9f7be)', border: 'none' }}
                                >
                                    <Statistic
                                        title={<span style={{ fontWeight: 600, color: '#237804' }}>Doanh thu tháng này</span>}
                                        value={stats?.sales?.revenueMonth || 0}
                                        prefix={<DollarOutlined style={{ color: '#52c41a' }} />}
                                        formatter={(val) => Number(val).toLocaleString()}
                                        suffix="₫"
                                        valueStyle={{ color: '#237804' }}
                                    />
                                </Card>
                            </Col>
                        </>
                    )}

                    {hasPerm('INVENTORY') && (
                        <>
                            <Col xs={24} sm={12} md={6}>
                                <Card
                                    size="small"
                                    style={{ borderRadius: 12, background: 'linear-gradient(135deg, #fff1f0, #ffccc7)', border: 'none' }}
                                >
                                    <Statistic
                                        title={<span style={{ fontWeight: 600, color: '#a8071a' }}>Cảnh báo tồn kho</span>}
                                        value={stats?.inventory?.lowStockItems || 0}
                                        valueStyle={{ color: '#cf1322' }}
                                        prefix={<AlertOutlined />}
                                    />
                                </Card>
                            </Col>
                            <Col xs={24} sm={12} md={6}>
                                <Card
                                    size="small"
                                    style={{ borderRadius: 12, background: 'linear-gradient(135deg, #fffbe6, #ffe58f)', border: 'none' }}
                                >
                                    <Statistic
                                        title={<span style={{ fontWeight: 600, color: '#ad6800' }}>Phiếu nhập chờ duyệt</span>}
                                        value={stats?.inventory?.pendingReceipts || 0}
                                        prefix={<DropboxOutlined style={{ color: '#faad14' }} />}
                                        valueStyle={{ color: '#ad6800' }}
                                    />
                                </Card>
                            </Col>
                        </>
                    )}
                </Row>

                {/* 2. MY TASKS & LEADS */}
                <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
                    {/* MY TASKS */}
                    <Col xs={24} md={12}>
                        <Card
                            title={
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <CheckSquareOutlined style={{ color: '#722ed1' }} />
                                    <span>Công việc của tôi</span>
                                    <Badge count={myTasks.length} style={{ background: '#722ed1' }} />
                                </div>
                            }
                            bordered={false}
                            style={{ borderRadius: 16, height: '100%', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
                            extra={<Button type="link" onClick={() => navigate('/tasks')}>Xem tất cả <RightOutlined /></Button>}
                        >
                            {myTasks.length > 0 ? (
                                myTasks.map((task) => <TaskCard key={task.id} task={task} />)
                            ) : (
                                <Empty description="Không có công việc đang chờ" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                            )}
                        </Card>
                    </Col>

                    {/* INCOMPLETE LEADS */}
                    <Col xs={24} md={12}>
                        <Card
                            title={
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <FireOutlined style={{ color: '#fa8c16' }} />
                                    <span>Leads cần chăm sóc</span>
                                    <Badge count={incompleteLeads.length} style={{ background: '#fa8c16' }} />
                                </div>
                            }
                            bordered={false}
                            style={{ borderRadius: 16, height: '100%', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
                            extra={<Button type="link" onClick={() => navigate('/customers')}>Xem tất cả <RightOutlined /></Button>}
                        >
                            {incompleteLeads.length > 0 ? (
                                incompleteLeads.map((lead) => <LeadCard key={lead.id} lead={lead} />)
                            ) : (
                                <Empty description="Không có lead cần chăm sóc" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                            )}
                        </Card>
                    </Col>
                </Row>

                {/* 3. QUICK ACTIONS & ACTIVITY */}
                <Row gutter={[24, 24]}>
                    <Col xs={24} md={16}>
                        <Card
                            title={<span><ShopOutlined style={{ color: '#1890ff' }} /> Truy cập nhanh</span>}
                            bordered={false}
                            style={{ borderRadius: 16, height: '100%', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
                        >
                            <Row gutter={[16, 16]}>
                                {hasPerm('SALES') && (
                                    <>
                                        <Col span={6}><QuickAction title="Tạo Báo Giá" icon={<FileTextOutlined />} color="#1890ff" onClick={() => navigate('/sales')} /></Col>
                                        <Col span={6}><QuickAction title="Đơn Hàng (SO)" icon={<ShoppingCartOutlined />} color="#722ed1" onClick={() => navigate('/orders')} /></Col>
                                        <Col span={6}><QuickAction title="Khách Hàng" icon={<UserOutlined />} color="#13c2c2" onClick={() => navigate('/customers')} /></Col>
                                    </>
                                )}
                                {hasPerm('INVENTORY') && (
                                    <Col span={6}><QuickAction title="Kiểm Kho" icon={<DropboxOutlined />} color="#faad14" onClick={() => navigate('/inventory')} /></Col>
                                )}
                                {hasPerm('PRODUCT') && (
                                    <Col span={6}><QuickAction title="Sản Phẩm" icon={<ShopOutlined />} color="#eb2f96" onClick={() => navigate('/products')} /></Col>
                                )}
                                {hasPerm('PRODUCTION') && (
                                    <Col span={6}><QuickAction title="Lệnh Sản Xuất" icon={<ExperimentOutlined />} color="#fa541c" onClick={() => navigate('/planning')} /></Col>
                                )}
                                <Col span={6}><QuickAction title="Hồ Sơ Cá Nhân" icon={<IdcardOutlined />} color="#52c41a" onClick={() => navigate('/profile')} /></Col>
                            </Row>
                        </Card>
                    </Col>

                    <Col xs={24} md={8}>
                        <Card
                            title={<span><ClockCircleOutlined style={{ color: '#52c41a' }} /> Hoạt động gần đây</span>}
                            bordered={false}
                            style={{ borderRadius: 16, height: '100%', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
                            extra={<a onClick={() => navigate('/system/logs')}>Xem tất cả</a>}
                        >
                            <List
                                itemLayout="horizontal"
                                dataSource={recentLogs}
                                locale={{ emptyText: 'Chưa có hoạt động' }}
                                renderItem={(item: any) => (
                                    <List.Item style={{ padding: '8px 0' }}>
                                        <List.Item.Meta
                                            avatar={<Avatar style={{ background: 'linear-gradient(135deg, #87d068, #52c41a)' }} icon={<CheckCircleOutlined />} size="small" />}
                                            title={<Text style={{ fontSize: 12 }}>{item.action_type}</Text>}
                                            description={
                                                <div>
                                                    <div style={{ fontSize: 11, color: '#666' }}>{item.description?.slice(0, 40)}...</div>
                                                    <div style={{ fontSize: 10, color: '#999' }}>{dayjs(item.created_at).fromNow()}</div>
                                                </div>
                                            }
                                        />
                                    </List.Item>
                                )}
                            />
                        </Card>
                    </Col>
                </Row>
            </Skeleton>

            {/* Lead Care Modal */}
            <LeadCareModal
                visible={leadCareOpen}
                onClose={() => {
                    setLeadCareOpen(false);
                    setSelectedLeadId(null);
                }}
                initialCustomerId={selectedLeadId || undefined}
            />
        </div>
    );
};

export default DashboardPage;
