import React, { useEffect, useState } from 'react';
import { Card, Table, Button, Tag, Tabs, Descriptions, Modal, Form, Input, DatePicker, message, Row, Col, Progress, Select, Typography, Space, Avatar, Tooltip } from 'antd';
import { PlusOutlined, ArrowLeftOutlined, EditOutlined, DeleteOutlined, WalletOutlined, DollarOutlined, LineChartOutlined, UserOutlined, ProjectOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import dayjs from 'dayjs';
import TaskTimer from '../components/TaskTimer';
import ProjectGantt from '../components/ProjectGantt';
import useMobile from '../hooks/useMobile';

const { Option } = Select;
const { Title, Text } = Typography;

const STATUS_COLORS: Record<string, string> = {
    PLANNING: 'default',
    ACTIVE: 'green',
    COMPLETED: 'blue',
    ARCHIVED: 'purple',
    ON_HOLD: 'orange'
};

const ProjectDetailPage: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const isMobile = useMobile();
    
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

    if (!project) return <div style={{ padding: 40, textAlign: 'center' }}>Loading Project Details...</div>;

    const items = [
        {
            key: 'overview', label: 'Overview',
            children: (
                <div style={{ animation: 'fadeIn 0.3s' }}>
                    <Descriptions 
                        title={<span style={{ color: '#1890ff' }}>Project Details</span>} 
                        bordered 
                        column={isMobile ? 1 : 2}
                        extra={<Button type="primary" ghost onClick={() => { membersForm.setFieldsValue({ member_ids: project.members?.map((m: any) => m.id) }); setIsMembersModalOpen(true); }}>Manage Members</Button>}
                        style={{ background: '#fff', borderRadius: 8, overflow: 'hidden' }}
                    >
                        <Descriptions.Item label="Manager">
                            {project.manager ? (
                                <Space>
                                    <Avatar size="small" style={{ backgroundColor: '#1890ff' }}>{project.manager.full_name.charAt(0)}</Avatar>
                                    <Text strong>{project.manager.full_name}</Text>
                                </Space>
                            ) : <Text type="secondary">Unassigned</Text>}
                        </Descriptions.Item>
                        <Descriptions.Item label="Status">
                            <Tag color={STATUS_COLORS[project.status] || 'default'} style={{ fontWeight: 600, padding: '2px 8px' }}>
                                {project.status}
                            </Tag>
                        </Descriptions.Item>
                        {project.project_type === 'SO_PROJECT' && (
                            <>
                                <Descriptions.Item label="Sales Order">
                                    <a href={`/sales?order=${project.sales_order?.id}`} style={{ fontWeight: 500 }}>{project.sales_order?.order_code}</a>
                                </Descriptions.Item>
                                <Descriptions.Item label="Customer">
                                    <Text strong>{project.sales_order?.customer?.name}</Text>
                                </Descriptions.Item>
                            </>
                        )}
                        <Descriptions.Item label="Timeline">
                            <Text>{project.start_date ? dayjs(project.start_date).format('DD/MM/YYYY') : '...'} - {project.end_date ? dayjs(project.end_date).format('DD/MM/YYYY') : '...'}</Text>
                        </Descriptions.Item>
                        <Descriptions.Item label="Members">
                            {project.members && project.members.length > 0 ? (
                                <Avatar.Group>
                                    {project.members.map((m: any) => (
                                        <Tooltip title={m.full_name} key={m.id}>
                                            <Avatar style={{ backgroundColor: '#87d068' }}>{m.full_name.charAt(0)}</Avatar>
                                        </Tooltip>
                                    ))}
                                </Avatar.Group>
                            ) : (
                                <span style={{ color: '#999', fontSize: 13 }}>Only Manager has access</span>
                            )}
                        </Descriptions.Item>
                        <Descriptions.Item label="Description" span={isMobile ? 1 : 2}>
                            <div style={{ whiteSpace: 'pre-wrap', color: '#555' }}>{project.description || <span style={{ fontStyle: 'italic', color: '#ccc' }}>No description provided.</span>}</div>
                        </Descriptions.Item>
                    </Descriptions>
                </div>
            )
        },
        {
            key: 'milestones', label: `Milestones (${milestones.length})`,
            children: (
                <div style={{ animation: 'fadeIn 0.3s' }}>
                    <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingMilestone(null); milestoneForm.resetFields(); setIsMilestoneModalOpen(true) }}>Add Milestone</Button>
                    </div>
                    <Table
                        dataSource={milestones}
                        rowKey="id"
                        scroll={{ x: 900 }}
                        columns={[
                            { title: 'Title', dataIndex: 'title', render: (t, r) => <b style={{ color: '#1f1f1f' }}>{t}</b> },
                            { title: 'Department', dataIndex: 'department', render: (d: string) => d ? <Tag color="geekblue">{d}</Tag> : '-' },
                            { title: 'Owner', dataIndex: 'owner', render: (o: any) => o?.full_name ? <Space><Avatar size="small" icon={<UserOutlined />} />{o.full_name}</Space> : '-' },
                            { title: 'Start Date', dataIndex: 'start_date', render: (d) => d ? dayjs(d).format('DD/MM/YYYY') : '-' },
                            { title: 'Due Date', dataIndex: 'due_date', render: (d) => d ? dayjs(d).format('DD/MM/YYYY') : '-' },
                            { title: 'Status', dataIndex: 'status', render: (s: string) => <Tag color={STATUS_COLORS[s] || 'default'}>{s}</Tag> },
                            {
                                title: 'Actions', key: 'act', width: 100, align: 'right' as const,
                                render: (r) => (
                                    <Space size="small">
                                        <Button type="text" size="small" icon={<EditOutlined style={{ color: '#1890ff' }} />} onClick={() => { setEditingMilestone(r); milestoneForm.setFieldsValue({ ...r, start_date: r.start_date ? dayjs(r.start_date) : null, due_date: r.due_date ? dayjs(r.due_date) : null }); setIsMilestoneModalOpen(true) }} />
                                        <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteMilestone(r.id)} />
                                    </Space>
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
                <div style={{ animation: 'fadeIn 0.3s' }}>
                    <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingTask(null); taskForm.resetFields(); setIsTaskModalOpen(true); }}>Add Project Task</Button>
                    </div>
                    <Table
                        dataSource={project.tasks || []}
                        rowKey="id"
                        scroll={{ x: 1000 }}
                        columns={[
                            { title: 'Task', dataIndex: 'title', render: (t) => <Text strong>{t}</Text> },
                            { title: 'Status', dataIndex: 'status', render: (s: string) => <Tag color={s === 'DONE' ? 'green' : s === 'IN_PROGRESS' ? 'blue' : 'default'}>{s}</Tag> },
                            { title: 'Assignee', dataIndex: 'assignee', render: (u: any) => u?.full_name ? <Space><Avatar size="small" icon={<UserOutlined />} />{u.full_name}</Space> : '-' },
                            { title: 'Est. Cost', dataIndex: 'estimated_cost', render: (c: number) => c ? <Text type="secondary">{c.toLocaleString()}đ</Text> : '-' },
                            { title: 'Act. Cost', dataIndex: 'actual_cost', render: (c: number) => c ? <Text type="danger">{c.toLocaleString()}đ</Text> : '-' },
                            { title: 'Start', dataIndex: 'start_date', render: (d: string) => d ? dayjs(d).format('DD/MM/YY') : '-' },
                            { title: 'Deadline', dataIndex: 'due_date', render: (d: string) => d ? dayjs(d).format('DD/MM/YY') : '-' },
                            {
                                title: 'Actions',
                                key: 'timer',
                                width: 140,
                                align: 'right' as const,
                                render: (r: any) => (
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
                                        <TaskTimer taskId={r.id} />
                                        <Button type="text" size="small" icon={<EditOutlined style={{ color: '#1890ff' }} />} onClick={() => {
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
                <div style={{ animation: 'fadeIn 0.3s' }}>
                    <ProjectGantt
                        tasks={project.tasks || []}
                        milestones={milestones}
                        onUpdate={fetchProject}
                    />
                </div>
            )
        },
        {
            key: 'cost', label: '💰 Cost Analysis',
            children: (
                <div style={{ animation: 'fadeIn 0.3s' }}>
                    {costSummary ? (
                        <>
                            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                                {project.project_type === 'SO_PROJECT' && (
                                    <Col xs={24} md={8}>
                                        <Card bordered={false} className="cost-card revenue-card">
                                            <div style={{ position: 'relative', zIndex: 2 }}>
                                                <Space align="center" style={{ marginBottom: 4 }}>
                                                    <WalletOutlined style={{ color: 'rgba(255,255,255,0.9)', fontSize: 16 }} />
                                                    <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: 500 }}>Doanh thu SO</div>
                                                </Space>
                                                <div style={{ color: '#fff', fontSize: 28, fontWeight: 700 }}>{Number(costSummary.so_revenue).toLocaleString()} <span style={{ fontSize: 16, fontWeight: 'normal', opacity: 0.8 }}>đ</span></div>
                                            </div>
                                            <div className="cost-blob blob-revenue"></div>
                                        </Card>
                                    </Col>
                                )}
                                <Col xs={24} md={project.project_type === 'SO_PROJECT' ? 8 : 12}>
                                    <Card bordered={false} className="cost-card cost-total-card">
                                        <div style={{ position: 'relative', zIndex: 2 }}>
                                            <Space align="center" style={{ marginBottom: 4 }}>
                                                <DollarOutlined style={{ color: 'rgba(255,255,255,0.9)', fontSize: 16 }} />
                                                <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: 500 }}>Tổng chi phí (THỰC / DỰ TOÁN)</div>
                                            </Space>
                                            <div style={{ color: '#fff', fontSize: 24, fontWeight: 700, lineHeight: 1.2 }}>
                                                {Number(costSummary.total_actual_cost).toLocaleString()} <span style={{ fontSize: 14, fontWeight: 'normal', opacity: 0.8 }}>/ {Number(costSummary.total_estimated_cost).toLocaleString()} đ</span>
                                            </div>
                                        </div>
                                        <div className="cost-blob blob-cost"></div>
                                    </Card>
                                </Col>
                                {project.project_type === 'SO_PROJECT' && (
                                    <Col xs={24} md={8}>
                                        <Card bordered={false} className={`cost-card profit-card ${Number(costSummary.profit) > 0 ? 'profit-positive' : 'profit-negative'}`}>
                                            <div style={{ position: 'relative', zIndex: 2 }}>
                                                <Space align="center" style={{ marginBottom: 4 }}>
                                                    <LineChartOutlined style={{ color: 'rgba(255,255,255,0.9)', fontSize: 16 }} />
                                                    <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: 500 }}>Lợi nhuận dự kiến</div>
                                                </Space>
                                                <div style={{ color: '#fff', fontSize: 28, fontWeight: 700 }}>{Number(costSummary.profit).toLocaleString()} <span style={{ fontSize: 16, fontWeight: 'normal', opacity: 0.8 }}>đ</span></div>
                                            </div>
                                            <div className="cost-blob blob-profit"></div>
                                        </Card>
                                    </Col>
                                )}
                            </Row>
                            
                            <Title level={5} style={{ marginBottom: 16 }}>Chi tiết thực tế theo Milestone</Title>
                            <Table
                                dataSource={costSummary.by_milestone}
                                rowKey="milestone_id"
                                pagination={false}
                                scroll={{ x: 700 }}
                                bordered
                                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}
                                columns={[
                                    { title: 'Milestone', dataIndex: 'milestone_title', render: (t, r) => <b style={{ color: '#1890ff' }}>{t}</b> },
                                    { title: 'Bộ phận', dataIndex: 'department', render: (d: string) => <Tag color="geekblue">{d}</Tag> },
                                    { title: 'Tasks (Done/Total)', render: (r) => (
                                        <Progress percent={r.task_count > 0 ? Math.round((r.done_count / r.task_count) * 100) : 0} size="small" format={() => `${r.done_count}/${r.task_count}`} />
                                    )},
                                    { title: 'Chi phí Dự toán', dataIndex: 'estimated_cost', align: 'right', render: (c: number) => <Text type="secondary">{c.toLocaleString()} đ</Text> },
                                    { title: 'Chi phí Thực tế', dataIndex: 'actual_cost', align: 'right', render: (c: number) => <Text strong type="danger">{c.toLocaleString()} đ</Text> },
                                ]}
                            />
                        </>
                    ) : (
                        <div style={{ textAlign: 'center', padding: 60, background: '#fafafa', borderRadius: 8, color: '#888' }}>
                            <DollarOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
                            <div>Không có dữ liệu chi phí</div>
                        </div>
                    )}
                </div>
            )
        }
    ];

    return (
        <div style={{ paddingBottom: 24 }}>
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/projects')} style={{ marginBottom: 16, paddingLeft: 0, fontWeight: 500 }}>Back to Projects</Button>
            
            <Card 
                bordered={false} 
                style={{ borderRadius: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}
                bodyStyle={{ padding: isMobile ? '16px' : '24px' }}
            >
                <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'linear-gradient(135deg, #1890ff 0%, #0050b3 100%)', color: '#fff', boxShadow: '0 4px 12px rgba(24,144,255,0.3)' }}>
                        <ProjectOutlined style={{ fontSize: 24 }} />
                    </div>
                    <div>
                        <Title level={4} style={{ margin: 0 }}>{project.title}</Title>
                        {project.project_type === 'SO_PROJECT' && <Tag color="magenta" style={{ marginTop: 4, border: 'none', background: '#fff0f6', color: '#eb2f96' }}>Đơn Hàng</Tag>}
                    </div>
                </div>

                <Tabs defaultActiveKey="overview" items={items} tabBarStyle={{ marginBottom: 24 }} />
            </Card>

            <Modal
                title={editingMilestone ? "Edit Milestone" : "New Milestone"}
                open={isMilestoneModalOpen}
                onCancel={() => setIsMilestoneModalOpen(false)}
                onOk={() => milestoneForm.submit()}
                centered
            >
                <Form form={milestoneForm} layout="vertical" onFinish={handleSaveMilestone} initialValues={{ status: 'PLANNING' }}>
                    <Form.Item name="title" label="Milestone Title" rules={[{ required: true }]}><Input size="large" /></Form.Item>
                    <Form.Item name="description" label="Description"><Input.TextArea rows={2} /></Form.Item>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="start_date" label="Start Date">
                                <DatePicker size="large" style={{ width: '100%' }} format="DD/MM/YYYY" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="due_date" label="Due Date">
                                <DatePicker size="large" style={{ width: '100%' }} format="DD/MM/YYYY" />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item name="status" label="Status">
                        <Select size="large">
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
                width={600}
                centered
            >
                <Form form={taskForm} layout="vertical" onFinish={handleSaveTask} initialValues={{ status: 'TODO', priority: 'MEDIUM' }}>
                    <Form.Item name="title" label="Task Title" rules={[{ required: true }]}><Input size="large" /></Form.Item>
                    <Form.Item name="description" label="Description"><Input.TextArea rows={3} /></Form.Item>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="milestone_id" label="Milestone">
                                <Select size="large" allowClear>
                                    {milestones.map(m => <Option key={m.id} value={m.id}>{m.title} ({m.status})</Option>)}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="assignee_id" label="Assignee">
                                <Select size="large" showSearch optionFilterProp="children">
                                    {users.map(u => <Option key={u.id} value={u.id}>{u.full_name}</Option>)}
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="start_date" label="Start Date">
                                <DatePicker size="large" showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="due_date" label="Due Date">
                                <DatePicker size="large" showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item name="status" label="Status">
                                <Select size="large">
                                    <Option value="TODO">To Do</Option>
                                    <Option value="IN_PROGRESS">In Progress</Option>
                                    <Option value="REVIEW">Review</Option>
                                    <Option value="DONE">Done</Option>
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="estimated_cost" label="Estimated Cost (đ)">
                                <Input size="large" type="number" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="actual_cost" label="Actual Cost (đ)">
                                <Input size="large" type="number" />
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
                centered
            >
                <Form form={membersForm} layout="vertical" onFinish={handleUpdateMembers}>
                    <Form.Item name="member_ids" label="Select Members">
                        <Select size="large" mode="multiple" placeholder="Select users" filterOption={(input, option) => (option?.children as unknown as string).toLowerCase().includes(input.toLowerCase())}>
                            {users.map(u => <Option key={u.id} value={u.id}>{u.full_name}</Option>)}
                        </Select>
                    </Form.Item>
                    <p style={{ color: '#888', fontSize: 13, marginTop: -8 }}>
                        Only members and the manager can access this project details.
                    </p>
                </Form>
            </Modal>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                
                .cost-card {
                    border-radius: 16px;
                    overflow: hidden;
                    position: relative;
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.05) !important;
                    transition: transform 0.3s ease;
                }
                .cost-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.08) !important;
                }
                
                .revenue-card { background: linear-gradient(135deg, #1890ff 0%, #0050b3 100%); }
                .cost-total-card { background: linear-gradient(135deg, #faad14 0%, #d46b08 100%); }
                .profit-positive { background: linear-gradient(135deg, #52c41a 0%, #237804 100%); }
                .profit-negative { background: linear-gradient(135deg, #ff4d4f 0%, #a8071a 100%); }
                
                .cost-blob {
                    position: absolute;
                    width: 120px;
                    height: 120px;
                    border-radius: 50%;
                    filter: blur(25px);
                    right: -20px;
                    bottom: -30px;
                    opacity: 0.2;
                    z-index: 1;
                    background: #ffffff;
                    mix-blend-mode: overlay;
                }
            `}</style>
        </div>
    );
};

export default ProjectDetailPage;
