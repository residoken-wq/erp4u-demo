import React, { useEffect, useState } from 'react';
import { Button, Steps, Card, Spin, message, Space, Tag, Popconfirm } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import axios from 'axios';

import { API_URL } from '../../config';

interface ProductionStatusTabProps {
    planId: number;
}

const ProductionStatusTab: React.FC<ProductionStatusTabProps> = ({ planId }) => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/planning/${planId}/production-status`);
            setData(res.data);
        } catch (error) {
            console.error('Failed to load production status', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (planId) {
            fetchData();
        }
    }, [planId]);

    const handleInitProduction = async () => {
        setLoading(true);
        try {
            const res = await axios.post(`${API_URL}/planning/${planId}/init-production`);
            message.success(res.data.message);
            fetchData();
        } catch (error) {
            message.error('Khởi tạo thất bại');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStepStatus = async (stepId: number, currentStatus: string) => {
        const nextStatus = currentStatus === 'PENDING' ? 'IN_PROGRESS' : 'COMPLETED';
        try {
            await axios.put(`${API_URL}/production/steps/${stepId}/status`, { status: nextStatus });
            message.success('Cập nhật trạng thái thành công');
            fetchData();
        } catch (error) {
            message.error('Cập nhật thất bại');
        }
    };

    const handleDeleteStep = async (stepId: number) => {
        try {
            await axios.delete(`${API_URL}/production/steps/${stepId}`);
            message.success('Đã xóa công đoạn');
            fetchData();
        } catch (error) {
            message.error('Xóa thất bại');
        }
    };

    if (loading) return <div style={{ textAlign: 'center', padding: 50 }}><Spin /></div>;

    if (!data?.workOrders || data.workOrders.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: 50 }}>
                <h3>Kế hoạch này chưa có Lệnh Sản Xuất</h3>
                <p>Khởi tạo lệnh sản xuất từ Product Routing hoặc Template mặc định</p>
                <Button type="primary" onClick={handleInitProduction}>Khởi tạo Lệnh Sản Xuất</Button>
            </div>
        );
    }

    return (
        <div>
            {data.workOrders.map((wo: any) => {
                const steps = wo.steps?.sort((a: any, b: any) => a.order_index - b.order_index) || [];
                
                return (
                    <Card key={wo.id} size="small" title={`SKU: ${wo.product_sku}`} style={{ marginBottom: 16 }}>
                        <Steps
                            direction="horizontal"
                            size="small"
                            current={steps.findIndex((s: any) => s.status !== 'COMPLETED')}
                            items={steps.map((step: any) => {
                                let status: any = 'wait';
                                if (step.status === 'COMPLETED') status = 'finish';
                                if (step.status === 'IN_PROGRESS') status = 'process';

                                return {
                                    title: step.step_name,
                                    status,
                                    description: (
                                        <div style={{ marginTop: 8, fontSize: 12 }}>
                                            <div style={{ marginBottom: 4 }}>
                                                {step.assigned_to ? <Tag color="blue">{step.assigned_to}</Tag> : <Tag>Chưa giao</Tag>}
                                            </div>
                                            <Space>
                                                {step.status !== 'COMPLETED' && (
                                                    <Button 
                                                        size="small" 
                                                        type={step.status === 'PENDING' ? 'default' : 'primary'}
                                                        onClick={() => handleUpdateStepStatus(step.id, step.status)}
                                                    >
                                                        {step.status === 'PENDING' ? 'Bắt đầu' : 'Hoàn thành'}
                                                    </Button>
                                                )}
                                                <Popconfirm title="Xóa công đoạn này?" onConfirm={() => handleDeleteStep(step.id)}>
                                                    <Button size="small" danger icon={<DeleteOutlined />} />
                                                </Popconfirm>
                                            </Space>
                                        </div>
                                    )
                                };
                            })}
                        />
                    </Card>
                );
            })}
        </div>
    );
};

export default ProductionStatusTab;
