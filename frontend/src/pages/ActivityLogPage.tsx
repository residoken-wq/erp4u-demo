import React, { useEffect, useState } from 'react';
import { Table, Tag, Card, Button, Tabs } from 'antd';
import { ReloadOutlined, DatabaseOutlined, UserOutlined } from '@ant-design/icons';
import api from '../utils/api';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const ActivityLogPage: React.FC = () => {
    const [logs, setLogs] = useState<any[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);

    const [users, setUsers] = useState<any[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);

    const [activeTab, setActiveTab] = useState('1');

    const fetchLogs = async () => {
        setLoadingLogs(true);
        try {
            const res = await api.get('/system/logs'); // Need to ensure this endpoint exists in SystemController
            setLogs(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingLogs(false);
        }
    };

    const fetchUsers = async () => {
        setLoadingUsers(true);
        try {
            const res = await api.get('/users');
            // Sort by last activity descending
            const sorted = res.data.sort((a: any, b: any) => {
                if (!a.last_activity_at) return 1;
                if (!b.last_activity_at) return -1;
                return new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime();
            });
            setUsers(sorted);
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingUsers(false);
        }
    };

    const fetchData = () => {
        if (activeTab === '1') {
            fetchLogs();
        } else {
            fetchUsers();
        }
    };

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const columns = [
        {
            title: 'Thời gian',
            dataIndex: 'timestamp',
            width: 180,
            render: (t: any) => dayjs(t).format('DD/MM/YYYY HH:mm:ss')
        },
        {
            title: 'User',
            dataIndex: 'username',
            width: 120,
            render: (t: string) => <Tag color="blue">{t}</Tag>
        },
        {
            title: 'Họ và tên',
            dataIndex: 'full_name',
            width: 160,
            render: (t: string) => t ? <span style={{ fontWeight: 500 }}>{t}</span> : <span style={{ color: '#999' }}>-</span>
        },
        {
            title: 'Module',
            dataIndex: 'module',
            width: 120,
            render: (t: string) => <Tag color="geekblue">{t}</Tag>
        },
        {
            title: 'Hành động',
            dataIndex: 'action',
            width: 200,
            render: (t: string) => <b>{t}</b>
        },
        {
            title: 'Mô tả',
            dataIndex: 'description',
        },
        {
            title: 'Chi tiết thay đổi',
            dataIndex: 'details',
            width: 450,
            render: (details: any, record: any) => {
                if (!details || Object.keys(details).length === 0) return <span style={{ color: '#999' }}>-</span>;

                // Format 1: { field1: { old: x, new: y }, field2: { old: a, new: b } }
                // This is what our backend sends for UPDATE actions
                const keys = Object.keys(details);

                // Helper to format values
                const fmt = (v: any) => {
                    if (v === null || v === undefined) return <span style={{ color: '#bbb' }}>null</span>;
                    if (typeof v === 'object') return JSON.stringify(v).slice(0, 50);
                    if (typeof v === 'number') return v.toLocaleString();
                    return String(v);
                };

                return (
                    <div style={{ fontSize: 11, maxHeight: 120, overflowY: 'auto' }}>
                        {keys.map(key => {
                            const val = details[key];
                            // Check if it's { old, new } format
                            if (val && typeof val === 'object' && ('old' in val || 'new' in val)) {
                                return (
                                    <div key={key} style={{ marginBottom: 4 }}>
                                        <b style={{ color: '#595959' }}>{key}:</b>{' '}
                                        <span style={{ color: '#ff4d4f', textDecoration: 'line-through' }}>{fmt(val.old)}</span>
                                        {' → '}
                                        <span style={{ color: '#52c41a' }}>{fmt(val.new)}</span>
                                    </div>
                                );
                            }
                            // Simple value (e.g., "Items changed")
                            return (
                                <div key={key} style={{ marginBottom: 4 }}>
                                    <b style={{ color: '#595959' }}>{key}:</b> {fmt(val)}
                                </div>
                            );
                        })}
                    </div>
                );
            }
        }
    ];

    const userColumns = [
        {
            title: 'Trạng thái',
            dataIndex: 'last_activity_at',
            width: 120,
            render: (t: any) => {
                if (!t) return <Tag color="default">N/A</Tag>;
                const diff = dayjs().diff(dayjs(t), 'minute');
                if (diff <= 15) {
                    return <Tag color="success" icon={<UserOutlined />}>Online</Tag>;
                }
                return <Tag color="default">{dayjs(t).fromNow()}</Tag>;
            }
        },
        {
            title: 'User',
            dataIndex: 'username',
            width: 150,
            render: (t: string) => <b>{t}</b>
        },
        {
            title: 'Họ và tên',
            dataIndex: 'full_name',
            width: 200,
        },
        {
            title: 'IP Address',
            dataIndex: 'ip_address',
            width: 150,
        },
        {
            title: 'Thiết bị / Browser',
            dataIndex: 'device_info',
            render: (t: string) => <span style={{ color: '#666', fontSize: 12 }}>{t || 'Không xác định'}</span>
        },
        {
            title: 'Hoạt động cuối',
            dataIndex: 'last_activity_at',
            width: 180,
            render: (t: any) => t ? dayjs(t).format('DD/MM/YYYY HH:mm:ss') : '-'
        }
    ];

    return (
        <Card
            title={<span><DatabaseOutlined /> Giám sát hệ thống</span>}
            extra={<Button icon={<ReloadOutlined />} onClick={fetchData}>Làm mới</Button>}
        >
            <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                items={[
                    {
                        key: '1',
                        label: 'Nhật ký hoạt động',
                        children: (
                            <Table
                                dataSource={logs}
                                columns={columns}
                                rowKey="id"
                                loading={loadingLogs}
                                pagination={{ pageSize: 20 }}
                            />
                        )
                    },
                    {
                        key: '2',
                        label: 'Phiên hoạt động (Online)',
                        children: (
                            <Table
                                dataSource={users}
                                columns={userColumns}
                                rowKey="id"
                                loading={loadingUsers}
                                pagination={{ pageSize: 20 }}
                            />
                        )
                    }
                ]}
            />
        </Card>
    );
};

export default ActivityLogPage;
