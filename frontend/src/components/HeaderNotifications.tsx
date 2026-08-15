import React, { useEffect, useState, useCallback } from 'react';
import { Badge, Popover, List, Avatar, Button, Typography, Empty, Spin } from 'antd';
import { BellOutlined, CheckCircleOutlined, InfoCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';

// Firebase imports
import { database } from '../utils/firebaseConfig';
import { ref, onValue, off, query, orderByChild, limitToLast, DataSnapshot } from 'firebase/database';

dayjs.extend(relativeTime);
dayjs.locale('vi');

const { Text } = Typography;

interface NotificationItem {
    id: number;
    title: string;
    message: string;
    type: string;
    is_read: boolean;
    link?: string;
    created_at: string;
    timestamp?: number;
}

const HeaderNotifications: React.FC = () => {
    const navigate = useNavigate();
    const [list, setList] = useState<NotificationItem[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [hasNew, setHasNew] = useState(false);
    const [useFirebase, setUseFirebase] = useState(true);

    // Get user ID from localStorage
    const userStr = localStorage.getItem('user');
    const userId = userStr ? JSON.parse(userStr).id : null;

    // Sound notification
    const playNotificationSound = useCallback(() => {
        try {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdG+Bg4l8cXl/g4OHfn1+g4aDh4KAfn+CgoOEfn5+goOEg4B/f4GCgoOFg4CAgICBgYOCgoKBgIGBgYGCgYGBgYGBgoKBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgQ==');
            audio.volume = 0.5;
            audio.play().catch(() => { });
        } catch (e) { }
    }, []);

    // Firebase real-time listener
    useEffect(() => {
        if (!userId || !useFirebase) return;

        const notificationsRef = ref(database, `notifications/user_${userId}`);
        const notificationsQuery = query(notificationsRef, orderByChild('timestamp'), limitToLast(50));

        const unsubscribe = onValue(notificationsQuery, (snapshot: DataSnapshot) => {
            setLoading(false);

            if (snapshot.exists()) {
                const data = snapshot.val();
                const notifications: NotificationItem[] = Object.values(data);

                // Sort by timestamp descending
                notifications.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

                const newUnread = notifications.filter(n => !n.is_read).length;

                // Check if new notification arrived
                if (newUnread > unreadCount && list.length > 0) {
                    setHasNew(true);
                    playNotificationSound();
                    setTimeout(() => setHasNew(false), 3000);
                }

                setList(notifications);
                setUnreadCount(newUnread);
            } else {
                setList([]);
                setUnreadCount(0);
            }
        }, (error: Error) => {
            console.error('Firebase listener error:', error);
            // Fallback to polling if Firebase fails
            setUseFirebase(false);
        });

        return () => {
            off(notificationsRef);
        };
    }, [userId, useFirebase, playNotificationSound]);

    // Fallback: API polling (only if Firebase fails)
    useEffect(() => {
        if (!userId || useFirebase) return;

        const fetchNoti = async () => {
            try {
                const res = await api.get('/notifications');
                const data = Array.isArray(res.data) ? res.data : [];
                setList(data);
                setUnreadCount(data.filter((n: any) => !n.is_read).length);
                setLoading(false);
            } catch (e) {
                console.error("Failed to fetch notifications:", e);
            }
        };

        fetchNoti();
        const interval = setInterval(fetchNoti, 15000);
        return () => clearInterval(interval);
    }, [userId, useFirebase]);

    const handleRead = async (item: NotificationItem) => {
        if (!item.is_read) {
            try {
                await api.post(`/notifications/${item.id}/read`);
                // Firebase will auto-update via listener
                if (!useFirebase) {
                    setList(prev => prev.map(n => n.id === item.id ? { ...n, is_read: true } : n));
                    setUnreadCount(prev => Math.max(0, prev - 1));
                }
            } catch (e) {
                console.error("Failed to mark read:", e);
            }
        }

        // Navigate to the linked content
        if (item.link) {
            setOpen(false);
            if (item.link.startsWith('/')) {
                navigate(item.link);
            } else {
                window.location.href = item.link;
            }
        }
    };

    const handleReadAll = async () => {
        try {
            await api.post('/notifications/read-all');
            // Firebase will auto-update via listener
            if (!useFirebase) {
                setList(prev => prev.map(n => ({ ...n, is_read: true })));
                setUnreadCount(0);
            }
        } catch (e) {
            console.error("Failed to read all:", e);
        }
    };

    const content = (
        <div style={{ width: 380 }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                borderBottom: '1px solid #f0f0f0',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            }}>
                <Text strong style={{ color: 'white', fontSize: 15 }}>🔔 Thông báo</Text>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {useFirebase && (
                        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>
                            ⚡ Real-time
                        </Text>
                    )}
                    <Button
                        type="link"
                        size="small"
                        onClick={handleReadAll}
                        disabled={unreadCount === 0}
                        style={{ color: 'white', padding: 0 }}
                    >
                        Đọc hết
                    </Button>
                </div>
            </div>
            <div style={{ maxHeight: 450, overflowY: 'auto' }}>
                {loading ? (
                    <div style={{ padding: 40, textAlign: 'center' }}>
                        <Spin />
                    </div>
                ) : (
                    <List
                        dataSource={list}
                        locale={{ emptyText: <Empty description="Không có thông báo mới" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                        renderItem={(item) => (
                            <List.Item
                                className="notification-item"
                                style={{
                                    background: item.is_read ? '#fff' : 'linear-gradient(90deg, #e6f7ff 0%, #fff 100%)',
                                    cursor: 'pointer',
                                    padding: '12px 16px',
                                    transition: 'all 0.2s',
                                    borderLeft: item.is_read ? '3px solid transparent' : '3px solid #1890ff'
                                }}
                                onClick={() => handleRead(item)}
                            >
                                <List.Item.Meta
                                    avatar={
                                        <Avatar
                                            style={{
                                                backgroundColor: item.type === 'WARNING' ? '#ff4d4f' :
                                                    item.type === 'SUCCESS' ? '#52c41a' : '#1890ff',
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                                            }}
                                            icon={
                                                item.type === 'WARNING' ? <WarningOutlined /> :
                                                    item.type === 'SUCCESS' ? <CheckCircleOutlined /> :
                                                        <InfoCircleOutlined />
                                            }
                                        />
                                    }
                                    title={
                                        <Text style={{ fontSize: 13 }} strong={!item.is_read}>
                                            {item.title}
                                        </Text>
                                    }
                                    description={
                                        <div>
                                            <div style={{ fontSize: 12, color: '#666', lineHeight: 1.4 }}>
                                                {item.message.length > 80
                                                    ? `${item.message.substring(0, 80)}...`
                                                    : item.message
                                                }
                                            </div>
                                            <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                                                {dayjs(item.created_at).fromNow()}
                                            </div>
                                        </div>
                                    }
                                />
                            </List.Item>
                        )}
                    />
                )}
            </div>
        </div>
    );

    return (
        <Popover
            content={content}
            trigger="click"
            open={open}
            onOpenChange={setOpen}
            placement="bottomRight"
            arrow={false}
            overlayInnerStyle={{ padding: 0, borderRadius: 12, overflow: 'hidden' }}
        >
            <div style={{ cursor: 'pointer', padding: '0 12px', display: 'flex', alignItems: 'center' }}>
                <Badge count={unreadCount} overflowCount={99} size="small">
                    <BellOutlined
                        style={{
                            fontSize: 20,
                            color: hasNew ? '#fa8c16' : '#333',
                            animation: hasNew ? 'shake 0.5s ease-in-out infinite' : 'none'
                        }}
                    />
                </Badge>
                {/* CSS Animation for shake effect */}
                <style>{`
                    @keyframes shake {
                        0%, 100% { transform: rotate(0deg); }
                        25% { transform: rotate(-15deg); }
                        50% { transform: rotate(15deg); }
                        75% { transform: rotate(-10deg); }
                    }
                    .notification-item:hover {
                        background: #f5f5f5 !important;
                    }
                `}</style>
            </div>
        </Popover>
    );
};

export default HeaderNotifications;