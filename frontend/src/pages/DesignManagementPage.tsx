import React, { useState, useEffect } from 'react';
import { Tabs, Table, Button, Popconfirm, message, Space, Tag } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import UnifiedDesignWorkflow from '../components/production/UnifiedDesignWorkflow';
import api from '../utils/api';

import DesignDashboard from '../components/designs/DesignDashboard';
import DesignOrderList from '../components/designs/DesignOrderList';
import PrintSheetManager from '../components/designs/PrintSheetManager';

const { TabPane } = Tabs;

const DesignManagementPage: React.FC = () => {
    return (
        <div style={{ padding: 24, background: '#fff', minHeight: '100vh' }}>
            <h2 style={{ marginBottom: 24 }}>Quản lý Thiết Kế & In Ấn</h2>
            <Tabs defaultActiveKey="dashboard">
                <TabPane tab="Dashboard" key="dashboard">
                    <DesignDashboard />
                </TabPane>
                <TabPane tab="Đơn Thiết Kế" key="orders">
                    <DesignOrderList />
                </TabPane>
                <TabPane tab="Xếp Sơ Đồ Đa Mặt" key="workflow">
                    <UnifiedDesignWorkflow />
                </TabPane>
                <TabPane tab="Bảng Gửi Xưởng In" key="print_sheet">
                    <PrintSheetManager />
                </TabPane>
            </Tabs>
        </div>
    );
};

export default DesignManagementPage;
