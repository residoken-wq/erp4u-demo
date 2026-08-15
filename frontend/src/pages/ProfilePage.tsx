import React, { useState, useEffect } from 'react';
import {
    Card, Tabs, Row, Col, Button, Table, Tag, Statistic, Space, Empty,
    Form, Input, DatePicker, message, Divider, Timeline, Descriptions, Avatar, InputNumber, Checkbox,
    Grid
} from 'antd';
import {
    UserOutlined, ClockCircleOutlined, CalendarOutlined, DollarOutlined,
    LoginOutlined, LogoutOutlined, CheckCircleOutlined, CloseCircleOutlined,
    ManOutlined, WomanOutlined, BankOutlined, GiftOutlined, CarOutlined,
    CoffeeOutlined, PhoneOutlined, SafetyCertificateOutlined, PrinterOutlined,
    WalletOutlined, RiseOutlined, FallOutlined, FormOutlined
} from '@ant-design/icons';
import api from '../utils/api';
import dayjs from 'dayjs';
import EmployeeReviewTab from '../components/hr/EmployeeReviewTab';

const { TabPane } = Tabs;
const { TextArea } = Input;

const ProfilePage: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [employee, setEmployee] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [attendances, setAttendances] = useState<any[]>([]);
    const [leaves, setLeaves] = useState<any[]>([]);
    const [payslips, setPayslips] = useState<any[]>([]);
    const [assets, setAssets] = useState<any[]>([]);
    const [leaveForm] = Form.useForm();
    const [viewPayslip, setViewPayslip] = useState<any>(null);
    const [isHalfDay, setIsHalfDay] = useState(false);
    const [computedDays, setComputedDays] = useState<number>(1);

    const screens = Grid.useBreakpoint();
    const isMobile = !screens.md;
    const [activeTab, setActiveTab] = useState('attendance');

    useEffect(() => {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            const user = JSON.parse(userStr);
            setCurrentUser(user);
            loadEmployeeData(user.id);
        }
    }, []);

    const [leaveBalance, setLeaveBalance] = useState<any>(null);

    const loadEmployeeData = async (userId: number) => {
        setLoading(true);
        try {
            const empRes = await api.get(`/hr/employees/by-user/${userId}`);
            const emp = empRes.data;
            setEmployee(emp);

            if (emp) {
                const [attRes, leaveRes, payRes, assetRes, balRes] = await Promise.all([
                    api.get(`/hr/attendances?employee_id=${emp.id}`),
                    api.get('/hr/leaves'),
                    api.get(`/hr/payslips?employee_id=${emp.id}`),
                    api.get(`/hr/assets?employee_id=${emp.id}`),
                    api.get(`/hr/balance/${emp.id}?year=${new Date().getFullYear()}`).catch(() => ({ data: null })),
                ]);
                setAttendances(attRes.data || []);
                const myLeaves = (leaveRes.data || []).filter((l: any) => l.employee_id === emp.id);
                setLeaves(myLeaves);
                setPayslips(payRes.data || []);
                setAssets(assetRes.data || []);

                if (balRes.data) {
                    setLeaveBalance(balRes.data);
                } else {
                    const currentYear = new Date().getFullYear();
                    const approvedLeaves = myLeaves.filter((l: any) =>
                        l.status === 'APPROVED' && new Date(l.start_date).getFullYear() === currentYear
                    );
                    const usedDays = approvedLeaves.reduce((sum: number, l: any) => sum + Number(l.days || 0), 0);
                    const defaultAnnual = 12;
                    setLeaveBalance({
                        year: currentYear,
                        annual_days: defaultAnnual,
                        carried_days: 0,
                        total_days: defaultAnnual,
                        used_days: usedDays,
                        remaining_days: defaultAnnual - usedDays,
                    });
                }
            }
        } catch (e) {
            console.error('Error loading employee data:', e);
        }
        setLoading(false);
    };

    const handleCheckIn = async () => {
        if (!employee) return;
        try {
            await api.post('/hr/check-in', { employee_id: employee.id });
            message.success('Check-in thành công!');
            loadEmployeeData(currentUser.id);
        } catch (e) { message.error('Lỗi check-in'); }
    };

    const handleCheckOut = async () => {
        if (!employee) return;
        try {
            await api.post('/hr/check-out', { employee_id: employee.id });
            message.success('Check-out thành công!');
            loadEmployeeData(currentUser.id);
        } catch (e) { message.error('Lỗi check-out'); }
    };

    const handleRequestLeave = async (values: any) => {
        if (!employee) return;
        try {
            await api.post('/hr/leaves', {
                employee_id: employee.id,
                leave_type: 'ANNUAL',
                start_date: values.start_date.format('YYYY-MM-DD'),
                end_date: values.end_date.format('YYYY-MM-DD'),
                reason: values.reason,
                days: Number(values.days || computedDays),
            });
            message.success('Đã gửi đơn nghỉ phép');
            leaveForm.resetFields();
            setIsHalfDay(false);
            setComputedDays(1);
            loadEmployeeData(currentUser.id);
        } catch (e) { message.error('Lỗi gửi đơn'); }
    };

    const formatMoney = (v: any) => {
        const num = Number(v) || 0;
        return num.toLocaleString('vi-VN');
    };

    if (loading) return <Card loading />;

    if (!employee) {
        return (
            <Card>
                <Empty description={<span>Tài khoản của bạn chưa được liên kết với hồ sơ nhân viên.<br />Vui lòng liên hệ Admin để được hỗ trợ.</span>} />
            </Card>
        );
    }

    // Get ALL attendance records for today (supports multiple shifts per day)
    const todayAttendances = attendances.filter(a =>
        dayjs(a.date).format('YYYY-MM-DD') === dayjs().format('YYYY-MM-DD')
    );
    // The latest shift record determines current check-in/out state
    // attendances are ordered by date DESC, check_in DESC from backend
    const todayAttendance = todayAttendances.length > 0 ? todayAttendances[0] : undefined;
    // Can check-in if: no record today, OR latest record already has check_out (shift completed)
    const canCheckIn = !todayAttendance || !!todayAttendance.check_out;
    // Can check-out if: latest record has check_in but no check_out (currently in a shift)
    const canCheckOut = !!todayAttendance?.check_in && !todayAttendance?.check_out;

    return (
        <div style={{ padding: isMobile ? '12px 8px' : 24, paddingBottom: isMobile ? 80 : 24 }}>
            <Card style={{ borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <Row gutter={isMobile ? [0, 16] : 24} align="middle">
                    <Col xs={24} md={6} style={{ textAlign: 'center' }}>
                        <Avatar
                            size={100}
                            icon={employee.gender === 'FEMALE' ? <WomanOutlined /> : <ManOutlined />}
                            style={{ backgroundColor: employee.gender === 'FEMALE' ? '#eb2f96' : '#1890ff' }}
                        />
                        <h2 style={{ marginTop: 16, marginBottom: 4 }}>{employee.full_name}</h2>
                        <Tag color="blue">{employee.position || 'Nhân viên'}</Tag>
                        <p style={{ color: '#888' }}>{employee.department}</p>
                    </Col>
                    <Col xs={24} md={18}>
                        <Descriptions bordered size="small" column={{ xs: 1, md: 2 }}>
                            <Descriptions.Item label="Email">{currentUser?.email || '-'}</Descriptions.Item>
                            <Descriptions.Item label="SĐT">{employee.phone || '-'}</Descriptions.Item>
                            <Descriptions.Item label="Ngày sinh">{employee.date_of_birth ? dayjs(employee.date_of_birth).format('DD/MM/YYYY') : '-'}</Descriptions.Item>
                            <Descriptions.Item label="Ngày vào làm">{employee.hire_date ? dayjs(employee.hire_date).format('DD/MM/YYYY') : '-'}</Descriptions.Item>
                            <Descriptions.Item label="Địa chỉ" span={2}>{employee.address || '-'}</Descriptions.Item>
                        </Descriptions>
                    </Col>
                </Row>
            </Card>

            <Card style={{ marginTop: 16, borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }} bodyStyle={{ padding: isMobile ? 12 : 24 }}>
                <Tabs 
                    activeKey={activeTab} 
                    onChange={setActiveTab}
                    renderTabBar={isMobile ? () => <></> : undefined}
                >
                    <TabPane tab={<><ClockCircleOutlined /> Chấm công</>} key="attendance">
                        <Row gutter={24}>
                            <Col xs={24} md={10}>
                                <div style={{
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    borderRadius: 16,
                                    padding: 24,
                                    color: '#fff',
                                    marginBottom: 16,
                                    boxShadow: '0 4px 20px rgba(102, 126, 234, 0.3)'
                                }}>
                                    <div style={{ fontSize: 14, opacity: 0.85, marginBottom: 4 }}>
                                        <CalendarOutlined /> HÔM NAY
                                    </div>
                                    <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 16 }}>
                                        {dayjs().format('DD/MM/YYYY')}
                                    </div>
                                    <div style={{ fontSize: 13, opacity: 0.9 }}>
                                        {dayjs().format('dddd').charAt(0).toUpperCase() + dayjs().format('dddd').slice(1)}
                                    </div>
                                </div>

                                <div style={{
                                    background: '#fff',
                                    borderRadius: 16,
                                    padding: isMobile ? 16 : 20,
                                    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                                    marginBottom: 16
                                }}>
                                    <Row gutter={16}>
                                        <Col span={12}>
                                            <div style={{
                                                background: todayAttendance?.check_in ? '#f6ffed' : '#f5f5f5',
                                                borderRadius: 12,
                                                padding: 16,
                                                textAlign: 'center'
                                            }}>
                                                <LoginOutlined style={{ fontSize: 24, color: todayAttendance?.check_in ? '#52c41a' : '#999' }} />
                                                <div style={{ fontSize: 12, color: '#666', marginTop: 8 }}>Check-in</div>
                                                <div style={{ fontSize: 20, fontWeight: 600, color: todayAttendance?.check_in ? '#52c41a' : '#999' }}>
                                                    {todayAttendance?.check_in ? dayjs(todayAttendance.check_in).format('HH:mm') : '--:--'}
                                                </div>
                                            </div>
                                        </Col>
                                        <Col span={12}>
                                            <div style={{
                                                background: todayAttendance?.check_out ? '#fff7e6' : '#f5f5f5',
                                                borderRadius: 12,
                                                padding: 16,
                                                textAlign: 'center'
                                            }}>
                                                <LogoutOutlined style={{ fontSize: 24, color: todayAttendance?.check_out ? '#fa8c16' : '#999' }} />
                                                <div style={{ fontSize: 12, color: '#666', marginTop: 8 }}>Check-out</div>
                                                <div style={{ fontSize: 20, fontWeight: 600, color: todayAttendance?.check_out ? '#fa8c16' : '#999' }}>
                                                    {todayAttendance?.check_out ? dayjs(todayAttendance.check_out).format('HH:mm') : '--:--'}
                                                </div>
                                            </div>
                                        </Col>
                                    </Row>

                                    {todayAttendances.length > 0 && (
                                        <div style={{ textAlign: 'center', marginTop: 16 }}>
                                            <Tag
                                                color={todayAttendance?.status === 'PRESENT' ? 'green' : 'orange'}
                                                style={{ fontSize: 13, padding: '4px 16px' }}
                                            >
                                                {todayAttendance?.status === 'PRESENT' ? '✓ Có mặt' : todayAttendance?.status}
                                            </Tag>
                                            {todayAttendances.length > 1 && (
                                                <Tag color="blue" style={{ fontSize: 13, padding: '4px 12px', marginLeft: 4 }}>
                                                    Ca {todayAttendances.length}
                                                </Tag>
                                            )}
                                        </div>
                                    )}

                                    <Divider style={{ margin: '20px 0 16px' }} />

                                    <Row gutter={12}>
                                        <Col span={12}>
                                            <Button
                                                type="primary"
                                                icon={<LoginOutlined />}
                                                onClick={handleCheckIn}
                                                disabled={!canCheckIn}
                                                block
                                                size="large"
                                                style={{
                                                    borderRadius: 10,
                                                    height: 48,
                                                    background: !canCheckIn ? undefined : 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
                                                    border: 'none'
                                                }}
                                            >
                                                CHECK IN
                                            </Button>
                                        </Col>
                                        <Col span={12}>
                                            <Button
                                                icon={<LogoutOutlined />}
                                                onClick={handleCheckOut}
                                                disabled={!canCheckOut}
                                                block
                                                size="large"
                                                style={{
                                                    borderRadius: 10,
                                                    height: 48,
                                                    background: !canCheckOut ? undefined : '#fa8c16',
                                                    borderColor: !canCheckOut ? undefined : '#fa8c16',
                                                    color: !canCheckOut ? undefined : '#fff'
                                                }}
                                            >
                                                CHECK OUT
                                            </Button>
                                        </Col>
                                    </Row>
                                </div>
                            </Col>

                            <Col xs={24} md={14}>
                                <div style={{
                                    background: '#fff',
                                    borderRadius: 16,
                                    padding: isMobile ? 12 : 20,
                                    boxShadow: '0 2px 12px rgba(0,0,0,0.06)'
                                }}>
                                    <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <ClockCircleOutlined style={{ color: '#1890ff' }} /> Lịch sử chấm công
                                    </div>
                                    <Table
                                        dataSource={attendances.slice(0, 10)}
                                        columns={[
                                            {
                                                title: 'Ngày',
                                                dataIndex: 'date',
                                                render: (d: string) => (
                                                    <span style={{ fontWeight: 500 }}>{dayjs(d).format('DD/MM')}</span>
                                                )
                                            },
                                            {
                                                title: 'Vào',
                                                dataIndex: 'check_in',
                                                render: (d: string) => (
                                                    <span style={{ color: d ? '#52c41a' : '#999' }}>
                                                        {d ? dayjs(d).format('HH:mm') : '-'}
                                                    </span>
                                                )
                                            },
                                            {
                                                title: 'Ra',
                                                dataIndex: 'check_out',
                                                render: (d: string) => (
                                                    <span style={{ color: d ? '#fa8c16' : '#999' }}>
                                                        {d ? dayjs(d).format('HH:mm') : '-'}
                                                    </span>
                                                )
                                            },
                                            {
                                                title: 'Giờ',
                                                dataIndex: 'work_hours',
                                                render: (h: number) => (
                                                    <Tag color={h >= 8 ? 'green' : h > 0 ? 'orange' : 'default'}>
                                                        {h ? `${h}h` : '-'}
                                                    </Tag>
                                                )
                                            },
                                            {
                                                title: '',
                                                dataIndex: 'status',
                                                render: (s: string) => (
                                                    s === 'PRESENT' ?
                                                        <CheckCircleOutlined style={{ color: '#52c41a' }} /> :
                                                        <CloseCircleOutlined style={{ color: '#faad14' }} />
                                                )
                                            },
                                        ]}
                                        rowKey="id"
                                        size="small"
                                        pagination={false}
                                        scroll={{ x: 'max-content' }}
                                    />
                                </div>
                            </Col>
                        </Row>
                    </TabPane>

                    <TabPane tab={<><CalendarOutlined /> Nghỉ phép</>} key="leave">
                        {leaveBalance && (
                            <div style={{
                                background: 'linear-gradient(135deg, #13c2c2 0%, #08979c 100%)',
                                borderRadius: 16,
                                padding: 24,
                                color: '#fff',
                                marginBottom: 24,
                                boxShadow: '0 4px 20px rgba(19, 194, 194, 0.3)'
                            }}>
                                <Row gutter={24} style={{ marginBottom: 20 }}>
                                    <Col span={8}>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: isMobile ? 10 : 12, opacity: 0.85, marginBottom: 4 }}>📋 TỔNG PHÉP</div>
                                            <div style={{ fontSize: isMobile ? 24 : 36, fontWeight: 700 }}>
                                                {(Number(leaveBalance.annual_days) || 0) + (Number(leaveBalance.carried_days) || 0)}
                                            </div>
                                            <div style={{ fontSize: isMobile ? 10 : 12, opacity: 0.7 }}>(năm {leaveBalance.year})</div>
                                        </div>
                                    </Col>
                                    <Col span={8}>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: isMobile ? 10 : 12, opacity: 0.85, marginBottom: 4 }}>✅ ĐÃ NGHỈ</div>
                                            <div style={{ fontSize: isMobile ? 24 : 36, fontWeight: 700, color: '#ffe58f' }}>
                                                {Number(leaveBalance.used_days) || 0}
                                            </div>
                                            <div style={{ fontSize: isMobile ? 10 : 12, opacity: 0.7 }}>ngày</div>
                                        </div>
                                    </Col>
                                    <Col span={8}>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: isMobile ? 10 : 12, opacity: 0.85, marginBottom: 4 }}>🎯 CÒN LẠI</div>
                                            <div style={{ fontSize: isMobile ? 24 : 36, fontWeight: 700, color: '#b7eb8f' }}>
                                                {Number(leaveBalance.remaining_days) || 0}
                                            </div>
                                            <div style={{ fontSize: isMobile ? 10 : 12, opacity: 0.7 }}>ngày</div>
                                        </div>
                                    </Col>
                                </Row>

                                <div style={{ marginBottom: 16 }}>
                                    <div style={{ background: 'rgba(255,255,255,0.3)', borderRadius: 8, height: 10, position: 'relative' }}>
                                        <div style={{
                                            background: '#ffe58f',
                                            borderRadius: 8,
                                            height: 10,
                                            width: `${Math.min(100, (Number(leaveBalance.used_days) / ((Number(leaveBalance.annual_days) || 0) + (Number(leaveBalance.carried_days) || 0))) * 100)}%`,
                                            transition: 'width 0.5s ease'
                                        }} />
                                    </div>
                                </div>

                                <Row gutter={12}>
                                    <Col span={8}>
                                        <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: isMobile ? '8px 4px' : '10px 12px', textAlign: 'center' }}>
                                            <div style={{ fontSize: isMobile ? 14 : 18, fontWeight: 600 }}>{leaveBalance.annual_days}</div>
                                            <div style={{ fontSize: isMobile ? 9 : 11, opacity: 0.85 }}>Phép năm nay</div>
                                        </div>
                                    </Col>
                                    <Col span={8}>
                                        <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: isMobile ? '8px 4px' : '10px 12px', textAlign: 'center' }}>
                                            <div style={{ fontSize: isMobile ? 14 : 18, fontWeight: 600 }}>{leaveBalance.carried_days}</div>
                                            <div style={{ fontSize: isMobile ? 9 : 11, opacity: 0.85 }}>Tồn năm trước</div>
                                        </div>
                                    </Col>
                                    <Col span={8}>
                                        <div style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 10, padding: isMobile ? '8px 4px' : '10px 12px', textAlign: 'center' }}>
                                            <div style={{ fontSize: isMobile ? 14 : 18, fontWeight: 600 }}>{leaveBalance.remaining_days}</div>
                                            <div style={{ fontSize: isMobile ? 9 : 11, opacity: 0.85 }}>Còn lại ✓</div>
                                        </div>
                                    </Col>
                                </Row>
                            </div>
                        )}

                        <Row gutter={24}>
                            <Col xs={24} md={10}>
                                <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                                    <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <CalendarOutlined style={{ color: '#13c2c2' }} /> Đăng ký nghỉ phép
                                    </div>
                                    <Form form={leaveForm} layout="vertical" onFinish={handleRequestLeave}>
                                        <Row gutter={16}>
                                            <Col span={12}>
                                                <Form.Item name="start_date" label="Từ ngày" rules={[{ required: true }]}>
                                                    <DatePicker style={{ width: '100%', borderRadius: 8 }} format="DD/MM/YYYY" />
                                                </Form.Item>
                                            </Col>
                                            <Col span={12}>
                                                <Form.Item name="end_date" label="Đến ngày" rules={[{ required: true }]}>
                                                    <DatePicker style={{ width: '100%', borderRadius: 8 }} format="DD/MM/YYYY" />
                                                </Form.Item>
                                            </Col>
                                        </Row>
                                        <Form.Item name="reason" label="Lý do">
                                            <TextArea rows={3} style={{ borderRadius: 8 }} />
                                        </Form.Item>
                                        <Button type="primary" htmlType="submit" block size="large" style={{ borderRadius: 10, height: 48, background: 'linear-gradient(135deg, #13c2c2 0%, #08979c 100%)', border: 'none' }}>
                                            Gửi đơn nghỉ phép
                                        </Button>
                                    </Form>
                                </div>
                            </Col>

                            <Col xs={24} md={14}>
                                <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                                    <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <ClockCircleOutlined style={{ color: '#1890ff' }} /> Lịch sử đơn nghỉ phép
                                    </div>
                                    <Table
                                        dataSource={leaves}
                                        columns={[
                                            { title: 'Từ', dataIndex: 'start_date', render: (d: string) => dayjs(d).format('DD/MM') },
                                            { title: 'Đến', dataIndex: 'end_date', render: (d: string) => dayjs(d).format('DD/MM') },
                                            { title: 'Ngày', dataIndex: 'days' },
                                            { title: 'Trạng thái', dataIndex: 'status', render: (s: string) => <Tag color={s === 'APPROVED' ? 'green' : 'orange'}>{s}</Tag> }
                                        ]}
                                        rowKey="id"
                                        size="small"
                                        pagination={{ pageSize: 5 }}
                                        scroll={{ x: 'max-content' }}
                                    />
                                </div>
                            </Col>
                        </Row>
                    </TabPane>

                    <TabPane tab={<><DollarOutlined /> Bảng lương</>} key="payslip">
                        <Table
                            dataSource={payslips}
                            columns={[
                                { title: 'Tháng', render: (_: any, r: any) => `${r.month}/${r.year}` },
                                { title: 'Tổng thu', dataIndex: 'gross_income', render: (v: number) => formatMoney(v) },
                                { title: 'Thực nhận', dataIndex: 'net_salary', render: (v: number) => <b style={{ color: 'green' }}>{formatMoney(v)}</b> },
                                { title: '', render: (_: any, r: any) => <Button size="small" onClick={() => setViewPayslip(r)}>Xem</Button> }
                            ]}
                            rowKey="id"
                            size="small"
                            scroll={{ x: 'max-content' }}
                        />
                        {viewPayslip && (
                            <Card 
                                style={{ marginTop: 16, borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }} 
                                title={`Chi tiết lương ${viewPayslip.month}/${viewPayslip.year}`}
                                extra={<Button type="text" danger icon={<CloseCircleOutlined />} onClick={() => setViewPayslip(null)}>Đóng</Button>}
                            >
                                <Descriptions bordered size="small" column={{ xs: 1, sm: 2, md: 2 }}>
                                    <Descriptions.Item label="Lương cơ bản">{formatMoney(viewPayslip.base_salary)}</Descriptions.Item>
                                    <Descriptions.Item label="Lương thực tế">{formatMoney(viewPayslip.actual_salary)}</Descriptions.Item>
                                    
                                    <Descriptions.Item label="Ngày công chuẩn">{viewPayslip.standard_work_days}</Descriptions.Item>
                                    <Descriptions.Item label="Ngày công thực tế">{viewPayslip.actual_work_days}</Descriptions.Item>
                                    
                                    <Descriptions.Item label="Phụ cấp ăn trưa">{formatMoney(viewPayslip.allowance_meal)}</Descriptions.Item>
                                    <Descriptions.Item label="Phụ cấp đi lại">{formatMoney(viewPayslip.allowance_transport)}</Descriptions.Item>
                                    
                                    <Descriptions.Item label="Phụ cấp điện thoại">{formatMoney(viewPayslip.allowance_phone)}</Descriptions.Item>
                                    <Descriptions.Item label="Thưởng">{formatMoney(viewPayslip.bonus)}</Descriptions.Item>
                                    
                                    <Descriptions.Item label={<span style={{ fontWeight: 600 }}>Tổng thu nhập</span>}>
                                        <span style={{ fontWeight: 600, color: '#1890ff' }}>{formatMoney(viewPayslip.gross_income)}</span>
                                    </Descriptions.Item>
                                    <Descriptions.Item label="Ghi chú">{viewPayslip.note || '-'}</Descriptions.Item>
                                    
                                    <Descriptions.Item label="BHXH (8%)" style={{ color: '#cf1322' }}>-{formatMoney(viewPayslip.bhxh_employee)}</Descriptions.Item>
                                    <Descriptions.Item label="BHYT (1.5%)" style={{ color: '#cf1322' }}>-{formatMoney(viewPayslip.bhyt_employee)}</Descriptions.Item>
                                    
                                    <Descriptions.Item label="BHTN (1%)" style={{ color: '#cf1322' }}>-{formatMoney(viewPayslip.bhtn_employee)}</Descriptions.Item>
                                    <Descriptions.Item label="Công đoàn" style={{ color: '#cf1322' }}>-{formatMoney(viewPayslip.union_fee)}</Descriptions.Item>
                                    
                                    <Descriptions.Item label="Thuế TNCN" style={{ color: '#cf1322' }}>-{formatMoney(viewPayslip.tax_income)}</Descriptions.Item>
                                    <Descriptions.Item label="Khấu trừ khác" style={{ color: '#cf1322' }}>-{formatMoney(viewPayslip.other_deductions)}</Descriptions.Item>

                                    <Descriptions.Item label={<span style={{ fontWeight: 'bold', fontSize: 16 }}>THỰC NHẬN</span>} span={{ xs: 1, sm: 2, md: 2 }}>
                                        <span style={{ fontWeight: 'bold', fontSize: 18, color: '#52c41a' }}>
                                            {formatMoney(viewPayslip.net_salary)} VNĐ
                                        </span>
                                    </Descriptions.Item>
                                </Descriptions>
                            </Card>
                        )}
                    </TabPane>

                    <TabPane tab="Tài sản" key="assets">
                        <Table
                            dataSource={assets}
                            columns={[
                                { title: 'Tên', dataIndex: 'asset_name' },
                                { title: 'Mã', dataIndex: 'asset_code' },
                                { title: 'Tình trạng', dataIndex: 'condition', render: (c: string) => <Tag>{c}</Tag> }
                            ]}
                            rowKey="id"
                            size="small"
                            scroll={{ x: 'max-content' }}
                        />
                    </TabPane>

                    <TabPane tab={<><FormOutlined /> Đánh giá</>} key="review360">
                        <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                            <EmployeeReviewTab employee={employee} />
                        </div>
                    </TabPane>
                </Tabs>
            </Card>

            {isMobile && (
                <div style={{
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 65,
                    background: '#fff',
                    boxShadow: '0 -2px 10px rgba(0,0,0,0.05)',
                    display: 'flex',
                    justifyContent: 'space-around',
                    alignItems: 'center',
                    zIndex: 1000,
                    paddingBottom: 'env(safe-area-inset-bottom)'
                }}>
                    {[
                        { key: 'attendance', icon: <ClockCircleOutlined />, label: 'Chấm công' },
                        { key: 'leave', icon: <CalendarOutlined />, label: 'Nghỉ phép' },
                        { key: 'payslip', icon: <DollarOutlined />, label: 'Lương' },
                        { key: 'assets', icon: <BankOutlined />, label: 'Tài sản' },
                        { key: 'review360', icon: <FormOutlined />, label: 'Đánh giá' },
                    ].map(item => {
                        const isActive = activeTab === item.key;
                        return (
                            <div 
                                key={item.key} 
                                onClick={() => setActiveTab(item.key)}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flex: 1,
                                    height: '100%',
                                    color: isActive ? '#1890ff' : '#888',
                                    cursor: 'pointer',
                                    paddingTop: 8,
                                    paddingBottom: 8
                                }}
                            >
                                <div style={{ fontSize: 20, marginBottom: 2 }}>{item.icon}</div>
                                <div style={{ fontSize: 10, fontWeight: isActive ? 600 : 400 }}>{item.label}</div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ProfilePage;
