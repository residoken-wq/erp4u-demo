import React, { useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, DatePicker, InputNumber, Row, Col, Tag, Space, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../../utils/api';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

interface Props {
    shifts: any[];
    onRefresh: () => void;
}

const ShiftsTab: React.FC<Props> = ({ shifts, onRefresh }) => {
    const [modal, setModal] = useState(false);
    const [form] = Form.useForm();
    const [editing, setEditing] = useState<any>(null);

    const handleSave = async (values: any) => {
        try {
            if (editing) {
                await api.put(`/hr/shifts/${editing.id}`, values);
                message.success('Đã cập nhật');
            } else {
                await api.post('/hr/shifts', values);
                message.success('Đã tạo ca làm việc');
            }
            setModal(false);
            form.resetFields();
            setEditing(null);
            onRefresh();
        } catch (e) { message.error('Lỗi lưu ca'); }
    };

    const handleEdit = (shift: any) => {
        setEditing(shift);
        form.setFieldsValue(shift);
        setModal(true);
    };

    const handleDelete = async (id: number) => {
        try {
            await api.delete(`/hr/shifts/${id}`);
            message.success('Đã xóa');
            onRefresh();
        } catch (e) { message.error('Lỗi xóa'); }
    };

    const columns = [
        { title: 'Tên ca', dataIndex: 'name' },
        { title: 'Mã', dataIndex: 'code' },
        { title: 'Giờ BĐ', dataIndex: 'start_time' },
        { title: 'Giờ KT', dataIndex: 'end_time' },
        { title: 'Số giờ', dataIndex: 'work_hours' },
        { title: 'Ngày/tuần', dataIndex: 'work_days_per_week', render: (d: number) => `${d || 6} ngày` },
        { title: 'Tính công', dataIndex: 'calc_type', render: (t: string) => <Tag color={t === 'DAILY' ? 'blue' : 'green'}>{t === 'DAILY' ? 'Theo ngày' : 'Theo giờ'}</Tag> },
        { title: 'Trễ cho phép', dataIndex: 'late_tolerance_minutes', render: (m: number) => `${m} phút` },
        {
            title: 'Thao tác',
            render: (_: any, r: any) => (
                <Space>
                    <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)} />
                    <Popconfirm title="Xóa ca này?" onConfirm={() => handleDelete(r.id)}>
                        <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModal(true); }} style={{ marginBottom: 16 }}>
                Thêm ca làm việc
            </Button>
            <Table
                dataSource={shifts}
                columns={columns}
                rowKey="id"
                size="small"
                scroll={{ x: 800 }}
                pagination={{ pageSize: 10, showSizeChanger: false }}
            />

            <Modal title={editing ? 'Sửa ca làm việc' : 'Thêm ca làm việc'} open={modal} onCancel={() => setModal(false)} onOk={() => form.submit()} width={500}>
                <Form form={form} layout="vertical" onFinish={handleSave}>
                    <Row gutter={16}>
                        <Col span={12}><Form.Item name="name" label="Tên ca" rules={[{ required: true }]}><Input placeholder="VD: Ca sáng" /></Form.Item></Col>
                        <Col span={12}><Form.Item name="code" label="Mã ca"><Input placeholder="VD: MORNING" /></Form.Item></Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={12}><Form.Item name="start_time" label="Giờ bắt đầu" rules={[{ required: true }]}><Input placeholder="08:00" /></Form.Item></Col>
                        <Col span={12}><Form.Item name="end_time" label="Giờ kết thúc" rules={[{ required: true }]}><Input placeholder="17:00" /></Form.Item></Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={12}><Form.Item name="break_start" label="Nghỉ trưa từ"><Input placeholder="12:00" /></Form.Item></Col>
                        <Col span={12}><Form.Item name="break_end" label="Nghỉ trưa đến"><Input placeholder="13:00" /></Form.Item></Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={8}><Form.Item name="work_hours" label="Số giờ làm" initialValue={8}><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
                        <Col span={8}>
                            <Form.Item name="calc_type" label="Tính công" initialValue="DAILY">
                                <Select>
                                    <Option value="DAILY">Theo ngày</Option>
                                    <Option value="HOURLY">Theo giờ</Option>
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={8}><Form.Item name="late_tolerance_minutes" label="Trễ (phút)" initialValue={15}><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="work_days_per_week" label="Số ngày làm/tuần" initialValue={6}>
                                <Select>
                                    <Option value={5}>5 ngày (T2-T6)</Option>
                                    <Option value={6}>6 ngày (T2-T7)</Option>
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

export default ShiftsTab;
