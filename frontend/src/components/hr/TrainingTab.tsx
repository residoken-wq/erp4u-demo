import React, { useState } from 'react';
import { Row, Col, Card, Button, Modal, Form, Input, Select, DatePicker, Tag, Progress, Timeline, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import api from '../../utils/api';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

interface Props {
    employees: any[];
    trainings: any[];
    onRefresh: () => void;
}

const TrainingTab: React.FC<Props> = ({ employees, trainings, onRefresh }) => {
    const [modal, setModal] = useState(false);
    const [form] = Form.useForm();
    const [editing, setEditing] = useState<any>(null);

    const handleSave = async (values: any) => {
        try {
            if (values.start_date) values.start_date = values.start_date.format('YYYY-MM-DD');
            if (values.target_date) values.target_date = values.target_date.format('YYYY-MM-DD');
            if (values.skills) values.skills = values.skills.split(',').map((s: string) => s.trim());

            if (editing) {
                await api.put(`/hr/trainings/${editing.id}`, values);
                message.success('Đã cập nhật');
            } else {
                await api.post('/hr/trainings', values);
                message.success('Đã thêm kế hoạch đào tạo');
            }
            setModal(false);
            form.resetFields();
            setEditing(null);
            onRefresh();
        } catch (e) { message.error('Lỗi lưu'); }
    };

    return (
        <>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModal(true); }} style={{ marginBottom: 16 }}>
                Thêm kế hoạch
            </Button>
            <Row gutter={[12, 12]}>
                {trainings.map((t: any) => (
                    <Col xs={24} sm={12} md={8} key={t.id}>
                        <Card
                            title={t.title}
                            size="small"
                            extra={<Tag color={t.status === 'COMPLETED' ? 'green' : t.status === 'IN_PROGRESS' ? 'blue' : 'default'}>{t.status}</Tag>}
                        >
                            <p><b>Nhân viên:</b> {t.employee?.full_name}</p>
                            <p><b>Kỹ năng:</b> {t.skills?.join(', ')}</p>
                            <Progress percent={t.progress} size="small" />
                            {t.milestones && (
                                <Timeline style={{ marginTop: 16 }}>
                                    {t.milestones.map((m: any, i: number) => (
                                        <Timeline.Item key={i} color={m.completed ? 'green' : 'gray'}>
                                            {m.title}
                                        </Timeline.Item>
                                    ))}
                                </Timeline>
                            )}
                        </Card>
                    </Col>
                ))}
            </Row>

            <Modal title="Kế hoạch đào tạo" open={modal} onCancel={() => setModal(false)} onOk={() => form.submit()}>
                <Form form={form} layout="vertical" onFinish={handleSave}>
                    <Form.Item name="employee_id" label="Nhân viên" rules={[{ required: true }]}>
                        <Select>{employees.map(e => <Option key={e.id} value={e.id}>{e.full_name}</Option>)}</Select>
                    </Form.Item>
                    <Form.Item name="title" label="Tên kế hoạch" rules={[{ required: true }]}><Input placeholder="VD: Đào tạo kỹ năng lãnh đạo" /></Form.Item>
                    <Form.Item name="description" label="Mô tả"><TextArea rows={2} /></Form.Item>
                    <Row gutter={16}>
                        <Col span={12}><Form.Item name="start_date" label="Ngày bắt đầu"><DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" /></Form.Item></Col>
                        <Col span={12}><Form.Item name="target_date" label="Ngày hoàn thành"><DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" /></Form.Item></Col>
                    </Row>
                    <Form.Item name="skills" label="Kỹ năng (phân cách bởi dấu phẩy)"><Input placeholder="VD: Leadership, Communication, Problem Solving" /></Form.Item>
                    <Form.Item name="status" label="Trạng thái">
                        <Select>
                            <Option value="PLANNED">Kế hoạch</Option>
                            <Option value="IN_PROGRESS">Đang thực hiện</Option>
                            <Option value="COMPLETED">Hoàn thành</Option>
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>
        </>
    );
};

export default TrainingTab;
