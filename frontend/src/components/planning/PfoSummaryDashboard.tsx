import React, { useMemo } from 'react';
import { Card, Row, Col, Typography, Alert, Progress, Space, Statistic, Divider } from 'antd';
import { Pie } from '@ant-design/plots';
import dayjs from 'dayjs';
import { RobotOutlined, WarningOutlined, CheckCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

interface PfoSummaryDashboardProps {
    pfoDetails: any;
    selectedPfo: any;
    progressData: any;
    totalEstimatedCost: number;
    totalActualCost: number;
}

const PfoSummaryDashboard: React.FC<PfoSummaryDashboardProps> = ({ 
    pfoDetails, 
    selectedPfo, 
    progressData,
    totalEstimatedCost,
    totalActualCost
}) => {

    const aiAnalysis = useMemo(() => {
        const issues = [];
        let status: 'success' | 'warning' | 'error' | 'info' = 'info';
        
        const deadline = selectedPfo?.committed_finish_date ? dayjs(selectedPfo.committed_finish_date) : null;
        const now = dayjs();
        
        // 1. Analyze Deadline
        if (deadline) {
            const daysLeft = deadline.diff(now, 'day');
            if (daysLeft < 0 && progressData.totalProgress < 100) {
                issues.push(`Đơn hàng đã trễ hạn ${Math.abs(daysLeft)} ngày! Cần đẩy nhanh tiến độ gia công.`);
                status = 'error';
            } else if (daysLeft <= 3 && progressData.totalProgress < 80) {
                issues.push(`Nguy cơ trễ hạn cao. Chỉ còn ${daysLeft} ngày nhưng tiến độ tổng mới đạt ${progressData.totalProgress}%.`);
                status = 'warning';
            } else {
                issues.push(`Thời gian giao hàng còn ${daysLeft} ngày. Mọi thứ đang trong tầm kiểm soát.`);
                if (status === 'info') status = 'success';
            }
        }

        // 2. Analyze NPL Progress
        if (progressData.nplProgress < 100) {
            issues.push(`Vật tư NPL chưa mua đủ (${progressData.nplOrdered}/${progressData.nplRequired} loại). Vui lòng giục nhà cung cấp NPL.`);
            if (status !== 'error') status = 'warning';
        } else {
            issues.push('Đã lên đủ đơn hàng mua Vật tư NPL.');
        }

        // 3. Analyze Costs
        if (totalActualCost > totalEstimatedCost && totalEstimatedCost > 0) {
            const overBudget = totalActualCost - totalEstimatedCost;
            issues.push(`CẢNH BÁO: Chi phí thực tế đang vượt dự kiến ${overBudget.toLocaleString('vi-VN')} ₫. Hãy kiểm soát lại các chi phí phát sinh.`);
            status = 'error';
        }

        return { issues, status };
    }, [selectedPfo, progressData, totalActualCost, totalEstimatedCost]);

    const costData = useMemo(() => {
        return [
            { type: 'Dự kiến', value: totalEstimatedCost },
            { type: 'Thực tế', value: totalActualCost },
        ];
    }, [totalEstimatedCost, totalActualCost]);

    const pieConfig = {
        data: costData,
        angleField: 'value',
        colorField: 'type',
        radius: 0.8,
        label: {
            text: (d: any) => `${d.type}: ${Number(d.value || 0).toLocaleString('vi-VN')} ₫`,
            position: 'outside',
        },
        legend: {
            color: {
                title: false,
                position: 'bottom',
            },
        },
    };

    return (
        <div style={{ padding: 16 }}>
            <Row gutter={[24, 24]}>
                {/* AI Assistant Insight */}
                <Col span={24}>
                    <Card style={{ borderRadius: 12, border: '1px solid #d9d9d9', background: '#f0f5ff' }}>
                        <Title level={5} style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#1d39c4' }}>
                            <RobotOutlined style={{ fontSize: 24 }} />
                            ERP4U AI Assistant - Phân Tích & Dự Báo
                        </Title>
                        <Alert
                            message="Tổng quan Tình trạng Lệnh SX"
                            description={
                                <ul style={{ margin: 0, paddingLeft: 20 }}>
                                    {aiAnalysis.issues.map((issue, idx) => (
                                        <li key={idx} style={{ marginBottom: 4 }}>{issue}</li>
                                    ))}
                                </ul>
                            }
                            type={aiAnalysis.status}
                            showIcon
                            icon={aiAnalysis.status === 'error' ? <WarningOutlined /> : (aiAnalysis.status === 'success' ? <CheckCircleOutlined /> : <InfoCircleOutlined />)}
                            style={{ marginTop: 16, borderRadius: 8 }}
                        />
                    </Card>
                </Col>

                {/* Statistics & Charts */}
                <Col span={24} md={12}>
                    <Card title="Tiến Độ Thực Hiện" style={{ borderRadius: 12, height: '100%' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '20px 0' }}>
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <Text strong>Tiến độ Mua NPL</Text>
                                    <Text type="secondary">{progressData.nplOrdered} / {progressData.nplRequired} Loại</Text>
                                </div>
                                <Progress percent={progressData.nplProgress} status={progressData.nplProgress === 100 ? "success" : "active"} strokeColor={{ '0%': '#108ee9', '100%': '#87d068' }} />
                            </div>
                            
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <Text strong>Tiến độ Gia Công</Text>
                                    <Text type="secondary">{progressData.gcProgress}%</Text>
                                </div>
                                <Progress percent={progressData.gcProgress} status={progressData.gcProgress === 100 ? "success" : "active"} strokeColor={{ '0%': '#722ed1', '100%': '#eb2f96' }} />
                            </div>

                            <Divider dashed />

                            <div style={{ textAlign: 'center' }}>
                                <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>Tiến Độ Tổng Hoàn Thành</Text>
                                <Progress type="circle" percent={progressData.totalProgress} strokeColor={{ '0%': '#108ee9', '100%': '#87d068' }} format={percent => `${percent}%`} />
                            </div>
                        </div>
                    </Card>
                </Col>

                <Col span={24} md={12}>
                    <Card title="Phân Tích Chi Phí" style={{ borderRadius: 12, height: '100%' }}>
                        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                            <Col span={12}>
                                <Statistic 
                                    title="Ngân Sách (Dự kiến)" 
                                    value={totalEstimatedCost} 
                                    suffix="₫" 
                                    valueStyle={{ color: '#fa8c16' }}
                                />
                            </Col>
                            <Col span={12}>
                                <Statistic 
                                    title="Thực tế (PO + Kho)" 
                                    value={totalActualCost} 
                                    suffix="₫" 
                                    valueStyle={{ color: totalActualCost > totalEstimatedCost ? '#cf1322' : '#389e0d' }}
                                />
                            </Col>
                        </Row>
                        <div style={{ height: 250 }}>
                            {(totalEstimatedCost > 0 || totalActualCost > 0) ? (
                                <Pie {...pieConfig} />
                            ) : (
                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#999' }}>
                                    Chưa có dữ liệu chi phí
                                </div>
                            )}
                        </div>
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default PfoSummaryDashboard;
