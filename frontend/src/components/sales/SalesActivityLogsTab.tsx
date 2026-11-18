import React, { useEffect, useState } from 'react';
import { Table, Spin, message, Typography } from 'antd';
import dayjs from 'dayjs';
import api from '../../utils/api';

const { Text } = Typography;

interface Props {
    orderId: number;
}

const SalesActivityLogsTab: React.FC<Props> = ({ orderId }) => {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (orderId) {
            fetchLogs();
        }
    }, [orderId]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/sales/${orderId}/activities`);
            setLogs(res.data || []);
        } catch (error) {
            message.error('Không thể tải lịch sử hoạt động');
        } finally {
            setLoading(false);
        }
    };

    const renderDiff = (details: any) => {
        if (!details || !details.new) return '-';
        const changes: React.ReactNode[] = [];
        
        const oldData = details.old || {};
        const newData = details.new || {};
        
        const allKeys = Array.from(new Set([...Object.keys(oldData), ...Object.keys(newData)]));
        
        allKeys.forEach(key => {
            if (key === 'updated_at' || key === 'created_at') return;
            let oldVal = oldData[key];
            let newVal = newData[key];
            
            if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
                changes.push(
                    <div key={key} style={{ marginBottom: 4 }}>
                        <Text strong>{key}: </Text>
                        <Text type="secondary" delete>{typeof oldVal === 'object' ? JSON.stringify(oldVal) : String(oldVal || 'Trống')}</Text>
                        {' ➡️ '}
                        <Text type="success">{typeof newVal === 'object' ? JSON.stringify(newVal) : String(newVal || 'Trống')}</Text>
                    </div>
                );
            }
        });
        
        if (changes.length === 0) return JSON.stringify(details);
        return changes;
    };

    const columns = [
        {
            title: 'Ngày giờ cập nhật',
            dataIndex: 'timestamp',
            key: 'timestamp',
            width: 160,
            render: (text: string) => dayjs(text).format('DD/MM/YYYY HH:mm:ss')
        },
        {
            title: 'Hành động',
            dataIndex: 'action',
            key: 'action',
            width: 120,
        },
        {
            title: 'User thay đổi (Họ tên)',
            dataIndex: 'full_name',
            key: 'full_name',
            width: 180,
            render: (text: string, record: any) => text || record.username || 'System'
        },
        {
            title: 'Chi tiết thay đổi (Giá trị cũ ➡️ Giá trị mới)',
            dataIndex: 'details',
            key: 'details',
            render: (details: any) => renderDiff(details)
        }
    ];

    return (
        <div>
            {loading ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <Spin size="large" />
                </div>
            ) : (
                <Table
                    columns={columns}
                    dataSource={logs}
                    rowKey="id"
                    pagination={{ pageSize: 20 }}
                    size="small"
                />
            )}
        </div>
    );
};

export default SalesActivityLogsTab;
