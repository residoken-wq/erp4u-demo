import React, { useState, useEffect } from 'react';
import { Tabs, Card } from 'antd';
import {
    UserOutlined, ClockCircleOutlined, CalendarOutlined, GiftOutlined,
    DollarOutlined, ReadOutlined, TeamOutlined, ScheduleOutlined
} from '@ant-design/icons';
import api from '../utils/api';

// Import HR Components
import EmployeesTab from '../components/hr/EmployeesTab';
import AttendanceTab from '../components/hr/AttendanceTab';
import LeaveTab from '../components/hr/LeaveTab';
import AssetsTab from '../components/hr/AssetsTab';
import PayslipTab from '../components/hr/PayslipTab';
import TrainingTab from '../components/hr/TrainingTab';
import ShiftsTab from '../components/hr/ShiftsTab';
import RecruitmentTab from '../components/hr/RecruitmentTab';
import Review360Tab from '../components/hr/Review360Tab';

const { TabPane } = Tabs;

const HRPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState('employees');

    // Shared data states
    const [employees, setEmployees] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [shifts, setShifts] = useState<any[]>([]);
    const [attendances, setAttendances] = useState<any[]>([]);
    const [leaves, setLeaves] = useState<any[]>([]);
    const [assets, setAssets] = useState<any[]>([]);
    const [payslips, setPayslips] = useState<any[]>([]);
    const [trainings, setTrainings] = useState<any[]>([]);

    // Load core data on mount
    useEffect(() => {
        loadEmployees();
        loadUsers();
        loadShifts();
    }, []);

    // Load tab-specific data when tab changes
    useEffect(() => {
        if (activeTab === 'attendance') loadAttendances();
        if (activeTab === 'leave') loadLeaves();
        if (activeTab === 'assets') loadAssets();
        if (activeTab === 'payslip') loadPayslips();
        if (activeTab === 'training') loadTrainings();
    }, [activeTab]);

    const loadEmployees = async () => {
        try {
            const res = await api.get('/hr/employees');
            setEmployees(res.data);
        } catch (e) { console.error(e); }
    };

    const loadUsers = async () => {
        try {
            const res = await api.get('/users');
            setUsers(res.data);
        } catch (e) { console.error(e); }
    };

    const loadShifts = async () => {
        try {
            const res = await api.get('/hr/shifts');
            setShifts(res.data);
        } catch (e) { console.error(e); }
    };

    const loadAttendances = async () => {
        try {
            const res = await api.get('/hr/attendances');
            setAttendances(res.data);
        } catch (e) { console.error(e); }
    };

    const loadLeaves = async () => {
        try {
            const res = await api.get('/hr/leaves');
            setLeaves(res.data);
        } catch (e) { console.error(e); }
    };

    const loadAssets = async () => {
        try {
            const res = await api.get('/hr/assets');
            setAssets(res.data);
        } catch (e) { console.error(e); }
    };

    const loadPayslips = async () => {
        try {
            const res = await api.get('/hr/payslips');
            setPayslips(res.data);
        } catch (e) { console.error(e); }
    };

    const loadTrainings = async () => {
        try {
            const res = await api.get('/hr/trainings');
            setTrainings(res.data);
        } catch (e) { console.error(e); }
    };

    return (
        <div style={{ padding: '12px 8px' }}>
            <Card
                title={<><TeamOutlined /> Quản Lý Nhân Sự</>}
                size="small"
                bodyStyle={{ padding: '8px 0' }}
            >
                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    tabPosition="top"
                    size="small"
                    style={{ overflow: 'auto' }}
                    tabBarStyle={{ marginBottom: 8, paddingLeft: 8 }}
                >
                    <TabPane tab={<><UserOutlined /> <span className="hide-mobile">Nhân viên</span></>} key="employees">
                        <EmployeesTab employees={employees} users={users} shifts={shifts} onRefresh={loadEmployees} />
                    </TabPane>

                    <TabPane tab={<><ClockCircleOutlined /> <span className="hide-mobile">Chấm công</span></>} key="attendance">
                        <AttendanceTab employees={employees} attendances={attendances} onRefresh={loadAttendances} />
                    </TabPane>

                    <TabPane tab={<><CalendarOutlined /> <span className="hide-mobile">Nghỉ phép</span></>} key="leave">
                        <LeaveTab employees={employees} leaves={leaves} onRefresh={loadLeaves} />
                    </TabPane>

                    <TabPane tab={<><GiftOutlined /> <span className="hide-mobile">Tài sản</span></>} key="assets">
                        <AssetsTab employees={employees} assets={assets} onRefresh={loadAssets} />
                    </TabPane>

                    <TabPane tab={<><DollarOutlined /> <span className="hide-mobile">Lương</span></>} key="payslip">
                        <PayslipTab employees={employees} payslips={payslips} onRefresh={loadPayslips} />
                    </TabPane>

                    <TabPane tab={<><ReadOutlined /> <span className="hide-mobile">Đào tạo</span></>} key="training">
                        <TrainingTab employees={employees} trainings={trainings} onRefresh={loadTrainings} />
                    </TabPane>

                    <TabPane tab={<><ScheduleOutlined /> <span className="hide-mobile">Ca</span></>} key="shifts">
                        <ShiftsTab shifts={shifts} onRefresh={loadShifts} />
                    </TabPane>

                    <TabPane tab={<><UserOutlined /> <span className="hide-mobile">Tuyển Dụng</span></>} key="recruitment">
                        <RecruitmentTab />
                    </TabPane>

                    <TabPane tab={<><TeamOutlined /> <span className="hide-mobile">Đánh giá 360</span></>} key="review360">
                        <Review360Tab employees={employees} />
                    </TabPane>
                </Tabs>
            </Card>
            <style>{`
                @media (max-width: 768px) {
                    .hide-mobile { display: none; }
                    .ant-table { font-size: 12px !important; }
                    .ant-modal { max-width: 95vw !important; margin: 8px auto !important; }
                    .ant-modal-body { padding: 12px !important; }
                    .ant-form-item { margin-bottom: 12px !important; }
                }
            `}</style>
        </div>
    );
};

export default HRPage;
