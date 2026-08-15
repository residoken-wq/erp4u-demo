import React, { useEffect, useState, useMemo } from 'react';
import { Card, Table, Button, Tag, Modal, Form, Input, Select, DatePicker, message, Row, Col, Progress, Statistic, List, Avatar, Tooltip, Space, Radio, Typography, Dropdown, Menu } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, FolderOutlined, RightOutlined, ProjectOutlined, CheckCircleOutlined, ClockCircleOutlined, AppstoreOutlined, BarsOutlined, SearchOutlined, UserOutlined, MoreOutlined, EllipsisOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import dayjs from 'dayjs';
import useMobile from '../hooks/useMobile';

const { Option } = Select;
const { Title, Text } = Typography;
const { Search } = Input;

const STATUS_COLORS: Record<string, string> = {
    PLANNING: 'default',
    ACTIVE: 'green',
    COMPLETED: 'blue',
    ARCHIVED: 'purple',
    ON_HOLD: 'orange'
};

const STATUS_LABELS: Record<string, string> = {
    PLANNING: 'Planning',
    ACTIVE: 'Active',
    COMPLETED: 'Completed',
    ARCHIVED: 'Archived',
    ON_HOLD: 'On Hold'
};

const ProjectsPage: React.FC = () => {
    const [projects, setProjects] = useState<any[]>([]);
    const [managers, setManagers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<any>(null);
    const [form] = Form.useForm();

    // UI State
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [searchText, setSearchText] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('ALL');
    const [filterType, setFilterType] = useState<string>('ALL'); // Add Type Filter

    const navigate = useNavigate();
    const isMobile = useMobile();

    const fetchData = async () => {
        setLoading(true);
        try {
            const [resProjects, resUsers] = await Promise.all([
                api.get('/projects'),
                api.get('/users')
            ]);
            setProjects(resProjects.data);
            setManagers(resUsers.data);
        } catch (e) { message.error('Failed to load projects'); }
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    const handleSave = async (values: any) => {
        try {
            const payload = {
                ...values,
                start_date: values.start_date ? values.start_date.toISOString() : null,
                end_date: values.end_date ? values.end_date.toISOString() : null
            };

            if (editingProject) {
                await api.put(`/projects/${editingProject.id}`, payload);
                message.success('Project updated');
            } else {
                await api.post('/projects', payload);
                message.success('Project created');
            }
            setIsModalOpen(false);
            fetchData();
        } catch (e) { message.error('Failed to save project'); }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Are you sure you want to delete this project?')) return;
        try {
            await api.delete(`/projects/${id}`);
            message.success('Project deleted');
            fetchData();
        } catch (e) { message.error('Failed to delete'); }
    };

    // Calculate Statistics
    const stats = useMemo(() => {
        return {
            total: projects.length,
            active: projects.filter(p => p.status === 'ACTIVE').length,
            completed: projects.filter(p => p.status === 'COMPLETED').length,
            planning: projects.filter(p => p.status === 'PLANNING').length,
        };
    }, [projects]);

    // Filter projects
    const filteredProjects = useMemo(() => {
        return projects.filter(p => {
            const matchSearch = p.title?.toLowerCase().includes(searchText.toLowerCase()) ||
                p.manager?.full_name?.toLowerCase().includes(searchText.toLowerCase());
            const matchStatus = filterStatus === 'ALL' || p.status === filterStatus;
            const matchType = filterType === 'ALL' || p.project_type === filterType;
            return matchSearch && matchStatus && matchType;
        });
    }, [projects, searchText, filterStatus, filterType]);

    // Generate Avatar initial
    const getInitials = (name?: string) => {
        if (!name) return '?';
        const parts = name.split(' ');
        if (parts.length > 1) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        return name.substring(0, 2).toUpperCase();
    };

    // Calculate dummy progress based on status if real tasks are not available
    const getProgress = (p: any) => {
        if (p.status === 'COMPLETED') return 100;
        if (p.status === 'ACTIVE') return 45; // Placeholder
        if (p.status === 'PLANNING') return 10; // Placeholder
        return 0;
    };

    const columns = [
        {
            title: 'Project Name', dataIndex: 'title',
            render: (t: string, r: any) => (
                <div style={{ cursor: 'pointer', color: '#1890ff', fontWeight: 500 }} onClick={() => navigate(`/projects/${r.id}`)}>
                    <FolderOutlined style={{ marginRight: 8 }} />
                    {r.project_type === 'SO_PROJECT' && <Tag color="megenta">Đơn Hàng</Tag>}
                    {t}
                </div>
            )
        },
        {
            title: 'Manager', dataIndex: 'manager',
            render: (u: any) => u ? (
                <Space>
                    <Avatar size="small" style={{ backgroundColor: '#1890ff' }}>{getInitials(u.full_name)}</Avatar>
                    <Text>{u.full_name}</Text>
                </Space>
            ) : <Tag>Unassigned</Tag>
        },
        {
            title: 'Status', dataIndex: 'status',
            render: (s: string) => <Tag color={STATUS_COLORS[s] || 'default'}>{STATUS_LABELS[s] || s}</Tag>
        },
        {
            title: 'Timeline',
            render: (r: any) => (
                <div style={{ fontSize: 13, color: '#666' }}>
                    {r.start_date ? dayjs(r.start_date).format('DD/MM/YY') : 'TBD'} &rarr; {r.end_date ? dayjs(r.end_date).format('DD/MM/YY') : 'TBD'}
                </div>
            )
        },
        {
            title: 'Progress',
            render: (r: any) => <Progress percent={getProgress(r)} size="small" status={r.status === 'ACTIVE' ? 'active' : 'normal'} />
        },
        {
            title: '', key: 'action', width: 60, align: 'right' as const,
            render: (r: any) => {
                const menu = (
                    <Menu>
                        <Menu.Item key="1" icon={<EditOutlined />} onClick={() => {
                            setEditingProject(r);
                            form.setFieldsValue({ ...r, start_date: r.start_date ? dayjs(r.start_date) : null, end_date: r.end_date ? dayjs(r.end_date) : null });
                            setIsModalOpen(true);
                        }}>
                            Edit Project
                        </Menu.Item>
                        <Menu.Divider />
                        <Menu.Item key="2" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r.id)}>
                            Delete Project
                        </Menu.Item>
                    </Menu>
                );
                return (
                    <div onClick={(e) => e.stopPropagation()}>
                        <Dropdown overlay={menu} trigger={['click']}>
                            <Button type="text" icon={<EllipsisOutlined style={{ fontSize: 18 }} />} />
                        </Dropdown>
                    </div>
                );
            }
        }
    ];

    return (
        <div style={{ paddingBottom: 24 }}>
            {/* Top Statistics Row */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={12} sm={12} md={6}>
                    <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                        <Statistic
                            title="Total Projects"
                            value={stats.total}
                            valueStyle={{ color: '#1890ff', fontWeight: 'bold' }}
                            prefix={<ProjectOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={12} md={6}>
                    <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                        <Statistic
                            title="Active"
                            value={stats.active}
                            valueStyle={{ color: '#52c41a', fontWeight: 'bold' }}
                            prefix={<CheckCircleOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={12} md={6}>
                    <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                        <Statistic
                            title="In Planning"
                            value={stats.planning}
                            valueStyle={{ color: '#faad14', fontWeight: 'bold' }}
                            prefix={<ClockCircleOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={12} md={6}>
                    <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                        <Statistic
                            title="Completed"
                            value={stats.completed}
                            valueStyle={{ color: '#2f54eb', fontWeight: 'bold' }}
                            prefix={<CheckCircleOutlined />}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Main Content Card */}
            <Card
                bordered={false}
                style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
                bodyStyle={{ padding: '20px 24px' }}
            >
                {/* Toolbar */}
                <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
                    <Col xs={24} md={12} style={{ display: 'flex', gap: 12, marginBottom: isMobile ? 16 : 0 }}>
                        <Search
                            placeholder="Search by name or manager..."
                            allowClear
                            onChange={(e) => setSearchText(e.target.value)}
                            style={{ width: 250 }}
                        />
                        <Select
                            defaultValue="ALL"
                            style={{ width: 140 }}
                            onChange={(val) => setFilterType(val)}
                        >
                            <Option value="ALL">All Types</Option>
                            <Option value="SO_PROJECT">SO Project</Option>
                            <Option value="GENERAL">General Project</Option>
                        </Select>
                        <Select
                            defaultValue="ALL"
                            style={{ width: 140 }}
                            onChange={(val) => setFilterStatus(val)}
                        >
                            <Option value="ALL">All Status</Option>
                            <Option value="PLANNING">Planning</Option>
                            <Option value="ACTIVE">Active</Option>
                            <Option value="COMPLETED">Completed</Option>
                            <Option value="ON_HOLD">On Hold</Option>
                        </Select>
                    </Col>
                    <Col xs={24} md={12} style={{ textAlign: isMobile ? 'left' : 'right', display: 'flex', justifyContent: isMobile ? 'flex-start' : 'flex-end', gap: 12 }}>
                        <Radio.Group value={viewMode} onChange={(e) => setViewMode(e.target.value)} buttonStyle="solid">
                            <Radio.Button value="grid"><AppstoreOutlined /></Radio.Button>
                            <Radio.Button value="list"><BarsOutlined /></Radio.Button>
                        </Radio.Group>
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => {
                            setEditingProject(null);
                            form.resetFields();
                            setIsModalOpen(true);
                        }}>
                            New Project
                        </Button>
                    </Col>
                </Row>

                {/* Content View */}
                {viewMode === 'list' ? (
                    <Table
                        dataSource={filteredProjects}
                        columns={columns}
                        rowKey="id"
                        loading={loading}
                        pagination={{ pageSize: 15 }}
                        onRow={(record) => ({
                            onClick: () => navigate(`/projects/${record.id}`)
                        })}
                        style={{ cursor: 'pointer' }}
                    />
                ) : (
                    <List
                        grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 3, xl: 4, xxl: 4 }}
                        dataSource={filteredProjects}
                        loading={loading}
                        renderItem={r => (
                            <List.Item>
                                <Card
                                    hoverable
                                    className="project-card"
                                    onClick={() => navigate(`/projects/${r.id}`)}
                                    style={{ borderRadius: 12, border: '1px solid #f0f0f0', height: '100%', display: 'flex', flexDirection: 'column' }}
                                    bodyStyle={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column' }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                            <Avatar size={40} style={{ backgroundColor: '#e6f7ff', color: '#1890ff', flexShrink: 0 }}>
                                                <FolderOutlined style={{ fontSize: 20 }} />
                                            </Avatar>
                                            <div style={{ overflow: 'hidden' }}>
                                                <Title level={5} style={{ margin: 0, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.title}>
                                                    {r.project_type === 'SO_PROJECT' && <Tag color="magenta">Đơn Hàng</Tag>}
                                                    {r.title}
                                                </Title>
                                                <Text type="secondary" style={{ fontSize: 12 }}>
                                                    {r.start_date ? dayjs(r.start_date).format('MMM DD') : 'TBD'} &rarr; {r.end_date ? dayjs(r.end_date).format('MMM DD') : 'TBD'}
                                                </Text>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ marginBottom: 16, marginTop: 'auto' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <Text type="secondary" style={{ fontSize: 13 }}>Progress</Text>
                                            <Text strong style={{ fontSize: 13 }}>{getProgress(r)}%</Text>
                                        </div>
                                        <Progress percent={getProgress(r)} showInfo={false} size="small" status={r.status === 'ACTIVE' ? 'active' : 'normal'} strokeColor={STATUS_COLORS[r.status] === 'default' ? undefined : STATUS_COLORS[r.status]} />
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f0f0f0', paddingTop: 16, marginTop: 8 }}>
                                        <Space>
                                            <Tooltip title={r.manager?.full_name || 'Unassigned Manager'}>
                                                {r.manager ? (
                                                    <Avatar size="small" style={{ backgroundColor: '#1890ff' }}>{getInitials(r.manager.full_name)}</Avatar>
                                                ) : (
                                                    <Avatar size="small" icon={<UserOutlined />} />
                                                )}
                                            </Tooltip>
                                            {(r.members?.length > 0) && (
                                                <Avatar.Group maxCount={3} size="small" maxStyle={{ color: '#f56a00', backgroundColor: '#fde3cf' }}>
                                                    {r.members.map((m: any) => (
                                                        <Tooltip title={m.full_name} key={m.id}>
                                                            <Avatar style={{ backgroundColor: '#87d068' }}>{getInitials(m.full_name)}</Avatar>
                                                        </Tooltip>
                                                    ))}
                                                </Avatar.Group>
                                            )}
                                        </Space>
                                        <Tag color={STATUS_COLORS[r.status] || 'default'} style={{ margin: 0 }}>
                                            {STATUS_LABELS[r.status] || r.status}
                                        </Tag>
                                    </div>
                                </Card>
                            </List.Item>
                        )}
                    />
                )}
            </Card>

            {/* Create/Edit Modal */}
            <Modal
                title={editingProject ? "Edit Project" : "New Project"}
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                onOk={() => form.submit()}
                width={600}
                centered
            >
                <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ status: 'PLANNING', project_type: 'GENERAL' }}>
                    <Form.Item name="title" label="Project Title" rules={[{ required: true }]}><Input size="large" placeholder="Enter project name..." /></Form.Item>
                    <Form.Item name="description" label="Description"><Input.TextArea rows={3} placeholder="Optional project description..." /></Form.Item>
                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item name="status" label="Status">
                                <Select size="large">
                                    <Option value="PLANNING">Planning</Option>
                                    <Option value="ACTIVE">Active</Option>
                                    <Option value="COMPLETED">Completed</Option>
                                    <Option value="ARCHIVED">Archived</Option>
                                    <Option value="ON_HOLD">On Hold</Option>
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="project_type" label="Project Type">
                                <Select size="large">
                                    <Option value="GENERAL">General Project</Option>
                                    <Option value="SO_PROJECT" disabled>Sales Order Project (Auto-created)</Option>
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="manager_id" label="Project Manager">
                                <Select size="large" showSearch optionFilterProp="children" placeholder="Select a manager...">
                                    <Option value={null}>Unassigned</Option>
                                    {managers.map(u => <Option key={u.id} value={u.id}>{u.full_name}</Option>)}
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="start_date" label="Start Date">
                                <DatePicker size="large" style={{ width: '100%' }} format="DD/MM/YYYY" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="end_date" label="End Date (Expected)">
                                <DatePicker size="large" style={{ width: '100%' }} format="DD/MM/YYYY" />
                            </Form.Item>
                        </Col>
                    </Row>
                </Form>
            </Modal>

            <style>{`
                .project-card {
                    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
                }
                .project-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 10px 20px rgba(0,0,0,0.08) !important;
                    border-color: #e6f7ff !important;
                }
            `}</style>
        </div>
    );
};

export default ProjectsPage;
