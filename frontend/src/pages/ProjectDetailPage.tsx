import React, { useEffect, useState } from 'react';
import { Card, Table, Button, Tag, Tabs, Descriptions, Modal, Form, Input, DatePicker, message, Row, Col, Progress, Select } from 'antd';
import { PlusOutlined, ArrowLeftOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import dayjs from 'dayjs';
import TaskTimer from '../components/TaskTimer';
import ProjectGantt from '../components/ProjectGantt';

const { Option } = Select;

const ProjectDetailPage: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [project, setProject] = useState<any>(null);
    const [costSummary, setCostSummary] = useState<any>(null);
    const [milestones, setMilestones] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Task Modal
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<any>(null);
    const [taskForm] = Form.useForm();

    // Milestone Modal
    const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);
    const [editingMilestone, setEditingMilestone] = useState<any>(null);
    const [milestoneForm] = Form.useForm();

    // Members Modal
    const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
    const [membersForm] = Form.useForm();

    const fetchProject = async () => {
        setLoading(true);
        try {
            const [resProject, resUsers, resCostSummary] = await Promise.all([
                api.get(`/projects/${id}`),
                api.get('/users'),
                api.get(`/projects/${id}/cost-summary`).catch(() => ({ data: null }))
            ]);
            setProject(resProject.data);
            setMilestones(resProject.data.milestones || []);
            setUsers(resUsers.data);
            if (resCostSummary.data) setCostSummary(resCostSummary.data);
        } catch (e) { message.error('Failed to load project data'); }
        setLoading(false);
    };

    useEffect(() => { fetchProject(); }, [id]);

    const handleSaveMilestone = async (values: any) => {
        try {
            const payload = {
                ...values,
                start_date: values.start_date ? values.start_date.toISOString() : null,
                due_date: values.due_date ? values.due_date.toISOString() : null
            };

            if (editingMilestone) {
                await api.put(`/projects/milestones/${editingMilestone.id}`, payload);
                message.success('Milestone updated');
            } else {
                await api.post(`/projects/${id}/milestones`, payload);
                message.success('Milestone created');
            }
            setIsMilestoneModalOpen(false);
            fetchProject();
        } catch (e) { message.error('Failed to save milestone'); }
    };

    const handleDeleteMilestone = async (mId: number) => {
        if (!window.confirm('Delete this milestone?')) return;
        try {
            await api.delete(`/projects/milestones/${mId}`);
            message.success('Milestone deleted');
            fetchProject();
        } catch (e: any) { message.error('Failed to delete'); }
    };

    const handleSaveTask = async (values: any) => {
        try {
            const payload = {
                ...values,
                project_id: parseInt(id!),
                start_date: values.start_date ? values.start_date.toISOString() : null,
                due_date: values.due_date ? values.due_date.toISOString() : null
            };
            
            if (editingTask) {
                await api.put(`/tasks/${editingTask.id}`, payload);
                message.success('Task updated successfully');
            } else {
                await api.post('/tasks', payload);
                message.success('Task created successfully');
            }
            
            setIsTaskModalOpen(false);
            taskForm.resetFields();
            fetchProject(); // Reload to see new task
        } catch (e) { message.error('Failed to save task'); }
    };

    const handleUpdateMembers = async (values: any) => {
        try {
            await api.put(`/projects/${id}`, { member_ids: values.member_ids });
            message.success('Members updated');
            setIsMembersModalOpen(false);
            fetchProject();
        } catch (e) { message.error('Failed to update members'); }
    };

    if (!project) return <div>Loading...</div>;

    const items = [
        {
            key: 'overview', label: 'Overview',
            children: (
                <div>
                    <Descriptions title="Project Details" bordered extra={<Button onClick={() => { membersForm.setFieldsValue({ member_ids: project.members?.map((m: any) => m.id) }); setIsMembersModalOpen(true); }}>Manage Members</Button>}>
                        <Descriptions.Item label="Manager">{project.manager?.full_name}</Descriptions.Item>
                        <Descriptions.Item label="Status"><Tag color="blue">{project.status}</Tag></Descriptions.Item>
                        {project.project_type === 'SO_PROJECT' && (
                            <>
                                <Descriptions.Item label="Sales Order">
                                    <a href={`/sales?order=${project.sales_order?.id}`}>{project.sales_order?.order_code}</a>
                                </Descriptions.Item>
                                <Descriptions.Item label="Customer">{project.sales_order?.customer?.name}</Descriptions.Item>
                            </>
                        )}
                        <Descriptions.Item label="Timeline">
                            {project.start_date ? dayjs(project.start_date).format('DD/MM/YYYY') : '...'} - {project.end_date ? dayjs(project.end_date).format('DD/MM/YYYY') : '...'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Members" span={3}>
                            {project.members && project.members.length > 0 ? (
                                project.members.map((m: any) => <Tag key={m.id} color="cyan">{m.full_name}</Tag>)
                            ) : (
                                <span style={{ color: '#999' }}>No members assigned (Only Manager has access)</span>
                            )}
                        </Descriptions.Item>
                        <Descriptions.Item label="Description" span={3}>{project.description}</Descriptions.Item>
                    </Descriptions>
                </div>
            )
        },
        {
            key: 'milestones', label: `Milestones (${milestones.length})`,
            children: (
                <div>
                    <div style={{ marginBottom: 16 }}>
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingMilestone(null); milestoneForm.resetFields(); setIsMilestoneModalOpen(true) }}>Add Milestone</Button>
                    </div>
                    <Table
                        dataSource={milestones}
                        rowKey="id"
                        columns={[
                            { title: 'Title', dataIndex: 'title', render: (t, r) => <b>{t}</b> },
                            { title: 'Department', dataIndex: 'department', render: (d: string) => d ? <Tag>{d}</Tag> : '-' },
                            { title: 'Owner', dataIndex: 'owner', render: (o: any) => o?.full_name || '-' },
                            { title: 'Start Date', dataIndex: 'start_date', render: (d) => d ? dayjs(d).format('DD/MM/YYYY') : '-' },
                            { title: 'Due Date', dataIndex: 'due_date', render: (d) => d ? dayjs(d).format('DD/MM/YYYY') : '-' },
                            { title: 'Status', dataIndex: 'status', render: (s: string) => <Tag color={s === 'ACTIVE' ? 'green' : s === 'COMPLETED' ? 'blue' : 'default'}>{s}</Tag> },
                            {
                                title: '', key: 'act', width: 100, align: 'right' as const,
                                render: (r) => (
                                    <>
                                        <Button size="small" icon={<EditOutlined />} onClick={() => { setEditingMilestone(r); milestoneForm.setFieldsValue({ ...r, start_date: r.start_date ? dayjs(r.start_date) : null, due_date: r.due_date ? dayjs(r.due_date) : null }); setIsMilestoneModalOpen(true) }} />
                                        <Button size="small" danger icon={<DeleteOutlined />} style={{ marginLeft: 5 }} onClick={() => handleDeleteMilestone(r.id)} />
                                    </>
                                )
                            }
                        ]}
                    />
                </div>
            )
        },
        {
            key: 'tasks', label: `Tasks (${project.tasks?.length || 0})`,
            children: (
                <div>
                    <div style={{ marginBottom: 16 }}>
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingTask(null); taskForm.resetFields(); setIsTaskModalOpen(true); }}>Add Project Task</Button>
                    </div>
                    <Table
                        dataSource={project.tasks || []}
                        rowKey="id"
                        columns={[
                            { title: 'Task', dataIndex: 'title' },
                            { title: 'Status', dataIndex: 'status', render: (s: string) => <Tag>{s}</Tag> },
                            { title: 'Assignee', dataIndex: 'assignee', render: (u: any) => u?.full_name },
                            { title: 'Est. Cost', dataIndex: 'estimated_cost', render: (c: number) => c ? c.toLocaleString() : '-' },
                            { title: 'Act. Cost', dataIndex: 'actual_cost', render: (c: number) => c ? c.toLocaleString() : '-' },
                            { title: 'Start', dataIndex: 'start_date', render: (d: string) => d ? dayjs(d).format('DD/MM/YY') : '-' },
                            { title: 'Deadline', dataIndex: 'due_date', render: (d: string) => d ? dayjs(d).format('DD/MM/YY') : '-' },
                            {
                                title: 'Timer / Action',
                                key: 'timer',
                                width: 150,
                                render: (r: any) => (
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <TaskTimer taskId={r.id} />
                                        <Button size="small" icon={<EditOutlined />} onClick={() => {
                                            setEditingTask(r);
                                            taskForm.setFieldsValue({
                                                ...r,
                                                start_date: r.start_date ? dayjs(r.start_date) : null,
                                                due_date: r.due_date ? dayjs(r.due_date) : null
                                            });
                                            setIsTaskModalOpen(true);
                                        }} />
                                    </div>
                                )
                            }
                        ]}
                    />
                </div>
            )
        },
        {
            key: 'gantt', label: 'Timeline (Gantt)',
            children: (
                <ProjectGantt
                    tasks={project.tasks || []}
                    milestones={milestones}
                    onUpdate={fetchProject}
                />
            )
        },
        {
            key: 'cost', label: '💰 Chi phí (Cost Analysis)',
            children: (
                <div>
                    {costSummary ? (
                        <>
                            <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                                {project.project_type === 'SO_PROJECT' && (
                                    <Col span={8}>
                                        <Card size="small" style={{ background: '#e6f7ff', borderColor: '#91d5ff' }}>
                                            <div style={{ color: '#1890ff', fontSize: 13 }}>Doanh thu SO</div>
                                            <div style={{ fontSize: 20, fontWeight: 'bold' }}>{Number(costSummary.so_revenue).toLocaleString()} đ</div>
                                        </Card>
                                    </Col>
                                )}
                                <Col span={project.project_type === 'SO_PROJECT' ? 8 : 12}>
                                    <Card size="small" style={{ background: '#fffbe6', borderColor: '#ffe58f' }}>
                                        <div style={{ color: '#faad14', fontSize: 13 }}>Tổng chi phí (THỰC TẾ / DỰ TOÁN)</div>
                                        <div style={{ fontSize: 20, fontWeight: 'bold' }}>
                                            {Number(costSummary.total_actual_cost).toLocaleString()} / {Number(costSummary.total_estimated_cost).toLocaleString()} đ
                                        </div>
                                    </Card>
                                </Col>
                                {project.project_type === 'SO_PROJECT' && (
                                    <Col span={8}>
                                        <Card size="small" style={{ background: Number(costSummary.profit) > 0 ? '#f6ffed' : '#fff1f0', borderColor: Number(costSummary.profit) > 0 ? '#b7eb8f' : '#ffa39e' }}>
                                            <div style={{ color: Number(costSummary.profit) > 0 ? '#52c41a' : '#f5222d', fontSize: 13 }}>Lợi nhuận dự kiến</div>
                                            <div style={{ fontSize: 20, fontWeight: 'bold' }}>{Number(costSummary.profit).toLocaleString()} đ</div>
                                        </Card>
                                    </Col>
                                )}
                            </Row>
                            
                            <h4>Chi tiết thực tế theo Milestone</h4>
                            <Table
                                dataSource={costSummary.by_milestone}
                                rowKey="milestone_id"
                                pagination={false}
                                columns={[
                                    { title: 'Milestone', dataIndex: 'milestone_title', render: (t, r) => <b>{t}</b> },
                                    { title: 'Bộ phận', dataIndex: 'department', render: (d: string) => <Tag>{d}</Tag> },
                                    { title: 'Tasks', render: (r) => `${r.done_count}/${r.task_count}` },
                                    { title: 'Chi phí Dự toán', dataIndex: 'estimated_cost', render: (c: number) => c.toLocaleString() },
                                    { title: 'Chi phí Thực tế', dataIndex: 'actual_cost', render: (c: number) => <b>{c.toLocaleString()}</b> },
                                ]}
                            />
                        </>
                    ) : (
                        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>Không có dữ liệu chi phí</div>
                    )}
                </div>
            )
        }
    ];

    return (
        <div style={{ paddingBottom: 20 }}>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/projects')} style={{ marginBottom: 16 }}>Back to Projects</Button>
            <Card title={project.title}>
                <Tabs defaultActiveKey="overview" items={items} />
            </Card>

            <Modal
                title={editingMilestone ? "Edit Milestone" : "New Milestone"}
                open={isMilestoneModalOpen}
                onCancel={() => setIsMilestoneModalOpen(false)}
                onOk={() => milestoneForm.submit()}
            >
                <Form form={milestoneForm} layout="vertical" onFinish={handleSaveMilestone} initialValues={{ status: 'PLANNING' }}>
                    <Form.Item name="title" label="Milestone Title" rules={[{ required: true }]}><Input /></Form.Item>
                    <Form.Item name="description" label="Description"><Input.TextArea rows={2} /></Form.Item>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="start_date" label="Start Date">
                                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="due_date" label="Due Date">
                                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item name="status" label="Status">
                        <Select>
                            <Option value="PLANNING">Planning</Option>
                            <Option value="ACTIVE">Active</Option>
                            <Option value="COMPLETED">Completed</Option>
                            <Option value="ARCHIVED">Archived</Option>
                            <Option value="ON_HOLD">On Hold</Option>
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title={editingTask ? "Edit Task" : "Create New Task for Project"}
                open={isTaskModalOpen}
                onCancel={() => setIsTaskModalOpen(false)}
                onOk={() => taskForm.submit()}
            >
                <Form form={taskForm} layout="vertical" onFinish={handleSaveTask} initialValues={{ status: 'TODO', priority: 'MEDIUM' }}>
                    <Form.Item name="title" label="Task Title" rules={[{ required: true }]}><Input /></Form.Item>
                    <Form.Item name="description" label="Description"><Input.TextArea rows={3} /></Form.Item>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="milestone_id" label="Milestone">
                                <Select allowClear>
                                    {milestones.map(m => <Option key={m.id} value={m.id}>{m.title} ({m.status})</Option>)}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="assignee_id" label="Assignee">
                                <Select showSearch optionFilterProp="children">
                                    {users.map(u => <Option key={u.id} value={u.id}>{u.full_name}</Option>)}
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="start_date" label="Start Date">
                                <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="due_date" label="Due Date">
                                <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item name="status" label="Status">
                                <Select>
                                    <Option value="TODO">To Do</Option>
                                    <Option value="IN_PROGRESS">In Progress</Option>
                                    <Option value="REVIEW">Review</Option>
                                    <Option value="DONE">Done</Option>
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="estimated_cost" label="Estimated Cost (đ)">
                                <Input type="number" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="actual_cost" label="Actual Cost (đ)">
                                <Input type="number" />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item name="cost_note" label="Cost Note"><Input.TextArea rows={2} /></Form.Item>
                </Form>
            </Modal>

            <Modal
                title="Manage Project Members"
                open={isMembersModalOpen}
                onCancel={() => setIsMembersModalOpen(false)}
                onOk={() => membersForm.submit()}
            >
                <Form form={membersForm} layout="vertical" onFinish={handleUpdateMembers}>
                    <Form.Item name="member_ids" label="Select Members">
                        <Select mode="multiple" placeholder="Select users" filterOption={(input, option) => (option?.children as unknown as string).toLowerCase().includes(input.toLowerCase())}>
                            {users.map(u => <Option key={u.id} value={u.id}>{u.full_name}</Option>)}
                        </Select>
                    </Form.Item>
                    <p style={{ color: '#888', fontSize: 12 }}>
                        Only members and the manager can access this project details.
                    </p>
                </Form>
            </Modal>
        </div>
    );
};

export default ProjectDetailPage;
