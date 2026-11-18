import React, { useState, useEffect } from 'react';
import { Tabs } from 'antd';
import { CalendarOutlined, MessageOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import TasksPage from './TasksPage';
import DiscussionsPage from './DiscussionsPage';

const WorkSpacePage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [activeTab, setActiveTab] = useState('tasks');

    useEffect(() => {
        // Sync tab with URL query param or path if needed
        const searchParams = new URLSearchParams(location.search);
        const tab = searchParams.get('tab');
        if (tab === 'discussions') {
            setActiveTab('discussions');
        } else {
            setActiveTab('tasks');
        }
    }, [location]);

    const handleTabChange = (key: string) => {
        setActiveTab(key);
        // Optional: Update URL without reloading to keep state linkable
        navigate(`?tab=${key}`, { replace: true });
    };

    const items = [
        {
            key: 'tasks',
            label: (<span><CalendarOutlined /> Công việc & Nhắc nhở</span>),
            children: <div style={{ paddingTop: 10 }}><TasksPage /></div>,
        },
        {
            key: 'discussions',
            label: (<span><MessageOutlined /> Thảo luận & Thông báo</span>),
            children: <div style={{ paddingTop: 10 }}><DiscussionsPage /></div>,
        }
    ];

    return (
        <div style={{ padding: '0 10px' }}>
            <h2>Không gian làm việc</h2>
            <Tabs
                activeKey={activeTab}
                onChange={handleTabChange}
                items={items}
                type="card"
            />
        </div>
    );
};

export default WorkSpacePage;
