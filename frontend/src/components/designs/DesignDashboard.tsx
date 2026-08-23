import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Table, Tag } from 'antd';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import api from '../../utils/api';

const DesignDashboard: React.FC = () => {
    const [stats, setStats] = useState<any>({
        total: 0,
        pending: 0,
        inProgress: 0,
        done: 0,
        statusData: [],
        recentOrders: []
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            // Lấy danh sách đơn để tính toán (trong thực tế nên có API dashboard riêng)
            const res = await api.get('/designs/orders');
            const orders = Array.isArray(res.data) ? res.data : [];
            
            const total = orders.length;
            const pending = orders.filter(o => ['INFO_COLLECTED', 'DESIGN_ASSIGNED'].includes(o.status)).length;
            const inProgress = orders.filter(o => ['DESIGNING', 'DEMO_SENT', 'CUSTOMER_REVIEWING'].includes(o.status)).length;
            const done = orders.filter(o => ['CUSTOMER_APPROVED', 'SENT_TO_PRINT', 'PRINTING', 'PRINT_DONE', 'DELIVERED'].includes(o.status)).length;

            const statusCount: any = {};
            orders.forEach(o => {
                statusCount[o.status] = (statusCount[o.status] || 0) + 1;
            });

            const statusData = Object.keys(statusCount).map(key => ({
                name: key,
                value: statusCount[key]
            }));

            setStats({
                total,
                pending,
                inProgress,
                done,
                statusData,
                recentOrders: orders.slice(0, 5)
            });
        } catch (error) {
            console.error('Failed to fetch dashboard data', error);
        }
        setLoading(false);
    };

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

    return (
        <div>
            <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col span={6}>
                    <Card>
                        <Statistic title="Tổng Đơn Thiết Kế" value={stats.total} loading={loading} />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card>
                        <Statistic title="Chờ Xử Lý" value={stats.pending} valueStyle={{ color: '#cf1322' }} loading={loading} />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card>
                        <Statistic title="Đang Thiết Kế/Duyệt" value={stats.inProgress} valueStyle={{ color: '#fa8c16' }} loading={loading} />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card>
                        <Statistic title="Đã Chốt/Đang In" value={stats.done} valueStyle={{ color: '#3f8600' }} loading={loading} />
                    </Card>
                </Col>
            </Row>

            <Row gutter={16}>
                <Col span={8}>
                    <Card title="Trạng Thái Đơn" style={{ minHeight: 350 }}>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={stats.statusData}
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                    label
                                >
                                    {stats.statusData.map((entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </Card>
                </Col>
                <Col span={16}>
                    <Card title="Đơn Mới Gần Đây" style={{ minHeight: 350 }}>
                        <Table 
                            dataSource={stats.recentOrders} 
                            rowKey="id" 
                            pagination={false}
                            size="small"
                            columns={[
                                { title: 'Mã', dataIndex: 'code' },
                                { title: 'Trường', dataIndex: 'school_name' },
                                { title: 'Sản phẩm', dataIndex: 'product_type' },
                                { title: 'Trạng thái', dataIndex: 'status', render: (t: string) => <Tag color="blue">{t}</Tag> },
                                { title: 'Deadline', dataIndex: 'design_deadline', render: (t: string) => t ? new Date(t).toLocaleDateString() : '-' }
                            ]}
                        />
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default DesignDashboard;
