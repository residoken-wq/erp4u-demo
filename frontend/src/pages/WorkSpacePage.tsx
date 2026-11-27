import React, { useState, useEffect } from 'react';
import { Tabs } from 'antd';
import { CalendarOutlined, MessageOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import TasksPage from './TasksPage';
import DiscussionsPage from './DiscussionsPage';
import { useEntitlements } from '../hooks/useEntitlements';
import { PackageKey } from '../config/packages';
import { getWorkspaceTabKeys } from '../utils/discussionUi';

const WorkSpacePage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [activeTab, setActiveTab] = useState('tasks');
    const { isEnabled } = useEntitlements();
    const hasProjects = isEnabled(PackageKey.PROJECTS);
    const allowedTabs = getWorkspaceTabKeys(hasProjects);

    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const tab = searchParams.get('tab');
        if (tab && allowedTabs.includes(tab)) {
            setActiveTab(tab);
        } else {
            setActiveTab('tasks');
        }
    }, [location, allowedTabs]);

    const handleTabChange = (key: string) => {
        setActiveTab(key);
        navigate(`?tab=${key}`, { replace: true });
    };

    const allItems = [
        {
            key: 'tasks',
            label: (<span><CalendarOutlined /> Công việc & Nhắc nhở</span>),
            children: <div style={{ paddingTop: 10 }}><TasksPage /></div>,
        },
        {
            key: 'discussions',
            label: (<span><MessageOutlined /> Thảo luận</span>),
            children: <div style={{ paddingTop: 10 }}><DiscussionsPage /></div>,
        },
    ];

    const items = allItems.filter(item => allowedTabs.includes(item.key));

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
