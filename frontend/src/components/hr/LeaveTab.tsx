import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Select, DatePicker, Row, Col, Tag, Space, message, Popconfirm, Input, Card, Statistic, InputNumber, Divider, Checkbox, Alert } from 'antd';
import { PlusOutlined, CheckCircleOutlined, CloseCircleOutlined, DeleteOutlined, CalendarOutlined, SettingOutlined } from '@ant-design/icons';
import api from '../../utils/api';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

interface Props {
    employees: any[];
    leaves: any[];
    onRefresh: () => void;
}

const LeaveTab: React.FC<Props> = ({ employees, leaves, onRefresh }) => {
    const [modal, setModal] = useState(false);
    const [form] = Form.useForm();
    const [selectedEmpId, setSelectedEmpId] = useState<number | null>(null);
    const [balance, setBalance] = useState<any>(null);
    const [entitlementModal, setEntitlementModal] = useState(false);
    const [entForm] = Form.useForm();
    const [isHalfDay, setIsHalfDay] = useState(false);
    const [computedDays, setComputedDays] = useState<number>(1);

    // Load balance when employee selected
    useEffect(() => {
        if (selectedEmpId) {
            loadBalance(selectedEmpId);
        }
    }, [selectedEmpId]);

    const loadBalance = async (empId: number) => {
        try {
            const res = await api.get(`/hr/balance/${empId}?year=${new Date().getFullYear()}`);
            setBalance(res.data);
        } catch (e) { setBalance(null); }
    };

    const handleSaveEntitlement = async (values: any) => {
        try {
            await api.post('/hr/entitlements', values);
            message.success('Đã lưu số ngày phép');
            setEntitlementModal(false);
            entForm.resetFields();
            if (selectedEmpId) loadBalance(selectedEmpId);
        } catch (e) { message.error('Lỗi lưu'); }
    };

    // Auto-compute days when dates or half-day changes
    const recomputeDays = (startDate?: dayjs.Dayjs, endDate?: dayjs.Dayjs, halfDay?: boolean) => {
        const start = startDate || form.getFieldValue('start_date');
        const end = endDate || form.getFieldValue('end_date');
        const half = halfDay !== undefined ? halfDay : isHalfDay;
        if (start && end) {
            const fullDays = end.diff(start, 'day') + 1;
            const days = half ? Math.max(0.5, fullDays - 0.5) : fullDays;
            setComputedDays(days);
            form.setFieldValue('days', days);
        }
    };

    const handleSave = async (values: any) => {
        try {
            values.start_date = values.start_date.format('YYYY-MM-DD');
            values.end_date = values.end_date.format('YYYY-MM-DD');
            values.days = Number(values.days || computedDays);
            await api.post('/hr/leaves', values);
            message.success('Đã tạo đơn nghỉ phép');
            setModal(false);
            form.resetFields();
            setIsHalfDay(false);
            setComputedDays(1);
            onRefresh();
        } catch (e) { message.error('Lỗi tạo đơn'); }
    };

    const handleApprove = async (id: number, approved: boolean) => {
        try {
            await api.put(`/hr/leaves/${id}/approve`, { approved });
            message.success(approved ? 'Đã duyệt' : 'Đã từ chối');
            onRefresh();
        } catch (e) { message.error('Lỗi duyệt đơn'); }
    };

    const handleDelete = async (id: number) => {
        try {
            await api.delete(`/hr/leaves/${id}`);
            message.success('Đã xóa đơn');
            onRefresh();
        } catch (e) { message.error('Lỗi xóa đơn'); }
    };

    const columns = [
        { title: 'Nhân viên', dataIndex: ['employee', 'full_name'] },
        {
            title: 'Loại', dataIndex: 'leave_type', render: (t: string) => {
                const map: any = { ANNUAL: 'Phép năm', SICK: 'Ốm', UNPAID: 'Không lương', MATERNITY: 'Thai sản', OTHER: 'Khác' };
                return map[t] || t;
            }
        },
        { title: 'Từ ngày', dataIndex: 'start_date', render: (d: string) => dayjs(d).format('DD/MM/YYYY') },
        { title: 'Đến ngày', dataIndex: 'end_date', render: (d: string) => dayjs(d).format('DD/MM/YYYY') },
        { title: 'Số ngày', dataIndex: 'days', align: 'center' as const, render: (v: number) => {
            const num = Number(v);
            const isHalf = num % 1 !== 0;
            return <Tag color={isHalf ? 'volcano' : 'blue'} style={{ fontWeight: 600 }}>{num % 1 === 0 ? num : num.toFixed(1)} ngày</Tag>;
        }},
        { title: 'Lý do', dataIndex: 'reason', ellipsis: true },
        {
            title: 'Trạng thái', dataIndex: 'status', render: (s: string) => {
                const c: any = { PENDING: 'orange', APPROVED: 'green', REJECTED: 'red' };
                const t: any = { PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối' };
                return <Tag color={c[s]}>{t[s]}</Tag>;
            }
        },
        {
            title: 'Thao tác',
            render: (_: any, r: any) => (
                <Space>
                    {r.status === 'PENDING' && (
                        <>
                            <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => handleApprove(r.id, true)}>Duyệt</Button>
                            <Button size="small" danger icon={<CloseCircleOutlined />} onClick={() => handleApprove(r.id, false)}>Từ chối</Button>
                        </>
                    )}
                    <Popconfirm title="Xóa đơn này?" onConfirm={() => handleDelete(r.id)}>
                        <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                <Space wrap>
                    <Select
                        style={{ width: 250 }}
                        placeholder="Chọn nhân viên xem số dư phép..."
                        allowClear
                        onChange={(val) => {
                            setSelectedEmpId(val);
                            if (!val) setBalance(null);
                        }}
                        showSearch
                        optionFilterProp="children"
                    >
                        {employees.map(e => <Option key={e.id} value={e.id}>{e.full_name}</Option>)}
                    </Select>
                    <Button
                        icon={<SettingOutlined />}
                        type={selectedEmpId ? 'primary' : 'default'}
                        onClick={() => {
                            if (!selectedEmpId) {
                                message.warning('Vui lòng chọn nhân viên trước');
                                return;
                            }
                            setEntitlementModal(true);
                            entForm.setFieldsValue({
                                employee_id: selectedEmpId,
                                year: new Date().getFullYear(),
                                annual_days: balance?.annual_days || 12,
                                carried_days: balance?.carried_days || 0
                            });
                        }}
                    >
                        Thiết lập ngày phép
                    </Button>
                </Space>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModal(true); }}>
                    Đăng ký nghỉ phép
                </Button>
            </div>

            {balance && (
                <div style={{ marginBottom: 16 }}>
                    <Row gutter={16}>
                        <Col span={6}><Statistic title="Phép năm" value={Number(balance.annual_days)} precision={balance.annual_days % 1 !== 0 ? 1 : 0} prefix={<CalendarOutlined />} /></Col>
                        <Col span={6}><Statistic title="Tồn năm trước" value={Number(balance.carried_days)} precision={balance.carried_days % 1 !== 0 ? 1 : 0} /></Col>
                        <Col span={6}><Statistic title="Đã sử dụng" value={Number(balance.used_days)} precision={balance.used_days % 1 !== 0 ? 1 : 0} valueStyle={{ color: '#cf1322' }} /></Col>
                        <Col span={6}><Statistic title="Còn lại" value={Number(balance.remaining_days)} precision={balance.remaining_days % 1 !== 0 ? 1 : 0} valueStyle={{ color: '#3f8600' }} suffix="ngày" /></Col>
                    </Row>
                    <Divider style={{ margin: '12px 0' }} />
                </div>
            )}

            <Table
                dataSource={leaves}
                columns={columns}
                rowKey="id"
                size="small"
                scroll={{ x: 900 }}
                pagination={{ pageSize: 10, showSizeChanger: false }}
            />

            <Modal title="Đăng ký nghỉ phép" open={modal} onCancel={() => { setModal(false); setIsHalfDay(false); setComputedDays(1); }} onOk={() => form.submit()} width={520}>
                <Form form={form} layout="vertical" onFinish={handleSave}>
                    <Form.Item name="employee_id" label="Nhân viên" rules={[{ required: true }]}>
                        <Select showSearch optionFilterProp="children">{employees.map(e => <Option key={e.id} value={e.id}>{e.full_name}</Option>)}</Select>
                    </Form.Item>
                    <Form.Item name="leave_type" label="Loại nghỉ" initialValue="ANNUAL">
                        <Select>
                            <Option value="ANNUAL">Phép năm</Option>
                            <Option value="SICK">Nghỉ ốm</Option>
                            <Option value="MATERNITY">Thai sản</Option>
                            <Option value="UNPAID">Không lương</Option>
                            <Option value="OTHER">Khác</Option>
                        </Select>
                    </Form.Item>
                    <Row gutter={16}>
                        <Col span={12}><Form.Item name="start_date" label="Từ ngày" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" onChange={(d) => recomputeDays(d ?? undefined, undefined)} /></Form.Item></Col>
                        <Col span={12}><Form.Item name="end_date" label="Đến ngày" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" onChange={(d) => recomputeDays(undefined, d ?? undefined)} /></Form.Item></Col>
                    </Row>
                    {/* HALF-DAY OPTION */}
                    <Row gutter={16} align="middle">
                        <Col span={12}>
                            <Form.Item style={{ marginBottom: 8 }}>
                                <Checkbox
                                    checked={isHalfDay}
                                    onChange={(e) => {
                                        setIsHalfDay(e.target.checked);
                                        recomputeDays(undefined, undefined, e.target.checked);
                                    }}
                                >
                                    Nghỉ nửa ngày (0.5)
                                </Checkbox>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="days" label="Số ngày nghỉ" style={{ marginBottom: 8 }}>
                                <InputNumber
                                    min={0.5}
                                    step={0.5}
                                    precision={1}
                                    style={{ width: '100%' }}
                                    addonAfter="ngày"
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                    {isHalfDay && (
                        <Alert
                            message="💡 Nghỉ nửa ngày: Chỉ nghỉ buổi sáng hoặc chiều. Hệ thống sẽ tính 0.5 ngày phép."
                            type="info"
                            showIcon
                            style={{ marginBottom: 16, fontSize: 12 }}
                        />
                    )}
                    <Form.Item name="reason" label="Lý do"><TextArea rows={3} /></Form.Item>
                </Form>
            </Modal>

            {/* Entitlement Setup Modal */}
            <Modal title="Thiết lập ngày phép năm" open={entitlementModal} onCancel={() => setEntitlementModal(false)} onOk={() => entForm.submit()} width={400}>
                <Form form={entForm} layout="vertical" onFinish={handleSaveEntitlement}>
                    <Form.Item name="employee_id" label="Nhân viên" rules={[{ required: true }]}>
                        <Select disabled showSearch optionFilterProp="children">{employees.map(e => <Option key={e.id} value={e.id}>{e.full_name}</Option>)}</Select>
                    </Form.Item>
                    <Form.Item name="year" label="Năm" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} /></Form.Item>
                    <Form.Item name="annual_days" label="Phép năm được cấp"><InputNumber style={{ width: '100%' }} min={0} step={0.5} precision={1} addonAfter="ngày" /></Form.Item>
                    <Form.Item name="carried_days" label="Phép tồn năm trước"><InputNumber style={{ width: '100%' }} min={0} step={0.5} precision={1} addonAfter="ngày" /></Form.Item>
                </Form>
            </Modal>
        </>
    );
};

export default LeaveTab;
