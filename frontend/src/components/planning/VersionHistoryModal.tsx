import React, { useEffect, useState } from 'react';
import { Modal, Table, Tag, Typography } from 'antd';
import axios from 'axios';
import dayjs from 'dayjs';

const { Text } = Typography;
import { API_URL } from '../../config';

interface VersionHistoryModalProps {
    planId: number;
    open: boolean;
    onClose: () => void;
}

const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({ planId, open, onClose }) => {
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open && planId) {
            fetchHistory();
        }
    }, [open, planId]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/planning/${planId}/history`);
            setHistory(res.data);
        } catch (error) {
            console.error('Failed to fetch history:', error);
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        { title: 'Version', dataIndex: 'version', width: 80, render: (v: any) => <b>V{v}</b> },
        { title: 'Thời gian', dataIndex: 'created_at', width: 160, render: (v: any) => dayjs(v).format('DD/MM/YYYY HH:mm') },
        { title: 'Người thực hiện', dataIndex: 'created_by', width: 150 },
        { 
            title: 'Tóm tắt', 
            dataIndex: 'changes_summary', 
            render: (v: any) => (
                <div>
                    <Tag color={v?.type === 'MRP_SAVE' ? 'blue' : 'orange'}>{v?.type}</Tag>
                    <Text>{v?.description}</Text>
                </div>
            )
        }
    ];

    return (
        <Modal
            title={`Lịch sử thay đổi Kế hoạch`}
            open={open}
            onCancel={onClose}
            footer={null}
            width={800}
        >
            <Table
                dataSource={history}
                columns={columns}
                rowKey="id"
                loading={loading}
                pagination={false}
                size="small"
                scroll={{ y: 400 }}
            />
        </Modal>
    );
};

export default VersionHistoryModal;
