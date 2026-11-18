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

    // Calculate progress based on real tasks
    const getProgress = (p: any) => {
        if (p.status === 'COMPLETED') return 100;
        if (p.tasks && p.tasks.length > 0) {
            const doneTasks = p.tasks.filter((t: any) => t.status === 'DONE').length;
            return Math.round((doneTasks / p.tasks.length) * 100);
        }
        return 0;
    };

    const columns = [
        {
            title: 'Project Name', dataIndex: 'title',
            render: (t: string, r: any) => (
                <div style={{ cursor: 'pointer', color: '#1890ff', fontWeight: 500 }} onClick={() => navigate(`/projects/${r.id}`)}>
                    <FolderOutlined style={{ marginRight: 8 }} />
                    {r.project_type === 'SO_PROJECT' && <Tag color="magenta" style={{ border: 'none', background: '#fff0f6', color: '#eb2f96' }}>Đơn Hàng</Tag>}
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
            render: (r: any) => <Progress percent={getProgress(r)} size="small" strokeColor={{ '0%': '#108ee9', '100%': '#87d068' }} status={r.status === 'ACTIVE' ? 'active' : 'normal'} />
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
                    <Card bordered={false} className="stat-card stat-total" style={{ borderRadius: 16, overflow: 'hidden', position: 'relative' }}>
                        <div style={{ position: 'relative', zIndex: 2 }}>
                            <div style={{ color: '#fff', fontSize: 14, opacity: 0.85, marginBottom: 8 }}>Total Projects</div>
                            <div style={{ color: '#fff', fontSize: 32, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <ProjectOutlined style={{ opacity: 0.8 }} /> {stats.total}
                            </div>
                        </div>
                        <div className="stat-bg-blob blob-blue"></div>
                    </Card>
                </Col>
                <Col xs={12} sm={12} md={6}>
                    <Card bordered={false} className="stat-card stat-active" style={{ borderRadius: 16, overflow: 'hidden', position: 'relative' }}>
                        <div style={{ position: 'relative', zIndex: 2 }}>
                            <div style={{ color: '#fff', fontSize: 14, opacity: 0.85, marginBottom: 8 }}>Active</div>
                            <div style={{ color: '#fff', fontSize: 32, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <CheckCircleOutlined style={{ opacity: 0.8 }} /> {stats.active}
                            </div>
                        </div>
                        <div className="stat-bg-blob blob-green"></div>
                    </Card>
                </Col>
                <Col xs={12} sm={12} md={6}>
                    <Card bordered={false} className="stat-card stat-planning" style={{ borderRadius: 16, overflow: 'hidden', position: 'relative' }}>
                        <div style={{ position: 'relative', zIndex: 2 }}>
                            <div style={{ color: '#fff', fontSize: 14, opacity: 0.85, marginBottom: 8 }}>In Planning</div>
                            <div style={{ color: '#fff', fontSize: 32, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <ClockCircleOutlined style={{ opacity: 0.8 }} /> {stats.planning}
                            </div>
                        </div>
                        <div className="stat-bg-blob blob-orange"></div>
                    </Card>
                </Col>
                <Col xs={12} sm={12} md={6}>
                    <Card bordered={false} className="stat-card stat-completed" style={{ borderRadius: 16, overflow: 'hidden', position: 'relative' }}>
                        <div style={{ position: 'relative', zIndex: 2 }}>
                            <div style={{ color: '#fff', fontSize: 14, opacity: 0.85, marginBottom: 8 }}>Completed</div>
                            <div style={{ color: '#fff', fontSize: 32, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <CheckCircleOutlined style={{ opacity: 0.8 }} /> {stats.completed}
                            </div>
                        </div>
                        <div className="stat-bg-blob blob-purple"></div>
                    </Card>
                </Col>
            </Row>

            {/* Main Content Card */}
            <Card
                bordered={false}
                style={{ borderRadius: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}
                bodyStyle={{ padding: isMobile ? '16px' : '20px 24px' }}
            >
                {/* Toolbar */}
                <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
                    <Col xs={24} md={12} style={{ display: 'flex', gap: 12, marginBottom: isMobile ? 16 : 0, flexWrap: 'wrap' }}>
                        <Search
                            placeholder="Search projects..."
                            allowClear
                            onChange={(e) => setSearchText(e.target.value)}
                            style={{ width: isMobile ? '100%' : 220 }}
                        />
                        <Select
                            defaultValue="ALL"
                            style={{ width: isMobile ? 'calc(50% - 6px)' : 130 }}
                            onChange={(val) => setFilterType(val)}
                        >
                            <Option value="ALL">All Types</Option>
                            <Option value="SO_PROJECT">SO Project</Option>
                            <Option value="GENERAL">General</Option>
                        </Select>
                        <Select
                            defaultValue="ALL"
                            style={{ width: isMobile ? 'calc(50% - 6px)' : 130 }}
                            onChange={(val) => setFilterStatus(val)}
                        >
                            <Option value="ALL">All Status</Option>
                            <Option value="PLANNING">Planning</Option>
                            <Option value="ACTIVE">Active</Option>
                            <Option value="COMPLETED">Completed</Option>
                            <Option value="ON_HOLD">On Hold</Option>
                        </Select>
                    </Col>
                    <Col xs={24} md={12} style={{ textAlign: isMobile ? 'left' : 'right', display: 'flex', justifyContent: isMobile ? 'space-between' : 'flex-end', gap: 12 }}>
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
                        scroll={{ x: 800 }}
                    />
                ) : (
                    <List
                        grid={{ gutter: 20, xs: 1, sm: 2, md: 3, lg: 3, xl: 4, xxl: 4 }}
                        dataSource={filteredProjects}
                        loading={loading}
                        renderItem={r => (
                            <List.Item>
                                <Card
                                    hoverable
                                    className="project-card"
                                    onClick={() => navigate(`/projects/${r.id}`)}
                                    style={{ borderRadius: 16, border: '1px solid #f0f0f0', height: '100%', display: 'flex', flexDirection: 'column' }}
                                    bodyStyle={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column' }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 0 }}>
                                            <div style={{
                                                width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                                background: r.project_type === 'SO_PROJECT' ? 'linear-gradient(135deg, #ff7875 0%, #f5222d 100%)' : 'linear-gradient(135deg, #69c0ff 0%, #1890ff 100%)',
                                                color: '#fff',
                                                boxShadow: r.project_type === 'SO_PROJECT' ? '0 4px 12px rgba(245,34,45,0.2)' : '0 4px 12px rgba(24,144,255,0.2)'
                                            }}>
                                                <FolderOutlined style={{ fontSize: 24 }} />
                                            </div>
                                            <div style={{ overflow: 'hidden', flex: 1 }}>
                                                <Title level={5} style={{ margin: 0, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#1f1f1f', fontWeight: 600 }} title={r.title}>
                                                    {r.title}
                                                </Title>
                                                <Space size={4} wrap>
                                                    {r.project_type === 'SO_PROJECT' && <Tag color="magenta" style={{ border: 'none', background: '#fff0f6', color: '#eb2f96', margin: 0, fontSize: 11 }}>Đơn Hàng</Tag>}
                                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                                        {r.start_date ? dayjs(r.start_date).format('MMM DD') : 'TBD'} &rarr; {r.end_date ? dayjs(r.end_date).format('MMM DD') : 'TBD'}
                                                    </Text>
                                                </Space>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ marginBottom: 16, marginTop: 'auto' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                            <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>Progress</Text>
                                            <Text strong style={{ fontSize: 13, color: getProgress(r) === 100 ? '#52c41a' : '#1890ff' }}>{getProgress(r)}%</Text>
                                        </div>
                                        <Progress 
                                            percent={getProgress(r)} 
                                            showInfo={false} 
                                            size="small" 
                                            status={r.status === 'ACTIVE' ? 'active' : 'normal'} 
                                            strokeColor={getProgress(r) === 100 ? '#52c41a' : { '0%': '#108ee9', '100%': '#87d068' }}
                                        />
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f0f0f0', paddingTop: 16, marginTop: 8 }}>
                                        <Space size={4}>
                                            <Tooltip title={r.manager?.full_name || 'Unassigned Manager'}>
                                                {r.manager ? (
                                                    <Avatar size="small" style={{ backgroundColor: '#1890ff', border: '1px solid #fff' }}>{getInitials(r.manager.full_name)}</Avatar>
                                                ) : (
                                                    <Avatar size="small" icon={<UserOutlined />} style={{ border: '1px solid #fff' }} />
                                                )}
                                            </Tooltip>
                                            {(r.members?.length > 0) && (
                                                <Avatar.Group maxCount={3} size="small" maxStyle={{ color: '#f56a00', backgroundColor: '#fde3cf' }}>
                                                    {r.members.map((m: any) => (
                                                        <Tooltip title={m.full_name} key={m.id}>
                                                            <Avatar style={{ backgroundColor: '#87d068', border: '1px solid #fff' }}>{getInitials(m.full_name)}</Avatar>
                                                        </Tooltip>
                                                    ))}
                                                </Avatar.Group>
                                            )}
                                        </Space>
                                        <Tag color={STATUS_COLORS[r.status] || 'default'} style={{ margin: 0, borderRadius: 4, border: 'none', fontWeight: 500 }}>
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
                                    <Option value="SO_PROJECT" disabled>Sales Order Project</Option>
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
                .stat-card {
                    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.05) !important;
                    transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), box-shadow 0.3s ease;
                }
                .stat-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 14px 28px rgba(0, 0, 0, 0.1) !important;
                }
                .stat-total { background: linear-gradient(135deg, #1890ff 0%, #0050b3 100%); }
                .stat-active { background: linear-gradient(135deg, #52c41a 0%, #237804 100%); }
                .stat-planning { background: linear-gradient(135deg, #faad14 0%, #ad6800 100%); }
                .stat-completed { background: linear-gradient(135deg, #722ed1 0%, #391085 100%); }
                .stat-bg-blob {
                    position: absolute;
                    width: 120px;
                    height: 120px;
                    border-radius: 50%;
                    filter: blur(25px);
                    right: -20px;
                    bottom: -30px;
                    opacity: 0.2;
                    z-index: 1;
                    mix-blend-mode: overlay;
                }
                .blob-blue { background: #ffffff; }
                .blob-green { background: #ffffff; }
                .blob-orange { background: #ffffff; }
                .blob-purple { background: #ffffff; }

                .project-card {
                    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
                }
                .project-card:hover {
                    transform: translateY(-6px);
                    box-shadow: 0 12px 24px rgba(0,0,0,0.08) !important;
                    border-color: #bae7ff !important;
                }
                
                /* Custom scrollbar for table */
                .ant-table-body::-webkit-scrollbar {
                    height: 8px;
                }
                .ant-table-body::-webkit-scrollbar-thumb {
                    background: #d9d9d9;
                    border-radius: 4px;
                }
            `}</style>
        </div>
    );
};

export default ProjectsPage;
