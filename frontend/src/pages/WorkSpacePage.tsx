import React, { useState, useEffect } from 'react';
import { Tabs } from 'antd';
import { CalendarOutlined, MessageOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import TasksPage from './TasksPage';
import DiscussionsPage from './DiscussionsPage';
import { useEntitlements } from '../hooks/useEntitlements';
import { PackageKey } from '../config/packages';

const WorkSpacePage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [activeTab, setActiveTab] = useState('tasks');
    const { isEnabled } = useEntitlements();
    const hasProjects = isEnabled(PackageKey.PROJECTS);

    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const tab = searchParams.get('tab');
        if (tab === 'discussions' && hasProjects) {
            setActiveTab('discussions');
        } else {
            setActiveTab('tasks');
        }
    }, [location, hasProjects]);

    const handleTabChange = (key: string) => {
        setActiveTab(key);
        navigate(`?tab=${key}`, { replace: true });
    };

    const items = [
        {
            key: 'tasks',
            label: (<span><CalendarOutlined /> Công việc & Nhắc nhở</span>),
            children: <div style={{ paddingTop: 10 }}><TasksPage /></div>,
        },
    ];

    if (hasProjects) {
        items.push({
            key: 'discussions',
            label: (<span><MessageOutlined /> Thảo luận</span>),
            children: <div style={{ paddingTop: 10 }}><DiscussionsPage /></div>,
        });
    }

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
