import React, { useState } from 'react';
import { Card, Row, Col, Button, Table, Tag, Space, Empty, Divider, List, Avatar, message, Modal, Form, DatePicker, TimePicker, Select, Popconfirm, Radio, Calendar, Badge } from 'antd';
import { UserOutlined, LoginOutlined, LogoutOutlined, PlusOutlined, EditOutlined, DeleteOutlined, CalendarOutlined, UnorderedListOutlined } from '@ant-design/icons';
import api from '../../utils/api';
import dayjs from 'dayjs';

const { Option } = Select;

interface Props {
    employees: any[];
    attendances: any[];
    onRefresh: () => void;
}

const AttendanceTab: React.FC<Props> = ({ employees, attendances, onRefresh }) => {
    const [selectedEmp, setSelectedEmp] = useState<number | null>(null);
    const [modal, setModal] = useState(false);
    const [form] = Form.useForm();
    const [editing, setEditing] = useState<any>(null);
    const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar');

    const handleCheckIn = async (empId: number) => {
        try {
            await api.post('/hr/check-in', { employee_id: empId });
            message.success('Check-in thành công!');
            onRefresh();
        } catch (e) { message.error('Lỗi check-in'); }
    };

    const handleCheckOut = async (empId: number) => {
        try {
            await api.post('/hr/check-out', { employee_id: empId });
            message.success('Check-out thành công!');
            onRefresh();
        } catch (e) { message.error('Lỗi check-out'); }
    };

    // Manual attendance CRUD
    const handleSaveManual = async (values: any) => {
        try {
            const data: any = {
                employee_id: values.employee_id,
                date: values.date.format('YYYY-MM-DD'),
                status: values.status || 'PRESENT',
            };
            if (values.check_in_time) {
                const checkIn = values.date.clone().hour(values.check_in_time.hour()).minute(values.check_in_time.minute());
                data.check_in = checkIn.toISOString();
            }
            if (values.check_out_time) {
                const checkOut = values.date.clone().hour(values.check_out_time.hour()).minute(values.check_out_time.minute());
                data.check_out = checkOut.toISOString();
            }
            // Calculate work hours
            if (data.check_in && data.check_out) {
                const diffMs = new Date(data.check_out).getTime() - new Date(data.check_in).getTime();
                data.work_hours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
            }

            if (editing) {
                await api.put(`/hr/attendances/${editing.id}`, data);
                message.success('Đã cập nhật');
            } else {
                await api.post('/hr/attendances', data);
                message.success('Đã tạo bản ghi chấm công');
            }
            setModal(false);
            form.resetFields();
            setEditing(null);
            onRefresh();
        } catch (e) { message.error('Lỗi lưu'); }
    };

    const handleEdit = (record: any) => {
        setEditing(record);
        form.setFieldsValue({
            employee_id: record.employee_id,
            date: record.date ? dayjs(record.date) : null,
            check_in_time: record.check_in ? dayjs(record.check_in) : null,
            check_out_time: record.check_out ? dayjs(record.check_out) : null,
            status: record.status,
        });
        setModal(true);
    };

    const handleDelete = async (id: number) => {
        try {
            await api.delete(`/hr/attendances/${id}`);
            message.success('Đã xóa');
            onRefresh();
        } catch (e) { message.error('Lỗi xóa'); }
    };

    const openAddModal = () => {
        setEditing(null);
        form.resetFields();
        if (selectedEmp) form.setFieldsValue({ employee_id: selectedEmp });
        setModal(true);
    };

    return (
        <>
            <Row gutter={[12, 12]}>
                <Col xs={24} md={8}>
                    <Card title="Chọn nhân viên" size="small">
                        <List
                            dataSource={employees}
                            renderItem={(emp: any) => (
                                <List.Item
                                    style={{ cursor: 'pointer', background: selectedEmp === emp.id ? '#e6f7ff' : 'transparent' }}
                                    onClick={() => setSelectedEmp(emp.id)}
                                >
                                    <List.Item.Meta avatar={<Avatar icon={<UserOutlined />} />} title={emp.full_name} description={emp.position} />
                                </List.Item>
                            )}
                        />
                    </Card>
                </Col>
                <Col xs={24} md={16}>
                    {selectedEmp ? (
                        <Card title="Chấm công" size="small" extra={
                            <Space>
                                <Radio.Group value={viewMode} onChange={e => setViewMode(e.target.value)} size="small" buttonStyle="solid">
                                    <Radio.Button value="calendar"><CalendarOutlined /></Radio.Button>
                                    <Radio.Button value="list"><UnorderedListOutlined /></Radio.Button>
                                </Radio.Group>
                                <Button type="primary" icon={<PlusOutlined />} onClick={openAddModal}>Tạo thủ công</Button>
                            </Space>
                        }>
                            <Space size="large" style={{ marginBottom: 16 }}>
                                <Button type="primary" size="large" icon={<LoginOutlined />} onClick={() => handleCheckIn(selectedEmp)}>
                                    CHECK IN
                                </Button>
                                <Button size="large" icon={<LogoutOutlined />} onClick={() => handleCheckOut(selectedEmp)}>
                                    CHECK OUT
                                </Button>
                            </Space>
                            <Divider />

                            {viewMode === 'list' ? (
                                <Table
                                    dataSource={attendances.filter(a => a.employee_id === selectedEmp)}
                                    columns={[
                                        { title: 'Ngày', dataIndex: 'date', render: (d: string) => dayjs(d).format('DD/MM/YYYY') },
                                        { title: 'Check-in', dataIndex: 'check_in', render: (d: string) => d ? dayjs(d).format('HH:mm') : '-' },
                                        { title: 'Check-out', dataIndex: 'check_out', render: (d: string) => d ? dayjs(d).format('HH:mm') : '-' },
                                        { title: 'Giờ làm', dataIndex: 'work_hours', render: (h: number) => h ? `${h}h` : '-' },
                                        {
                                            title: 'Trạng thái', dataIndex: 'status', render: (s: string) => {
                                                const c: any = { PRESENT: 'green', LATE: 'orange', ABSENT: 'red', HALF_DAY: 'blue' };
                                                return <Tag color={c[s]}>{s}</Tag>;
                                            }
                                        },
                                        {
                                            title: 'Thao tác',
                                            render: (_: any, r: any) => (
                                                <Space>
                                                    <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)} />
                                                    <Popconfirm title="Xóa bản ghi này?" onConfirm={() => handleDelete(r.id)}>
                                                        <Button size="small" danger icon={<DeleteOutlined />} />
                                                    </Popconfirm>
                                                </Space>
                                            )
                                        }
                                    ]}
                                    rowKey="id"
                                    size="small"
                                />
                            ) : (
                                <Calendar
                                    fullscreen={false}
                                    dateCellRender={(value) => {
                                        const listData = attendances.filter(a =>
                                            a.employee_id === selectedEmp &&
                                            dayjs(a.date).format('YYYY-MM-DD') === value.format('YYYY-MM-DD')
                                        );
                                        return (
                                            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                                {listData.map(item => (
                                                    <li key={item.id}>
                                                        <Tag color={item.status === 'PRESENT' ? 'green' : item.status === 'ABSENT' ? 'red' : 'orange'} style={{ fontSize: 10, margin: '2px 0' }}>
                                                            {item.check_in ? dayjs(item.check_in).format('HH:mm') : item.status}
                                                        </Tag>
                                                    </li>
                                                ))}
                                            </ul>
                                        );
                                    }}
                                />
                            )}
                        </Card>
                    ) : <Empty description="Chọn nhân viên để chấm công" />}
                </Col>
            </Row>

            {/* Manual Attendance Modal */}
            <Modal title={editing ? 'Sửa chấm công' : 'Tạo chấm công thủ công'} open={modal} onCancel={() => setModal(false)} onOk={() => form.submit()} width={450}>
                <Form form={form} layout="vertical" onFinish={handleSaveManual}>
                    <Form.Item name="employee_id" label="Nhân viên" rules={[{ required: true }]}>
                        <Select>
                            {employees.map(e => <Option key={e.id} value={e.id}>{e.full_name}</Option>)}
                        </Select>
                    </Form.Item>
                    <Form.Item name="date" label="Ngày" rules={[{ required: true }]}>
                        <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                    </Form.Item>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="check_in_time" label="Giờ vào">
                                <TimePicker style={{ width: '100%' }} format="HH:mm" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="check_out_time" label="Giờ ra">
                                <TimePicker style={{ width: '100%' }} format="HH:mm" />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item name="status" label="Trạng thái" initialValue="PRESENT">
                        <Select>
                            <Option value="PRESENT">Có mặt</Option>
                            <Option value="LATE">Đi trễ</Option>
                            <Option value="ABSENT">Vắng</Option>
                            <Option value="HALF_DAY">Nửa ngày</Option>
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>
        </>
    );
};

export default AttendanceTab;

