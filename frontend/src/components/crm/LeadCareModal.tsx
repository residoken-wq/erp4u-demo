import React, { useState, useEffect } from 'react';
import { Modal, Select, Spin, Empty } from 'antd';
import { MessageOutlined, UserOutlined } from '@ant-design/icons';
import LeadCarePanel from './LeadCarePanel';
import api from '../../utils/api';

interface LeadCareModalProps {
    visible: boolean;
    onClose: () => void;
    initialCustomerId?: number;
}

const LeadCareModal: React.FC<LeadCareModalProps> = ({ visible, onClose, initialCustomerId }) => {
    const [customers, setCustomers] = useState<any[]>([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (visible) {
            fetchCustomers();
            if (initialCustomerId) {
                setSelectedCustomerId(initialCustomerId);
            }
        }
    }, [visible, initialCustomerId]);

    useEffect(() => {
        if (selectedCustomerId && customers.length > 0) {
            const found = customers.find(c => c.id === selectedCustomerId);
            setSelectedCustomer(found || null);
        }
    }, [selectedCustomerId, customers]);

    const fetchCustomers = async () => {
        setLoading(true);
        try {
            const res = await api.get('/customers');
            // Filter to show leads preferentially
            const sorted = (res.data || []).sort((a: any, b: any) => {
                if (a.type === 'LEAD' && b.type !== 'LEAD') return -1;
                if (a.type !== 'LEAD' && b.type === 'LEAD') return 1;
                return 0;
            });
            setCustomers(sorted);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    return (
        <Modal
            title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <MessageOutlined style={{ color: '#52c41a' }} />
                    <span>Chăm sóc Lead / Khách hàng</span>
                </div>
            }
            open={visible}
            onCancel={onClose}
            footer={null}
            width={700}
            destroyOnClose
            styles={{ body: { padding: '16px 24px' } }}
        >
            {/* Customer Selector */}
            <div style={{ marginBottom: 16 }}>
                <Select
                    showSearch
                    style={{ width: '100%' }}
                    placeholder="Chọn khách hàng / Lead..."
                    optionFilterProp="label"
                    value={selectedCustomerId}
                    onChange={(val) => setSelectedCustomerId(val)}
                    loading={loading}
                    options={customers.map(c => ({
                        value: c.id,
                        label: `${c.name} (${c.code}) - ${c.type === 'LEAD' ? '🔥 Lead' : '👤 Khách'}`,
                    }))}
                    filterOption={(input, option) =>
                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                />
            </div>

            {/* Lead Care Panel */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
            ) : selectedCustomer ? (
                <LeadCarePanel
                    customerId={selectedCustomer.id}
                    customerName={selectedCustomer.name}
                />
            ) : (
                <Empty
                    description="Chọn khách hàng để bắt đầu chăm sóc"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
            )}
        </Modal>
    );
};

export default LeadCareModal;
