import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, DatePicker, Row, Col, message, Button } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import api from '../utils/api';
import dayjs from 'dayjs';

const { Option } = Select;

interface QuickTaskModalProps {
    open: boolean;
    onClose: () => void;
    initialValues?: {
        title?: string;
        description?: string;
        reference_code?: string;
        reference_type?: string;
        due_date?: any;
    };
    onSuccess?: () => void;
}

const QuickTaskModal: React.FC<QuickTaskModalProps> = ({ open, onClose, initialValues, onSuccess }) => {
    const [form] = Form.useForm();
    const [users, setUsers] = useState<any[]>([]);

    // Lấy user hiện tại để mặc định giao cho chính mình
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

    useEffect(() => {
        if (open) {
            fetchUsers();
            form.resetFields();
            form.setFieldsValue({
                priority: 'MEDIUM',
                assignee_id: currentUser.id, // Mặc định giao cho mình
                ...initialValues,
                due_date: initialValues?.due_date ? dayjs(initialValues.due_date) : dayjs().add(1, 'hour') // Mặc định 1 tiếng sau
            });
        }
    }, [open, initialValues]);

    const fetchUsers = async () => {
        try { const res = await api.get('/users'); setUsers(res.data); } catch (e) { }
    };

    const handleSave = async (values: any) => {
        try {
            await api.post('/tasks', {
                ...values,
                creator_id: currentUser.id,
                due_date: values.due_date ? values.due_date.toISOString() : null
            });
            message.success('Đã tạo nhắc nhở thành công!');
            if (onSuccess) onSuccess();
            onClose();
        } catch (e) {
            message.error('Lỗi khi tạo task');
        }
    };

    return (
        <Modal
            title={<span><ClockCircleOutlined /> Tạo Nhắc Nhở / Công Việc Nhanh</span>}
            open={open}
            onCancel={onClose}
            onOk={() => form.submit()}
            okText="Lưu Nhắc Nhở"
        >
            <Form form={form} layout="vertical" onFinish={handleSave}>
                <Form.Item name="title" label="Tiêu đề công việc" rules={[{ required: true }]}>
                    <Input placeholder="Vd: Gọi lại cho khách, Kiểm tra kho..." />
                </Form.Item>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item name="reference_code" label="Mã tham chiếu">
                            <Input disabled style={{ fontWeight: 'bold', color: '#1890ff' }} />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item name="priority" label="Mức độ">
                            <Select>
                                <Option value="LOW">Thấp</Option>
                                <Option value="MEDIUM">Bình thường</Option>
                                <Option value="HIGH">Cao</Option>
                                <Option value="URGENT">Khẩn cấp</Option>
                            </Select>
                        </Form.Item>
                    </Col>
                </Row>

                <Form.Item name="description" label="Ghi chú chi tiết">
                    <Input.TextArea rows={2} />
                </Form.Item>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item name="assignee_id" label="Người thực hiện (Nhận thông báo)">
                            <Select showSearch optionFilterProp="children">
                                {users.map(u => <Option key={u.id} value={u.id}>{u.full_name}</Option>)}
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item name="due_date" label="Hạn chót (Deadline)" rules={[{ required: true }]}>
                            <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} />
                        </Form.Item>
                    </Col>
                </Row>
            </Form>
        </Modal>
    );
};

export default QuickTaskModal;