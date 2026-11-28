import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Badge, Popover, List, Avatar, Button, Typography, Empty, Spin } from 'antd';
import { BellOutlined, CheckCircleOutlined, InfoCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { API_URL } from '../config';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';
import {
    NotificationItem,
    openNotificationStream,
    decideStreamTransition,
    INITIAL_STREAM_STATE,
    StreamState,
    StreamEvent,
    mergeNotificationItem,
    mergeNotificationLists,
    countUnreadNotifications,
    FALLBACK_POLL_INTERVAL_MS,
    STREAM_RECONNECT_INTERVAL_MS,
    HIDDEN_TAB_DISCONNECT_MS,
} from '../utils/notificationStreamHelper';

dayjs.extend(relativeTime);
dayjs.locale('vi');

const { Text } = Typography;

const HeaderNotifications: React.FC = () => {
    const navigate = useNavigate();
    const [list, setList] = useState<NotificationItem[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [hasNew, setHasNew] = useState(false);
    const [isConnected, setIsConnected] = useState(false);

    // Get user ID from localStorage
    const userStr = localStorage.getItem('user');
    const userId = userStr ? JSON.parse(userStr).id : null;

    // Refs for lifecycle, timers, and abort control
    const abortControllerRef = useRef<AbortController | null>(null);
    const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
    const fallbackPollTimerRef = useRef<NodeJS.Timeout | null>(null);
    const retryStreamTimerRef = useRef<NodeJS.Timeout | null>(null);
    const hiddenTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isClosedDueToHiddenRef = useRef<boolean>(false);
    const streamStateRef = useRef<StreamState>({ ...INITIAL_STREAM_STATE });
    const connectStreamRef = useRef<() => void>(() => {});
    const isMountedRef = useRef<boolean>(true);

    // Sound notification
    const playNotificationSound = useCallback(() => {
        try {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdG+Bg4l8cXl/g4OHfn1+g4aDh4KAfn+CgoOEfn5+goOEg4B/f4GCgoOFg4CAgICBgYOCgoKBgIGBgYGCgYGBgYGBgoKBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgQ==');
            audio.volume = 0.5;
            audio.play().catch(() => { });
        } catch (e) { }
    }, []);

    const fetchNotifications = useCallback(async () => {
        try {
            const res = await api.get('/notifications');
            const data: NotificationItem[] = Array.isArray(res.data) ? res.data : [];
            if (isMountedRef.current) {
                setList((prev) => {
                    const merged = prev.length === 0 ? data : mergeNotificationLists(prev, data);
                    setUnreadCount(countUnreadNotifications(merged));
                    return merged;
                });
                setLoading(false);
            }
        } catch (e) {
            console.error('[HeaderNotifications] Failed to fetch notifications:', e);
            if (isMountedRef.current) {
                setLoading(false);
            }
        }
    }, []);

    // Helper to stop all timers
    const clearAllTimers = useCallback(() => {
        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }
        if (fallbackPollTimerRef.current) {
            clearInterval(fallbackPollTimerRef.current);
            fallbackPollTimerRef.current = null;
        }
        if (retryStreamTimerRef.current) {
            clearInterval(retryStreamTimerRef.current);
            retryStreamTimerRef.current = null;
        }
        if (hiddenTimerRef.current) {
            clearTimeout(hiddenTimerRef.current);
            hiddenTimerRef.current = null;
        }
    }, []);

    // Handle stream state transitions and actions via pure helper
    const handleStreamEvent = useCallback(async (event: StreamEvent) => {
        if (!isMountedRef.current || !userId || isClosedDueToHiddenRef.current) return;

        const decision = decideStreamTransition(streamStateRef.current, event);
        streamStateRef.current = decision.nextState;

        if (decision.action === 'open') {
            setIsConnected(true);
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
            }
            if (fallbackPollTimerRef.current) {
                clearInterval(fallbackPollTimerRef.current);
                fallbackPollTimerRef.current = null;
            }
            if (retryStreamTimerRef.current) {
                clearInterval(retryStreamTimerRef.current);
                retryStreamTimerRef.current = null;
            }
            return;
        }

        setIsConnected(false);

        if (decision.action === 'backoff_reconnect') {
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
            }
            console.info(`[HeaderNotifications] Reconnecting stream in ${decision.delayMs}ms (errors: ${decision.nextState.consecutiveErrors})...`);
            reconnectTimerRef.current = setTimeout(() => {
                connectStreamRef.current();
            }, decision.delayMs);
        } else if (decision.action === 'refresh_auth') {
            // HTTP 401/403: không thử lại stream theo backoff.
            // Gọi một lần GET /notifications qua api (để interceptor xử lý làm mới token / đăng xuất);
            // nếu sau đó vẫn đăng nhập thì kết nối lại một lần, còn 401 nữa thì chuyển hẳn sang poll 60 giây.
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
            }
            try {
                await fetchNotifications();
                const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
                if (isMountedRef.current && token) {
                    connectStreamRef.current();
                }
            } catch (e) {
                console.error('[HeaderNotifications] Auth refresh fetch failed:', e);
            }
        } else if (decision.action === 'poll_fallback') {
            // Khi đã fallback: chỉ có MỘT cơ chế chạy tại một thời điểm:
            // poll 60s + thử stream mỗi 5 phút; lần thử 5 phút thất bại không khởi động lại chuỗi backoff 1s/2s/5s.
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
            }
            if (!fallbackPollTimerRef.current) {
                console.warn('[HeaderNotifications] Fallback to 60s polling mode.');
                fallbackPollTimerRef.current = setInterval(() => {
                    fetchNotifications();
                }, FALLBACK_POLL_INTERVAL_MS);
            }
            if (!retryStreamTimerRef.current) {
                retryStreamTimerRef.current = setInterval(() => {
                    console.info('[HeaderNotifications] Attempting periodic 5m stream reconnect...');
                    connectStreamRef.current();
                }, STREAM_RECONNECT_INTERVAL_MS);
            }
        }
    }, [userId, fetchNotifications]);

    // Main stream connector
    const connectStream = useCallback(() => {
        if (!isMountedRef.current || !userId) return;

        // Abort any active stream before starting a new one
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        const streamUrl = `${API_URL}/notifications/stream`;

        openNotificationStream({
            streamUrl,
            signal: controller.signal,
            onOpen: () => {
                if (!isMountedRef.current || controller.signal.aborted) return;
                handleStreamEvent({ type: 'opened' });
            },
            onEvicted: () => {
                if (!isMountedRef.current || controller.signal.aborted) return;
                handleStreamEvent({ type: 'evicted' });
            },
            onNotification: (noti: NotificationItem) => {
                if (!isMountedRef.current) return;
                setList((prev) => {
                    const next = mergeNotificationItem(prev, noti);
                    setUnreadCount(countUnreadNotifications(next));
                    return next;
                });
                setHasNew(true);
                playNotificationSound();
                setTimeout(() => {
                    if (isMountedRef.current) setHasNew(false);
                }, 3000);
            },
        })
            .then(() => {
                // Connection ended normally (or closed by server/jwt expiry)
                if (!isMountedRef.current || controller.signal.aborted) return;
                handleStreamEvent({ type: 'closed' });
            })
            .catch((err) => {
                if (!isMountedRef.current || controller.signal.aborted) return;
                console.error('[HeaderNotifications] Stream error:', err);
                const status = (err && typeof err === 'object' && 'status' in err) ? (err as any).status : undefined;
                handleStreamEvent({ type: 'failed', status });
            });
    }, [userId, playNotificationSound, handleStreamEvent]);

    useEffect(() => {
        connectStreamRef.current = connectStream;
    }, [connectStream]);

    // Initial load and stream lifecycle
    useEffect(() => {
        isMountedRef.current = true;
        if (!userId) {
            setList([]);
            setUnreadCount(0);
            setLoading(false);
            return;
        }

        fetchNotifications();
        connectStream();

        // Handle tab visibility (hidden > 5 minutes -> close stream)
        const handleVisibilityChange = () => {
            if (document.hidden) {
                hiddenTimerRef.current = setTimeout(() => {
                    isClosedDueToHiddenRef.current = true;
                    if (abortControllerRef.current) {
                        abortControllerRef.current.abort();
                    }
                    clearAllTimers();
                    setIsConnected(false);
                }, HIDDEN_TAB_DISCONNECT_MS);
            } else {
                if (hiddenTimerRef.current) {
                    clearTimeout(hiddenTimerRef.current);
                    hiddenTimerRef.current = null;
                }
                if (isClosedDueToHiddenRef.current) {
                    isClosedDueToHiddenRef.current = false;
                    streamStateRef.current = { ...INITIAL_STREAM_STATE };
                    clearAllTimers();
                    // Catch up missed events
                    fetchNotifications();
                    // Reopen stream
                    connectStream();
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            isMountedRef.current = false;
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            clearAllTimers();
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [userId, fetchNotifications, connectStream, clearAllTimers]);

    const handleRead = async (item: NotificationItem) => {
        if (!item.is_read) {
            try {
                await api.post(`/notifications/${item.id}/read`);
                setList((prev) => {
                    const next = prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n));
                    setUnreadCount(countUnreadNotifications(next));
                    return next;
                });
            } catch (e) {
                console.error('[HeaderNotifications] Failed to mark read:', e);
            }
        }

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
            setList((prev) => prev.map((n) => ({ ...n, is_read: true })));
            setUnreadCount(0);
        } catch (e) {
            console.error('[HeaderNotifications] Failed to read all:', e);
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
                    {isConnected && (
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
                                    borderLeft: item.is_read ? '3px solid transparent' : '3px solid #272F72'
                                }}
                                onClick={() => handleRead(item)}
                            >
                                <List.Item.Meta
                                    avatar={
                                        <Avatar
                                            style={{
                                                backgroundColor: item.type === 'WARNING' ? '#ff4d4f' :
                                                    item.type === 'SUCCESS' ? '#52c41a' : '#272F72',
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
