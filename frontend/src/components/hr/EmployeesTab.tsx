import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, DatePicker, InputNumber, Row, Col, Tag, message, Popconfirm, Space, Avatar } from 'antd';
import { UserOutlined, PlusOutlined, EditOutlined, DeleteOutlined, ManOutlined, WomanOutlined } from '@ant-design/icons';
import api from '../../utils/api';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

interface Props {
    employees: any[];
    users: any[];
    shifts: any[];
    onRefresh: () => void;
}

const EmployeesTab: React.FC<Props> = ({ employees, users, shifts, onRefresh }) => {
    const [modal, setModal] = useState(false);
    const [form] = Form.useForm();
    const [editing, setEditing] = useState<any>(null);
    const [balances, setBalances] = useState<Record<number, number>>({});

    useEffect(() => {
        const fetchBalances = async () => {
            const currentYear = new Date().getFullYear();
            const newBalances: Record<number, number> = {};
            await Promise.all(employees.map(async (emp) => {
                try {
                    const res = await api.get(`/hr/balance/${emp.id}?year=${currentYear}`);
                    newBalances[emp.id] = res.data.remaining_days;
                } catch (e) { }
            }));
            setBalances(newBalances);
        };
        if (employees && employees.length > 0) {
            fetchBalances();
        }
    }, [employees]);

    const handleSave = async (values: any) => {
        try {
            if (values.date_of_birth) values.date_of_birth = values.date_of_birth.format('YYYY-MM-DD');
            if (values.hire_date) values.hire_date = values.hire_date.format('YYYY-MM-DD');

            if (editing) {
                await api.put(`/hr/employees/${editing.id}`, values);
                message.success('Đã cập nhật');
            } else {
                await api.post('/hr/employees', values);
                message.success('Đã thêm nhân viên');
            }
            setModal(false);
            form.resetFields();
            setEditing(null);
            onRefresh();
        } catch (e) { message.error('Lỗi lưu nhân viên'); }
    };

    const handleEdit = (emp: any) => {
        setEditing(emp);
        form.setFieldsValue({
            ...emp,
            date_of_birth: emp.date_of_birth ? dayjs(emp.date_of_birth) : null,
            hire_date: emp.hire_date ? dayjs(emp.hire_date) : null,
        });
        setModal(true);
    };

    const handleDelete = async (id: number) => {
        try {
            await api.delete(`/hr/employees/${id}`);
            message.success('Đã xóa');
            onRefresh();
        } catch (e) { message.error('Lỗi xóa'); }
    };

    const columns = [
        { title: 'ID', dataIndex: 'id', width: 60 },
        {
            title: 'Họ và tên',
            dataIndex: 'full_name',
            render: (t: string, r: any) => (
                <Space>
                    <Avatar icon={r.gender === 'FEMALE' ? <WomanOutlined /> : <ManOutlined />}
                        style={{ backgroundColor: r.gender === 'FEMALE' ? '#eb2f96' : '#1890ff' }} />
                    {t}
                </Space>
            )
        },
        { title: 'Giới tính', dataIndex: 'gender', render: (g: string) => g === 'MALE' ? 'Nam' : g === 'FEMALE' ? 'Nữ' : 'Khác' },
        { title: 'Ngày sinh', dataIndex: 'date_of_birth', render: (d: string) => d ? dayjs(d).format('DD/MM/YYYY') : '-' },
        { title: 'Phòng ban', dataIndex: 'department' },
        { title: 'Chức vụ', dataIndex: 'position' },
        { title: 'Lương CB', dataIndex: 'base_salary', render: (v: number) => v ? Number(v).toLocaleString('vi-VN') + ' đ' : '-' },
        { title: 'Phép còn lại', dataIndex: 'id', render: (id: number) => balances[id] !== undefined ? <Tag color={balances[id] > 0 ? "green" : balances[id] === 0 ? "orange" : "red"}>{balances[id]} ngày</Tag> : '-' },
        { title: 'Ca', dataIndex: ['work_shift', 'name'], render: (n: string) => n || <Tag>Chưa gán</Tag> },
        { title: 'User', dataIndex: ['user', 'username'], render: (u: string) => u || <Tag>Chưa liên kết</Tag> },
        {
            title: 'Thao tác',
            render: (_: any, r: any) => (
                <Space>
                    <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)} />
                    <Popconfirm title="Xóa nhân viên này?" onConfirm={() => handleDelete(r.id)}>
                        <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModal(true); }} style={{ marginBottom: 16 }}>
                Thêm nhân viên
            </Button>
            <Table
                dataSource={employees}
                columns={columns}
                rowKey="id"
                size="small"
                scroll={{ x: 900 }}
                pagination={{ pageSize: 10, showSizeChanger: false }}
            />

            <Modal title={editing ? 'Sửa nhân viên' : 'Thêm nhân viên'} open={modal} onCancel={() => setModal(false)} onOk={() => form.submit()} width={600}>
                <Form form={form} layout="vertical" onFinish={handleSave}>
                    <Row gutter={16}>
                        <Col span={12}><Form.Item name="full_name" label="Họ và tên" rules={[{ required: true }]}><Input /></Form.Item></Col>
                        <Col span={12}><Form.Item name="gender" label="Giới tính"><Select><Option value="MALE">Nam</Option><Option value="FEMALE">Nữ</Option><Option value="OTHER">Khác</Option></Select></Form.Item></Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={12}><Form.Item name="date_of_birth" label="Ngày sinh"><DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" /></Form.Item></Col>
                        <Col span={12}><Form.Item name="phone" label="SĐT"><Input /></Form.Item></Col>
                    </Row>
                    <Form.Item name="address" label="Địa chỉ"><Input /></Form.Item>
                    <Row gutter={16}>
                        <Col span={12}><Form.Item name="department" label="Phòng ban"><Input /></Form.Item></Col>
                        <Col span={12}><Form.Item name="position" label="Chức vụ"><Input /></Form.Item></Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={12}><Form.Item name="hire_date" label="Ngày vào làm"><DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" /></Form.Item></Col>
                        <Col span={12}><Form.Item name="base_salary" label="Lương cơ bản"><InputNumber style={{ width: '100%' }} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} /></Form.Item></Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="user_id" label="Liên kết User">
                                <Select allowClear placeholder="Chọn user hệ thống">
                                    {users.map(u => <Option key={u.id} value={u.id}>{u.username} - {u.full_name}</Option>)}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="work_shift_id" label="Ca làm việc">
                                <Select allowClear placeholder="Chọn ca làm việc">
                                    {shifts.map(s => <Option key={s.id} value={s.id}>{s.name} ({s.start_time} - {s.end_time})</Option>)}
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item name="note" label="Ghi chú"><TextArea rows={2} /></Form.Item>
                </Form>
            </Modal>
        </>
    );
};

export default EmployeesTab;
