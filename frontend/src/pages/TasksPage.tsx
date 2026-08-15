import React, { useEffect, useState } from 'react';
import { Card, Table, Button, Tag, Modal, Form, Input, Select, DatePicker, Row, Col, message, Progress, Avatar, Tooltip, Radio, Space } from 'antd';
import { PlusOutlined, EditOutlined, CheckCircleOutlined, ClockCircleOutlined, FlagOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import dayjs from 'dayjs';
import { API_URL } from '../config';
import useMobile from '../hooks/useMobile';

const { Option } = Select;

const TasksPage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [tasks, setTasks] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<any>(null);
    const [form] = Form.useForm();
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [highlightTaskId, setHighlightTaskId] = useState<number | null>(null);
    const [projects, setProjects] = useState<any[]>([]);
    const [selectedProject, setSelectedProject] = useState<number | null>(null);
    const isMobile = useMobile();

    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

    const fetchData = async () => {
        setLoading(true);
        try {
            const [resTasks, resUsers, resProjects] = await Promise.all([
                api.get('/tasks'),
                api.get('/users'),
                api.get('/projects')
            ]);
            setTasks(resTasks.data);
            setUsers(resUsers.data);
            setProjects(resProjects.data);
        } catch (e) { }
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    // Handle URL params from notifications (deep linking)
    useEffect(() => {
        const taskId = searchParams.get('task');

        if (taskId && tasks.length > 0) {
            const id = parseInt(taskId);
            const found = tasks.find((t: any) => t.id === id);

            if (found) {
                // Open the task edit modal directly
                setEditingTask(found);
                setSelectedProject(found.project_id || null);
                form.setFieldsValue({
                    ...found,
                    due_date: found.due_date ? dayjs(found.due_date) : null
                });
                setIsModalOpen(true);
            }

            // Also highlight the row for visual feedback
            setHighlightTaskId(id);
            setTimeout(() => {
                const element = document.getElementById(`task-row-${id}`);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 500);
            setTimeout(() => setHighlightTaskId(null), 3000);

            // Clear URL params
            setSearchParams({});
        }
    }, [searchParams, tasks]);

    const handleSave = async (values: any) => {
        try {
            const payload = {
                ...values,
                creator_id: currentUser.id,
                due_date: values.due_date ? values.due_date.toISOString() : null
            };

            if (editingTask) {
                await api.put(`/tasks/${editingTask.id}`, payload);
                message.success('Cập nhật thành công');
            } else {
                await api.post('/tasks', payload);
                message.success('Tạo công việc thành công');
            }
            setIsModalOpen(false);
            fetchData();
        } catch (e) { message.error('Lỗi lưu'); }
    };

    const handleDelete = async (id: number) => {
        try { await api.delete(`/tasks/${id}`); message.success('Đã xóa'); fetchData(); }
        catch (e) { message.error('Lỗi xóa'); }
    };

    const getPriorityColor = (p: string) => {
        if (p === 'URGENT') return 'red';
        if (p === 'HIGH') return 'orange';
        if (p === 'MEDIUM') return 'blue';
        return 'green';
    };

    const columns = [
        {
            title: 'Trạng thái', dataIndex: 'status', width: 120,
            render: (s: string) => (
                <Tag color={s === 'DONE' ? 'green' : s === 'IN_PROGRESS' ? 'processing' : 'default'}>
                    {s === 'DONE' ? 'Hoàn thành' : s === 'IN_PROGRESS' ? 'Đang làm' : 'Cần làm'}
                </Tag>
            )
        },
        {
            title: 'Công việc', dataIndex: 'title',
            render: (t: string, r: any) => (
                <div>
                    <div style={{ fontWeight: 'bold', fontSize: 15 }}>{t}</div>
                    <div style={{ color: '#888', fontSize: 12 }}>{r.description}</div>
                </div>
            )
        },
        {
            title: 'Mức độ', dataIndex: 'priority', width: 100, align: 'center' as const,
            render: (p: string) => <Tag color={getPriorityColor(p)} icon={<FlagOutlined />}>{p}</Tag>
        },
        {
            title: 'Hạn chót (Reminder)', dataIndex: 'due_date', width: 150,
            render: (d: any) => {
                if (!d) return '-';
                const isOverdue = dayjs().isAfter(dayjs(d));
                return <span style={{ color: isOverdue ? 'red' : 'inherit' }}><ClockCircleOutlined /> {dayjs(d).format('DD/MM/YY HH:mm')}</span>
            }
        },
        {
            title: 'Người thực hiện', dataIndex: 'assignee', width: 130,
            render: (u: any) => u ? <Tag color="blue">{u.full_name}</Tag> : <Tag>Chưa gán</Tag>
        },
        {
            title: 'Dự toán', dataIndex: 'estimated_cost', width: 110,
            render: (c: number) => c ? c.toLocaleString() : '-'
        },
        {
            title: 'Thực tế', dataIndex: 'actual_cost', width: 110,
            render: (c: number) => c ? c.toLocaleString() : '-'
        },
        {
            title: 'Người tạo', dataIndex: 'creator', width: 130,
            render: (u: any) => u ? <Tag color="purple">{u.full_name}</Tag> : <Tag>-</Tag>
        },
        {
            title: 'Dự án / Milestone', dataIndex: 'project',
            render: (p: any, r: any) => (
                <div>
                    {p ? <Tag color="cyan">{p.title}</Tag> : <span style={{ color: '#ccc' }}>-</span>}
                    {r.milestone && <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{r.milestone.title}</div>}
                </div>
            )
        },
        {
            title: '', key: 'act', width: 100, align: 'right' as const,
            render: (r: any) => (
                <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
                    <Button size="small" icon={<EditOutlined />} onClick={() => {
                        setEditingTask(r);
                        setSelectedProject(r.project_id || null);
                        form.setFieldsValue({ ...r, due_date: r.due_date ? dayjs(r.due_date) : null });
                        setIsModalOpen(true);
                    }} />
                    <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r.id)} />
                </div>
            )
        }
    ];

    const filteredTasks = filterStatus === 'ALL' ? tasks : tasks.filter(t => t.status === filterStatus);

    return (
        <div style={{ paddingBottom: 20 }}>
            <Card
                bodyStyle={{ padding: isMobile ? '8px 12px' : undefined }}
                title={<span style={{ fontSize: isMobile ? 14 : 16 }}>Công Việc</span>}
                extra={
                    isMobile ? (
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingTask(null); form.resetFields(); setIsModalOpen(true) }} />
                    ) : (
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingTask(null); form.resetFields(); setIsModalOpen(true) }}>Thêm Công Việc</Button>
                    )
                }
            >
                <div style={{ marginBottom: 16, overflowX: isMobile ? 'auto' : 'visible' }}>
                    <Radio.Group value={filterStatus} onChange={e => setFilterStatus(e.target.value)} buttonStyle="solid" size={isMobile ? 'small' : 'middle'}>
                        <Radio.Button value="ALL">Tất cả</Radio.Button>
                        <Radio.Button value="TODO">Cần làm</Radio.Button>
                        <Radio.Button value="IN_PROGRESS">{isMobile ? 'Đang XL' : 'Đang thực hiện'}</Radio.Button>
                        <Radio.Button value="DONE">{isMobile ? 'Xong' : 'Hoàn thành'}</Radio.Button>
                    </Radio.Group>
                </div>
                <Table
                    dataSource={filteredTasks}
                    columns={columns}
                    rowKey="id"
                    loading={loading}
                    scroll={{ x: isMobile ? 600 : undefined }}
                    onRow={(record: any) => ({
                        id: `task-row-${record.id}`
                    })}
                    rowClassName={(record: any) =>
                        highlightTaskId === record.id ? 'highlight-row' : ''
                    }
                />
            </Card>

            <Modal
                title={editingTask ? "Cập nhật Công Việc" : "Thêm Công Việc Mới"}
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                onOk={() => form.submit()}
            >
                <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ priority: 'MEDIUM', status: 'TODO' }}>
                    <Form.Item name="title" label="Tên công việc" rules={[{ required: true }]}><Input /></Form.Item>
                    <Form.Item name="description" label="Mô tả chi tiết"><Input.TextArea rows={3} /></Form.Item>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="priority" label="Mức độ ưu tiên">
                                <Select>
                                    <Option value="LOW">Thấp</Option>
                                    <Option value="MEDIUM">Trung bình</Option>
                                    <Option value="HIGH">Cao</Option>
                                    <Option value="URGENT">Khẩn cấp</Option>
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="status" label="Trạng thái">
                                <Select>
                                    <Option value="TODO">Cần làm</Option>
                                    <Option value="IN_PROGRESS">Đang thực hiện</Option>
                                    <Option value="REVIEW">Chờ duyệt</Option>
                                    <Option value="DONE">Hoàn thành</Option>
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="project_id" label="Dự án">
                                <Select allowClear placeholder="Chọn dự án..." onChange={(val) => {
                                    setSelectedProject(val);
                                    form.setFieldsValue({ milestone_id: undefined });
                                }}>
                                    {projects.map(p => <Option key={p.id} value={p.id}>{p.title}</Option>)}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="milestone_id" label="Milestone">
                                <Select allowClear placeholder="Chọn milestone..." disabled={!selectedProject}>
                                    {selectedProject && projects.find(p => p.id === selectedProject)?.milestones?.map((m: any) =>
                                        <Option key={m.id} value={m.id}>{m.title}</Option>
                                    )}
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="assignee_id" label="Giao cho ai?">
                                <Select showSearch optionFilterProp="children">
                                    {users.map(u => <Option key={u.id} value={u.id}>{u.full_name} ({u.username})</Option>)}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="due_date" label="Hạn chót (Sẽ nhắc nhở)">
                                <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="estimated_cost" label="Chi phí dự toán (đ)">
                                <Input type="number" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="actual_cost" label="Chi phí thực tế (đ)">
                                <Input type="number" />
                            </Form.Item>
                        </Col>
                    </Row>
                    
                    <Form.Item name="cost_note" label="Ghi chú chi phí"><Input.TextArea rows={2} /></Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default TasksPage;