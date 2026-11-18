import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Table, Typography, Space, Button, Alert, Tag } from 'antd';
import { RobotOutlined, CheckCircleOutlined, MessageOutlined, SyncOutlined, UserOutlined } from '@ant-design/icons';
import api from '../utils/api';

const { Title, Text } = Typography;

const AiDashboardPage: React.FC = () => {
    const [stats, setStats] = useState<any>(null);
    const [insights, setInsights] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [statsRes, insightsRes] = await Promise.all([
                api.get('/ai/analytics'),
                api.get('/ai/proactive')
            ]);
            setStats(statsRes.data);
            setInsights(insightsRes.data);
        } catch (error) {
            console.error('Failed to load AI data', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const columns = [
        { title: 'Ngày tạo', dataIndex: 'created_at', render: (val: string) => new Date(val).toLocaleString() },
        { title: 'Câu hỏi', dataIndex: 'original_question' },
        { title: 'Trả lời', dataIndex: 'original_answer', ellipsis: true },
        { title: 'Đánh giá', dataIndex: 'rating', render: (val: string) => val === 'GOOD' ? <Tag color="green">GOOD</Tag> : <Tag color="red">BAD</Tag> },
        { title: 'Góp ý', dataIndex: 'user_correction' },
    ];

    return (
        <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Title level={3}><RobotOutlined /> AI Assistant Dashboard</Title>
                <Button icon={<SyncOutlined />} onClick={fetchData} loading={loading}>Làm mới</Button>
            </div>

            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col span={8}>
                    <Card>
                        <Statistic title="Tổng số tin nhắn" value={stats?.totalRequests || 0} prefix={<MessageOutlined />} />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card>
                        <Statistic title="Người dùng tương tác" value={stats?.activeUsers || 0} prefix={<UserOutlined />} />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card>
                        <Statistic title="Độ chính xác" value={stats?.accuracy || '100%'} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#3f8600' }} />
                    </Card>
                </Col>
            </Row>

            <Title level={4}>💡 Gợi ý từ AI (Proactive)</Title>
            <div style={{ marginBottom: 24 }}>
                {insights.length === 0 ? <Text type="secondary">Chưa có gợi ý nào hôm nay.</Text> : (
                    insights.map((insight, idx) => (
                        <Alert 
                            key={idx} 
                            message={insight.title} 
                            description={insight.message} 
                            type={insight.type.toLowerCase()} 
                            showIcon 
                            action={<Button size="small" type="primary" onClick={() => window.location.href = insight.actionUrl}>Xem chi tiết</Button>}
                            style={{ marginBottom: 12 }}
                        />
                    ))
                )}
            </div>

            <Title level={4}>📝 Lịch sử phản hồi (Feedback Loop)</Title>
            <Card>
                <Table 
                    dataSource={stats?.recentFeedbacks || []} 
                    columns={columns} 
                    rowKey="id" 
                    loading={loading}
                    pagination={{ pageSize: 5 }}
                />
            </Card>
        </div>
    );
};

export default AiDashboardPage;
