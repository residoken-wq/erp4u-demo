import React, { useState, useEffect } from 'react';
import { Button, message, Modal, Input } from 'antd';
import { CaretRightOutlined, PauseOutlined, HistoryOutlined } from '@ant-design/icons';
import api from '../utils/api';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';

dayjs.extend(duration);

interface TaskTimerProps {
    taskId: number;
    onUpdate?: () => void;
}

const TaskTimer: React.FC<TaskTimerProps> = ({ taskId, onUpdate }) => {
    const [isRunning, setIsRunning] = useState(false);
    const [seconds, setSeconds] = useState(0);
    const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [logDescription, setLogDescription] = useState('');

    const user = JSON.parse(localStorage.getItem('user') || '{}');

    useEffect(() => {
        checkRunningTimer();
        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [taskId]);

    const checkRunningTimer = async () => {
        try {
            // Check if user has an active timer for this task
            // We need an endpoint to check active status specifically, or we check logs
            const res = await api.get(`/tasks/${taskId}/logs`);
            const logs = res.data;
            const activeLog = logs.find((l: any) => l.user_id === user.id && !l.end_time);

            if (activeLog) {
                setIsRunning(true);
                const startTime = dayjs(activeLog.start_time);
                const now = dayjs();
                const diff = now.diff(startTime, 'second');
                setSeconds(diff);
                startLocalTimer();
            } else {
                setIsRunning(false);
                setSeconds(0);
                if (intervalId) clearInterval(intervalId);
            }
        } catch (e) { console.error('Error checking timer', e); }
    };

    const startLocalTimer = () => {
        if (intervalId) clearInterval(intervalId);
        const id = setInterval(() => {
            setSeconds(prev => prev + 1);
        }, 1000);
        setIntervalId(id);
    };

    const handleStart = async () => {
        try {
            await api.post(`/tasks/${taskId}/start-timer`, { user_id: user.id });
            setIsRunning(true);
            message.success('Timer started');
            startLocalTimer();
            if (onUpdate) onUpdate();
        } catch (e) { message.error('Failed to start timer'); }
    };

    const handleStopClick = () => {
        setIsModalOpen(true);
    };

    const handleConfirmStop = async () => {
        try {
            await api.post(`/tasks/${taskId}/stop-timer`, {
                user_id: user.id,
                description: logDescription
            });
            setIsRunning(false);
            if (intervalId) clearInterval(intervalId);
            setIsModalOpen(false);
            setLogDescription('');
            message.success('Timer stopped and logged');
            if (onUpdate) onUpdate();
        } catch (e) { message.error('Failed to stop timer'); }
    };

    const formatTime = (totalSeconds: number) => {
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div style={{ display: 'inline-block' }}>
            {!isRunning ? (
                <Button
                    type="primary"
                    shape="round"
                    icon={<CaretRightOutlined />}
                    onClick={handleStart}
                    style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                >
                    Start Working
                </Button>
            ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                        fontFamily: 'monospace',
                        fontSize: 16,
                        fontWeight: 'bold',
                        color: '#1890ff',
                        padding: '4px 12px',
                        background: '#e6f7ff',
                        borderRadius: 16
                    }}>
                        {formatTime(seconds)}
                    </div>
                    <Button
                        danger
                        shape="round"
                        icon={<PauseOutlined />}
                        onClick={handleStopClick}
                    >
                        Stop
                    </Button>
                </div>
            )}

            <Modal
                title="Log Work"
                open={isModalOpen}
                onOk={handleConfirmStop}
                onCancel={() => setIsModalOpen(false)}
            >
                <p>Describe what you worked on:</p>
                <Input.TextArea
                    rows={3}
                    value={logDescription}
                    onChange={e => setLogDescription(e.target.value)}
                    placeholder="E.g. Fixed bug in login module..."
                />
            </Modal>
        </div>
    );
};

export default TaskTimer;
