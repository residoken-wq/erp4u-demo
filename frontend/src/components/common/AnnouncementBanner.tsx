import React, { useState, useEffect } from 'react';
import { Alert, Button, Modal, List, Typography, Tag, Space, Badge } from 'antd';
import { NotificationOutlined, CloseOutlined, CheckOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../utils/api';

const { Title, Paragraph } = Typography;

interface Announcement {
    id: number;
    title: string;
    content: string;
    type: 'INFO' | 'WARNING' | 'IMPORTANT';
    priority: 'LOW' | 'NORMAL' | 'HIGH';
    is_pinned: boolean;
    is_read: boolean;
    created_at: string;
}

const TYPE_COLORS: Record<string, 'info' | 'warning' | 'error'> = {
    INFO: 'info',
    WARNING: 'warning',
    IMPORTANT: 'error'
};

const TYPE_LABELS: Record<string, string> = {
    INFO: 'Thông tin',
    WARNING: 'Cảnh báo',
    IMPORTANT: 'Quan trọng'
};

const AnnouncementBanner: React.FC = () => {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
    const [unreadCount, setUnreadCount] = useState(0);

    const loadAnnouncements = async () => {
        try {
            const [annRes, discRes] = await Promise.all([
                api.get('/announcements/user/active').catch(() => ({ data: [] })),
                api.get('/discussions').catch(() => ({ data: [] }))
            ]);

            const normalAnnouncements = Array.isArray(annRes.data) ? annRes.data : [];
            const allDiscussions = Array.isArray(discRes.data) ? discRes.data : [];

            // Extract pinned discussions to show as global announcements
            const pinnedDiscussions = allDiscussions
                .filter((d: any) => d.is_pinned || d.is_pinned === 1 || d.is_pinned === '1' || d.is_pinned === 'true')
                .map((d: any) => ({
                    id: `disc_${d.id}`,
                    title: `[Thảo luận] ${d.title}`,
                    content: d.content || d.description || '(Xem chi tiết trong thảo luận)',
                    type: d.type === 'ANNOUNCEMENT' ? 'IMPORTANT' : 'INFO',
                    priority: 'HIGH',
                    is_pinned: true,
                    is_read: true, // We don't track read state for discussions globally here
                    created_at: d.created_at,
                    is_discussion: true,
                    original_id: d.id
                }));

            const combined = [...normalAnnouncements, ...pinnedDiscussions];
            setAnnouncements(combined);
            setUnreadCount(normalAnnouncements.filter((a: any) => !a.is_read).length);
        } catch (e) {
            console.error('Failed to load announcements:', e);
        }
    };

    useEffect(() => {
        loadAnnouncements();
        // Refresh every 5 minutes
        const interval = setInterval(loadAnnouncements, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    const handleMarkAsRead = async (id: number | string) => {
        if (typeof id === 'string' && id.startsWith('disc_')) return;
        try {
            await api.post(`/announcements/${id}/read`);
            loadAnnouncements();
        } catch (e) {
            console.error('Failed to mark as read:', e);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await api.post('/announcements/user/read-all');
            loadAnnouncements();
        } catch (e) {
            console.error('Failed to mark all as read:', e);
        }
    };

    const openDetail = (announcement: Announcement) => {
        setSelectedAnnouncement(announcement);
        setModalOpen(true);
        if (!announcement.is_read) {
            handleMarkAsRead(announcement.id);
        }
    };

    // Show pinned announcements as alerts at top - always show during validity regardless of read status
    const pinnedImportant = announcements.filter(a => a.is_pinned);

    if (announcements.length === 0) return null;

    return (
        <>
            {/* Pinned alerts */}
            {pinnedImportant.map(a => (
                <Alert
                    key={a.id}
                    message={a.title}
                    description={
                        <span
                            dangerouslySetInnerHTML={{ __html: a.content.substring(0, 150) + '...' }}
                            style={{ cursor: 'pointer' }}
                            onClick={() => openDetail(a)}
                        />
                    }
                    type={TYPE_COLORS[a.type]}
                    showIcon
                    style={{ marginBottom: 8 }}
                    action={
                        <Button size="small" onClick={() => openDetail(a)}>
                            Xem chi tiết
                        </Button>
                    }
                />
            ))}

            {/* Notification bell/button */}
            {unreadCount > 0 && (
                <div
                    style={{
                        position: 'fixed',
                        bottom: 80,
                        right: 24,
                        zIndex: 1000
                    }}
                >
                    <Badge count={unreadCount}>
                        <Button
                            type="primary"
                            shape="circle"
                            size="large"
                            icon={<NotificationOutlined />}
                            onClick={() => {
                                setSelectedAnnouncement(null);
                                setModalOpen(true);
                            }}
                            style={{
                                width: 56,
                                height: 56,
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                            }}
                        />
                    </Badge>
                </div>
            )}

            {/* Modal for viewing announcements */}
            <Modal
                title={
                    selectedAnnouncement
                        ? selectedAnnouncement.title
                        : <><NotificationOutlined /> Thông báo ({unreadCount} chưa đọc)</>
                }
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                footer={selectedAnnouncement ? null : [
                    <Button key="read-all" onClick={handleMarkAllAsRead} icon={<CheckOutlined />}>
                        Đánh dấu tất cả đã đọc
                    </Button>,
                    <Button key="close" onClick={() => setModalOpen(false)}>
                        Đóng
                    </Button>
                ]}
                width={600}
            >
                {selectedAnnouncement ? (
                    <div>
                        <Space style={{ marginBottom: 12 }}>
                            <Tag color={TYPE_COLORS[selectedAnnouncement.type] === 'error' ? 'red' : TYPE_COLORS[selectedAnnouncement.type]}>
                                {TYPE_LABELS[selectedAnnouncement.type]}
                            </Tag>
                            <span style={{ color: '#999' }}>
                                {dayjs(selectedAnnouncement.created_at).format('DD/MM/YYYY HH:mm')}
                            </span>
                        </Space>
                        <div
                            dangerouslySetInnerHTML={{ __html: selectedAnnouncement.content }}
                            style={{ lineHeight: 1.8 }}
                        />
                        {(selectedAnnouncement as any).is_discussion && (
                            <div style={{ marginTop: 24, textAlign: 'center' }}>
                                <Button type="primary" onClick={() => window.location.href = `/workspace/discussions/${(selectedAnnouncement as any).original_id}`}>
                                    Đi đến trang Thảo luận
                                </Button>
                            </div>
                        )}
                    </div>
                ) : (
                    <List
                        dataSource={announcements}
                        renderItem={(item) => (
                            <List.Item
                                style={{
                                    backgroundColor: item.is_read ? 'transparent' : '#f6ffed',
                                    cursor: 'pointer',
                                    padding: 12,
                                    borderRadius: 6,
                                    marginBottom: 4
                                }}
                                onClick={() => openDetail(item)}
                            >
                                <List.Item.Meta
                                    title={
                                        <Space>
                                            {!item.is_read && <Badge status="processing" />}
                                            <span style={{ fontWeight: item.is_read ? 400 : 600 }}>
                                                {item.title}
                                            </span>
                                            <Tag color={TYPE_COLORS[item.type] === 'error' ? 'red' : TYPE_COLORS[item.type]} style={{ fontSize: 10 }}>
                                                {TYPE_LABELS[item.type]}
                                            </Tag>
                                        </Space>
                                    }
                                    description={
                                        <span style={{ color: '#999', fontSize: 12 }}>
                                            {dayjs(item.created_at).format('DD/MM/YYYY HH:mm')}
                                        </span>
                                    }
                                />
                            </List.Item>
                        )}
                    />
                )}
            </Modal>
        </>
    );
};

export default AnnouncementBanner;
