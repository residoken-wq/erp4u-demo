import React, { useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, DatePicker, InputNumber, Row, Col, Tag, message, Divider, Space, Popconfirm, Checkbox, Grid } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, DollarOutlined, CheckCircleOutlined } from '@ant-design/icons';
import api from '../../utils/api';
import dayjs from 'dayjs';

const { Option } = Select;

interface Props {
    employees: any[];
    payslips: any[];
    onRefresh: () => void;
}

const PayslipTab: React.FC<Props> = ({ employees, payslips, onRefresh }) => {
    const [modal, setModal] = useState(false);
    const [form] = Form.useForm();
    const [viewPayslip, setViewPayslip] = useState<any>(null);
    const [editing, setEditing] = useState<any>(null);
    const screens = Grid.useBreakpoint();

    const formatMoney = (v: any) => {
        const num = Number(v) || 0;
        return num.toLocaleString('vi-VN');
    };

    // Calculate standard work days in a month based on work days per week (5 or 6)
    const calcStandardWorkDays = (year: number, month: number, daysPerWeek: number = 6): number => {
        const daysInMonth = new Date(year, month, 0).getDate();
        let workDays = 0;
        for (let day = 1; day <= daysInMonth; day++) {
            const dow = new Date(year, month - 1, day).getDay(); // 0=Sun, 6=Sat
            if (daysPerWeek === 5) {
                // Mon-Fri (1-5)
                if (dow >= 1 && dow <= 5) workDays++;
            } else {
                // Mon-Sat (1-6)
                if (dow >= 1 && dow <= 6) workDays++;
            }
        }
        return workDays;
    };

    // Auto calculate when month/year/employee changes
    const autoCalcDays = async () => {
        const empId = form.getFieldValue('employee_id');
        const month = form.getFieldValue('month');
        const year = form.getFieldValue('year');
        if (empId && month && year) {
            const emp = employees.find(e => e.id === empId);
            const daysPerWeek = emp?.work_shift?.work_days_per_week || 6;
            const calcType = emp?.work_shift?.calc_type;
            const stdDays = calcStandardWorkDays(year, month, daysPerWeek);
            form.setFieldsValue({ standard_work_days: stdDays });

            if (calcType === 'HOURLY') {
                try {
                    const res = await api.get('/hr/attendances', { params: { employee_id: empId, month, year } });
                    const attendances = res.data || [];
                    const totalHours = attendances.reduce((sum: number, a: any) => sum + (Number(a.work_hours) || 0), 0);
                    form.setFieldsValue({ actual_work_days: totalHours });
                } catch (e) {
                    form.setFieldsValue({ actual_work_days: 0 });
                }
            } else {
                form.setFieldsValue({ actual_work_days: stdDays });
            }
        }
    };

    const handleSave = async (values: any) => {
        try {
            if (editing) {
                await api.put(`/hr/payslips/${editing.id}`, values);
                message.success('Đã cập nhật phiếu lương');
            } else {
                await api.post('/hr/payslips', values);
                message.success('Đã tạo phiếu lương');
            }
            setModal(false);
            form.resetFields();
            setEditing(null);
            onRefresh();
        } catch (e) { message.error('Lỗi lưu phiếu'); }
    };

    const handleEdit = (payslip: any) => {
        setEditing(payslip);
        form.setFieldsValue({
            ...payslip,
            employee_id: payslip.employee_id || payslip.employee?.id,
        });
        setModal(true);
    };

    const handleDelete = async (id: number) => {
        try {
            await api.delete(`/hr/payslips/${id}`);
            message.success('Đã xóa phiếu lương');
            onRefresh();
        } catch (e) { message.error('Lỗi xóa'); }
    };

    const handlePay = async (payslip: any) => {
        try {
            // Create expense transaction for salary payment
            await api.post('/finance/transactions', {
                type: 'expense',
                category: 'CP_Lương',
                amount: payslip.net_salary,
                date: new Date().toISOString(),
                description: `Thanh toán lương tháng ${payslip.month}/${payslip.year} - ${payslip.employee?.full_name}`,
                ref_type: 'PAYSLIP',
                ref_code: `PAYSLIP-${payslip.id}`,
            });
            // Update payslip status
            await api.put(`/hr/payslips/${payslip.id}`, { is_paid: true, paid_date: new Date() });
            message.success('Đã thanh toán và tạo phiếu chi!');
            onRefresh();
        } catch (e) { message.error('Lỗi thanh toán'); }
    };

    const columns = [
        { title: 'Nhân viên', dataIndex: ['employee', 'full_name'] },
        { title: 'Tháng', render: (_: any, r: any) => `${r.month}/${r.year}` },
        { title: 'Lương CB', dataIndex: 'base_salary', render: (v: number) => formatMoney(v) },
        { title: 'Công', dataIndex: 'actual_work_days', render: (v: any, r: any) => r.employee?.work_shift?.calc_type === 'HOURLY' ? `${v} giờ` : `${v} ngày` },
        { title: 'Tổng thu', dataIndex: 'gross_income', render: (v: number) => formatMoney(v) },
        { title: 'Thực nhận', dataIndex: 'net_salary', render: (v: number) => <b style={{ color: 'green' }}>{formatMoney(v)}</b> },
        {
            title: 'Trạng thái', dataIndex: 'is_paid', render: (p: boolean) => p ?
                <Tag color="green" icon={<CheckCircleOutlined />}>Đã thanh toán</Tag> :
                <Tag color="orange">Chưa TT</Tag>
        },
        {
            title: 'Thao tác',
            render: (_: any, r: any) => (
                <Space size="small">
                    <Button size="small" onClick={() => setViewPayslip(r)}>Xem</Button>
                    {!r.is_paid && (
                        <Popconfirm title={`Thanh toán ${r.net_salary?.toLocaleString()}đ cho ${r.employee?.full_name}?`} onConfirm={() => handlePay(r)}>
                            <Button size="small" type="primary" icon={<DollarOutlined />}>Thanh toán</Button>
                        </Popconfirm>
                    )}
                    <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)} />
                    <Popconfirm title="Xóa phiếu lương này?" onConfirm={() => handleDelete(r.id)}>
                        <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModal(true); }} style={{ marginBottom: 16 }}>
                Tạo phiếu lương
            </Button>
            <Table
                dataSource={payslips}
                columns={columns}
                rowKey="id"
                size="small"
                scroll={{ x: 800 }}
                pagination={{ pageSize: 10, showSizeChanger: false }}
            />

            {/* Create Modal */}
            <Modal title="Tạo phiếu lương" open={modal} onCancel={() => setModal(false)} onOk={() => form.submit()} width={650}>
                <Form form={form} layout="vertical" onFinish={handleSave}>
                    <Form.Item name="employee_id" label="Nhân viên" rules={[{ required: true }]}>
                        <Select onChange={async (id) => {
                            const emp = employees.find(e => e.id === id);
                            if (emp) {
                                form.setFieldsValue({ base_salary: emp.base_salary });
                                // Auto calc standard days if month/year set
                                const month = form.getFieldValue('month');
                                const year = form.getFieldValue('year');
                                if (month && year) {
                                    await autoCalcDays();
                                }
                            }
                        }}>
                            {employees.map(e => <Option key={e.id} value={e.id}>{e.full_name}</Option>)}
                        </Select>
                    </Form.Item>
                    <Row gutter={16}>
                        <Col span={6}>
                            <Form.Item name="month" label="Tháng" rules={[{ required: true }]}>
                                <Select onChange={() => autoCalcDays()}>
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => <Option key={m} value={m}>Tháng {m}</Option>)}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={6}><Form.Item name="year" label="Năm" rules={[{ required: true }]}><InputNumber min={2020} style={{ width: '100%' }} onChange={() => autoCalcDays()} /></Form.Item></Col>
                        <Col span={6}><Form.Item name="standard_work_days" label="Chuẩn"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
                        <Col span={6}><Form.Item name="actual_work_days" label="Thực tế" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} step={0.5} /></Form.Item></Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={12}><Form.Item name="base_salary" label="Lương cơ bản"><InputNumber style={{ width: '100%' }} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} /></Form.Item></Col>
                        <Col span={12}><Form.Item name="bonus" label="Thưởng"><InputNumber style={{ width: '100%' }} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} /></Form.Item></Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={8}><Form.Item name="allowance_meal" label="PC Ăn trưa"><InputNumber style={{ width: '100%' }} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} /></Form.Item></Col>
                        <Col span={8}><Form.Item name="allowance_transport" label="PC Đi lại"><InputNumber style={{ width: '100%' }} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} /></Form.Item></Col>
                        <Col span={8}><Form.Item name="allowance_phone" label="PC Điện thoại"><InputNumber style={{ width: '100%' }} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} /></Form.Item></Col>
                    </Row>
                    <Form.Item name="include_insurance" valuePropName="checked" initialValue={true}>
                        <Checkbox>Tính các loại Bảo Hiểm (BHXH, BHYT, BHTN)</Checkbox>
                    </Form.Item>
                </Form>
            </Modal>

            {/* View Payslip Modal */}
            <Modal title="Phiếu Lương" open={!!viewPayslip} onCancel={() => setViewPayslip(null)} footer={null} width={screens.md ? '50vw' : '80vw'}>
                {viewPayslip && (
                    <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 13 }}>
                        {/* Header với Logo */}
                        <div style={{ textAlign: 'center', marginBottom: 16 }}>
                            <div style={{ fontSize: 28, fontWeight: 'bold', color: '#1890ff', marginBottom: 4 }}>ERP4U</div>
                            <h3 style={{ margin: 0, fontSize: 16 }}>BẢNG THANH TOÁN LƯƠNG</h3>
                            <p style={{ margin: '4px 0 0', color: '#666' }}>Tháng {viewPayslip.month} / {viewPayslip.year}</p>
                        </div>
                        <Divider style={{ margin: '8px 0' }} />
                        <p><b>Nhân viên:</b> {viewPayslip.employee?.full_name}</p>
                        <p><b>Chức vụ:</b> {viewPayslip.employee?.position || '-'}</p>
                        <p><b>Phòng ban:</b> {viewPayslip.employee?.department || '-'}</p>
                        <Divider style={{ margin: '8px 0' }} />

                        <div style={{ background: '#f5f5f5', padding: 8, marginBottom: 8, fontWeight: 'bold' }}>THU NHẬP</div>
                        <Row><Col span={14}>Lương cơ bản</Col><Col span={10} style={{ textAlign: 'right' }}>{formatMoney(viewPayslip.base_salary)}</Col></Row>
                        <Row><Col span={14}>{viewPayslip.employee?.work_shift?.calc_type === 'HOURLY' ? `Giờ công: ${viewPayslip.actual_work_days}` : `Ngày công: ${viewPayslip.actual_work_days}/${viewPayslip.standard_work_days || 26}`}</Col><Col span={10} style={{ textAlign: 'right' }}>{formatMoney(viewPayslip.actual_salary)}</Col></Row>
                        <Row><Col span={14}>PC Ăn trưa</Col><Col span={10} style={{ textAlign: 'right' }}>{formatMoney(viewPayslip.allowance_meal)}</Col></Row>
                        <Row><Col span={14}>PC Đi lại</Col><Col span={10} style={{ textAlign: 'right' }}>{formatMoney(viewPayslip.allowance_transport)}</Col></Row>
                        <Row><Col span={14}>PC Điện thoại</Col><Col span={10} style={{ textAlign: 'right' }}>{formatMoney(viewPayslip.allowance_phone)}</Col></Row>
                        <Row><Col span={14}>Thưởng</Col><Col span={10} style={{ textAlign: 'right' }}>{formatMoney(viewPayslip.bonus)}</Col></Row>
                        <Row style={{ fontWeight: 'bold', marginTop: 8, background: '#fafafa', padding: '4px 0' }}><Col span={14}>TỔNG THU NHẬP</Col><Col span={10} style={{ textAlign: 'right' }}>{formatMoney(viewPayslip.gross_income)}</Col></Row>

                        <div style={{ background: '#fff1f0', padding: 8, margin: '16px 0 8px', fontWeight: 'bold' }}>KHẤU TRỪ</div>
                        <Row><Col span={14}>BHXH (8%)</Col><Col span={10} style={{ textAlign: 'right', color: '#cf1322' }}>-{formatMoney(viewPayslip.bhxh_employee)}</Col></Row>
                        <Row><Col span={14}>BHYT (1.5%)</Col><Col span={10} style={{ textAlign: 'right', color: '#cf1322' }}>-{formatMoney(viewPayslip.bhyt_employee)}</Col></Row>
                        <Row><Col span={14}>BHTN (1%)</Col><Col span={10} style={{ textAlign: 'right', color: '#cf1322' }}>-{formatMoney(viewPayslip.bhtn_employee)}</Col></Row>
                        <Row><Col span={14}>Công đoàn</Col><Col span={10} style={{ textAlign: 'right', color: '#cf1322' }}>-{formatMoney(viewPayslip.union_fee)}</Col></Row>
                        <Row><Col span={14}>Thuế TNCN</Col><Col span={10} style={{ textAlign: 'right', color: '#cf1322' }}>-{formatMoney(viewPayslip.tax_income)}</Col></Row>

                        <Divider style={{ margin: '16px 0 8px' }} />
                        <Row style={{ fontSize: 18, fontWeight: 'bold', color: '#52c41a', background: '#f6ffed', padding: '8px', borderRadius: 4 }}>
                            <Col span={14}>THỰC NHẬN</Col>
                            <Col span={10} style={{ textAlign: 'right' }}>{formatMoney(viewPayslip.net_salary)} đ</Col>
                        </Row>

                        <div style={{ background: '#e6f7ff', padding: 8, marginTop: 16, fontSize: 11, borderRadius: 4 }}>
                            <b>Công ty đóng:</b> BHXH {formatMoney(viewPayslip.bhxh_company)} | BHYT {formatMoney(viewPayslip.bhyt_company)} | BHTN {formatMoney(viewPayslip.bhtn_company)}
                        </div>
                    </div>
                )}
            </Modal>
        </>
    );
};

export default PayslipTab;
