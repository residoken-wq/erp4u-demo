import React, { useEffect, useState } from 'react';
import { Checkbox, List, Tag, Progress, Button, Input, message, Collapse, Tooltip, Spin, Empty } from 'antd';
import { PlusOutlined, DeleteOutlined, CheckCircleOutlined, ClockCircleOutlined, SyncOutlined } from '@ant-design/icons';
import api from '../utils/api';
import dayjs from 'dayjs';

interface ChecklistItem {
    id: number;
    task_code: string;
    task_name: string;
    stage: string;
    is_completed: boolean;
    completed_at?: string;
    completed_by?: string;
    due_date?: string;
    note?: string;
    sort_order: number;
}

interface ChecklistData {
    id: number;
    order_id: number;
    items: ChecklistItem[];
    progress: {
        total: number;
        completed: number;
        percent: number;
    };
}

interface Props {
    orderId: number;
    orderStatus?: string;
    onRefresh?: () => void;
}

const STAGE_LABELS: Record<string, { label: string; color: string }> = {
    QUOTATION: { label: 'Báo giá', color: 'blue' },
    SO_PENDING: { label: 'Chờ xử lý', color: 'orange' },
    IN_PRODUCTION: { label: 'Sản xuất', color: 'purple' },
    DELIVERED: { label: 'Đã giao', color: 'green' },
    COMPLETED: { label: 'Hoàn thành', color: 'cyan' },
    CUSTOM: { label: 'Tùy chỉnh', color: 'magenta' },
};

const SalesChecklistPanel: React.FC<Props> = ({ orderId, orderStatus, onRefresh }) => {
    const [checklist, setChecklist] = useState<ChecklistData | null>(null);
    const [loading, setLoading] = useState(false);
    const [newTaskName, setNewTaskName] = useState('');
    const [addingTask, setAddingTask] = useState(false);

    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

    const fetchChecklist = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/sales/${orderId}/checklist`);
            setChecklist(res.data);
        } catch (err) {
            console.error('Failed to fetch checklist:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (orderId) {
            fetchChecklist();
        }
    }, [orderId]);

    const handleToggle = async (itemId: number) => {
        try {
            await api.post(`/sales/${orderId}/checklist/toggle/${itemId}`, {
                username: currentUser?.username || 'User'
            });
            fetchChecklist();
        } catch (err) {
            message.error('Không thể cập nhật');
        }
    };

    const handleAddTask = async () => {
        if (!newTaskName.trim()) return;
        setAddingTask(true);
        try {
            await api.post(`/sales/${orderId}/checklist/add`, {
                task_name: newTaskName.trim()
            });
            setNewTaskName('');
            fetchChecklist();
            message.success('Đã thêm task');
        } catch (err) {
            message.error('Thêm task thất bại');
        } finally {
            setAddingTask(false);
        }
    };

    const handleDeleteTask = async (itemId: number) => {
        try {
            await api.delete(`/sales/${orderId}/checklist/${itemId}`);
            fetchChecklist();
            message.success('Đã xóa');
        } catch (err: any) {
            message.error(err?.response?.data?.message || 'Không thể xóa task hệ thống');
        }
    };

    const handleSyncStatus = async () => {
        if (!orderStatus) return;
        try {
            await api.post(`/sales/${orderId}/checklist/sync`, { status: orderStatus });
            fetchChecklist();
            message.success('Đã đồng bộ checklist');
        } catch (err) {
            message.error('Đồng bộ thất bại');
        }
    };

    if (loading && !checklist) {
        return <Spin tip="Đang tải checklist..." />;
    }

    if (!checklist || !checklist.items || checklist.items.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: 20 }}>
                <Empty description="Chưa có checklist" />
                <Button type="primary" onClick={handleSyncStatus} icon={<SyncOutlined />} style={{ marginTop: 16 }}>
                    Tạo checklist cho đơn hàng
                </Button>
            </div>
        );
    }

    // Group items by stage
    const groupedByStage = checklist.items.reduce((acc, item) => {
        if (!acc[item.stage]) acc[item.stage] = [];
        acc[item.stage].push(item);
        return acc;
    }, {} as Record<string, ChecklistItem[]>);

    const stageOrder = ['QUOTATION', 'SO_PENDING', 'IN_PRODUCTION', 'DELIVERED', 'COMPLETED', 'CUSTOM'];

    return (
        <div style={{ padding: '0 8px' }}>
            {/* Progress Bar */}
            <div style={{ marginBottom: 16 }}>
                <Progress
                    percent={checklist.progress.percent}
                    format={() => `${checklist.progress.completed}/${checklist.progress.total}`}
                    status={checklist.progress.percent === 100 ? 'success' : 'active'}
                    strokeColor={{ '0%': '#108ee9', '100%': '#87d068' }}
                />
            </div>

            {/* Sync Button */}
            {orderStatus && (
                <Button
                    size="small"
                    icon={<SyncOutlined />}
                    onClick={handleSyncStatus}
                    style={{ marginBottom: 12 }}
                >
                    Đồng bộ theo trạng thái ({orderStatus})
                </Button>
            )}

            {/* Checklist by Stage */}
            <Collapse defaultActiveKey={stageOrder} ghost>
                {stageOrder.map(stage => {
                    const items = groupedByStage[stage];
                    if (!items || items.length === 0) return null;

                    const stageInfo = STAGE_LABELS[stage] || { label: stage, color: 'default' };
                    const stageCompleted = items.filter(i => i.is_completed).length;

                    return (
                        <Collapse.Panel
                            key={stage}
                            header={
                                <span>
                                    <Tag color={stageInfo.color}>{stageInfo.label}</Tag>
                                    <span style={{ fontSize: 12, color: '#888' }}>
                                        ({stageCompleted}/{items.length})
                                    </span>
                                </span>
                            }
                        >
                            <List
                                size="small"
                                dataSource={items}
                                renderItem={(item) => (
                                    <List.Item
                                        style={{
                                            padding: '8px 0',
                                            opacity: item.is_completed ? 0.6 : 1,
                                            textDecoration: item.is_completed ? 'line-through' : 'none'
                                        }}
                                        actions={[
                                            item.task_code.startsWith('CUSTOM_') && (
                                                <Tooltip title="Xóa">
                                                    <Button
                                                        size="small"
                                                        danger
                                                        type="text"
                                                        icon={<DeleteOutlined />}
                                                        onClick={() => handleDeleteTask(item.id)}
                                                    />
                                                </Tooltip>
                                            )
                                        ].filter(Boolean)}
                                    >
                                        <Checkbox
                                            checked={item.is_completed}
                                            onChange={() => handleToggle(item.id)}
                                            style={{ marginRight: 8 }}
                                        />
                                        <span style={{ flex: 1 }}>
                                            {item.task_name}
                                            {item.is_completed && item.completed_by && (
                                                <span style={{ fontSize: 11, color: '#52c41a', marginLeft: 8 }}>
                                                    <CheckCircleOutlined /> {item.completed_by}
                                                    {item.completed_at && ` (${dayjs(item.completed_at).format('DD/MM HH:mm')})`}
                                                </span>
                                            )}
                                            {item.due_date && !item.is_completed && (
                                                <span style={{ fontSize: 11, color: '#faad14', marginLeft: 8 }}>
                                                    <ClockCircleOutlined /> {dayjs(item.due_date).format('DD/MM/YYYY')}
                                                </span>
                                            )}
                                        </span>
                                    </List.Item>
                                )}
                            />
                        </Collapse.Panel>
                    );
                })}
            </Collapse>

            {/* Add Custom Task */}
            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                <Input
                    placeholder="Thêm task tùy chỉnh..."
                    value={newTaskName}
                    onChange={(e) => setNewTaskName(e.target.value)}
                    onPressEnter={handleAddTask}
                    style={{ flex: 1 }}
                />
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleAddTask}
                    loading={addingTask}
                >
                    Thêm
                </Button>
            </div>
        </div>
    );
};

export default SalesChecklistPanel;
