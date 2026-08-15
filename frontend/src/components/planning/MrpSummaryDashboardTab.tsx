import React, { useState, useEffect } from 'react';
import { Card, Table, Select, DatePicker, Button, Tabs, Row, Col, Typography, Space, Tag, message } from 'antd';
import { SearchOutlined, AppstoreOutlined, ScissorOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { API_URL } from '../../config';

const { RangePicker } = DatePicker;
const { Text } = Typography;

interface MrpSummaryDashboardTabProps {
    isMobile?: boolean;
}

const MrpSummaryDashboardTab: React.FC<MrpSummaryDashboardTabProps> = ({ isMobile }) => {
    const [loading, setLoading] = useState(false);
    const [mrpSummary, setMrpSummary] = useState<any[]>([]);
    const [outsourcingSummary, setOutsourcingSummary] = useState<any[]>([]);
    const [planCodes, setPlanCodes] = useState<string[]>([]);
    const [customerList, setCustomerList] = useState<string[]>([]);
    
    // Filters
    const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().startOf('month'), dayjs().endOf('month')]);
    const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const params: any = {};
            if (dateRange && dateRange[0] && dateRange[1]) {
                params.from_date = dateRange[0].format('YYYY-MM-DD');
                params.to_date = dateRange[1].format('YYYY-MM-DD');
            }
            if (selectedCustomers && selectedCustomers.length > 0) {
                params.customers = selectedCustomers.join(',');
            }

            const res = await axios.get(`${API_URL}/planning/summary-dashboard`, { params });
            setMrpSummary(res.data.mrp_summary || []);
            setOutsourcingSummary(res.data.outsourcing_summary || []);
            setPlanCodes(res.data.plan_codes || []);
            setCustomerList(res.data.customer_list || []);
        } catch (error) {
            message.error('Lỗi khi tải dữ liệu tổng hợp');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []); // Chỉ gọi lần đầu, sau đó user tự bấm tìm kiếm

    const handleSearch = () => {
        fetchData();
    };

    // Columns for NPL
    const nplColumns = [
        { title: 'Mã NPL', dataIndex: 'material_code', render: (t: any) => <b>{t}</b> },
        { title: 'Tên NPL', dataIndex: 'material_name' },
        { title: 'ĐVT', dataIndex: 'unit', width: 80, align: 'center' as const },
        { title: 'Tổng Cần (Gốc)', dataIndex: 'gross_raw', align: 'right' as const, render: (v: any) => Number(v || 0).toLocaleString() },
        { title: '% Hao hụt', dataIndex: 'wastage_percent', align: 'center' as const, render: (v: any) => `${v || 0}%` },
        { title: 'Tổng Cần (+Hao hụt)', dataIndex: 'gross_requirement', align: 'right' as const, render: (v: any) => <b>{Number(v || 0).toLocaleString()}</b> },
        { title: 'Tồn Kho Nhà Máy', dataIndex: 'available_stock', align: 'right' as const, render: (v: any) => <span style={{ color: '#52c41a' }}>{Number(v || 0).toLocaleString()}</span> },
        { title: 'Tồn Kho NCC', dataIndex: 'supplier_stock', align: 'right' as const, render: (v: any) => <span style={{ color: '#eb2f96' }}>{Number(v || 0).toLocaleString()}</span> },
        { title: 'Cần Mua', dataIndex: 'net_requirement', align: 'right' as const, render: (v: any) => <span style={{ color: '#cf1322', fontWeight: 'bold' }}>{Number(v || 0).toLocaleString()}</span> },
        { title: 'Đơn Giá (Tham khảo)', dataIndex: 'reference_price', align: 'right' as const, render: (v: any) => Number(v || 0).toLocaleString() },
        { 
            title: 'Thành Tiền', 
            key: 'total_money', 
            align: 'right' as const, 
            render: (_: any, record: any) => {
                const total = Number(record.net_requirement || 0) * Number(record.reference_price || 0);
                return <b style={{ color: '#096dd9' }}>{total.toLocaleString()}</b>;
            }
        },
        { title: 'Nhà Cung Cấp', dataIndex: 'supplier_name' }
    ];

    // Columns for Gia Công
    const gcColumns = [
        { title: 'Sản Phẩm', dataIndex: 'product_sku', render: (t: any) => <b>{t}</b> },
        { title: 'Công Đoạn', dataIndex: 'step_name' },
        { title: 'Nhà Gia Công', dataIndex: 'supplier_name' },
        { title: 'Tổng Số Lượng', dataIndex: 'quantity', align: 'right' as const, render: (v: any) => <b>{Number(v || 0).toLocaleString()}</b> },
        { title: 'Đơn Giá', dataIndex: 'unit_price', align: 'right' as const, render: (v: any) => Number(v || 0).toLocaleString() },
        { title: 'Thành Tiền', dataIndex: 'total_cost', align: 'right' as const, render: (v: any) => <b style={{ color: '#d46b08' }}>{Number(v || 0).toLocaleString()}</b> }
    ];

    return (
        <Card title="Tổng Hợp Nhu Cầu Theo Thời Gian">
            <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                <Col xs={24} sm={24} md={8}>
                    <Text strong>Khoảng thời gian (Ngày tạo Kế Hoạch):</Text>
                    <RangePicker 
                        style={{ width: '100%', marginTop: 8 }} 
                        value={dateRange} 
                        onChange={(dates) => setDateRange(dates as any)}
                        allowClear={false}
                    />
                </Col>
                <Col xs={24} sm={24} md={12}>
                    <Text strong>Khách hàng:</Text>
                    <Select
                        mode="multiple"
                        style={{ width: '100%', marginTop: 8 }}
                        placeholder="Chọn khách hàng (để trống là tất cả)"
                        value={selectedCustomers}
                        onChange={setSelectedCustomers}
                        options={customerList.map(c => ({ label: c, value: c }))}
                        allowClear
                        maxTagCount="responsive"
                    />
                </Col>
                <Col xs={24} sm={24} md={4} style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch} loading={loading} style={{ width: '100%' }}>
                        Lọc Dữ Liệu
                    </Button>
                </Col>
            </Row>

            <div style={{ marginBottom: 20 }}>
                {planCodes.length > 0 ? (
                    <Space size={[0, 8]} wrap>
                        <Text>Đang tổng hợp từ <b>{planCodes.length}</b> kế hoạch:</Text>
                        {planCodes.map(code => <Tag color="blue" key={code}>{code}</Tag>)}
                    </Space>
                ) : (
                    <Text type="secondary">Không tìm thấy kế hoạch nào trong khoảng thời gian này.</Text>
                )}
            </div>

            <Tabs 
                defaultActiveKey="1"
                items={[
                    {
                        key: '1',
                        label: <span><AppstoreOutlined /> 1. Tổng Hợp Nhu Cầu Nguyên Phụ Liệu (NPL)</span>,
                        children: (
                            <Table 
                                columns={nplColumns} 
                                dataSource={mrpSummary} 
                                rowKey="material_id"
                                loading={loading}
                                size="small"
                                pagination={{ pageSize: 50 }}
                                scroll={{ x: isMobile ? 1200 : undefined, y: 500 }}
                                expandable={{
                                    rowExpandable: (record) => record.details && record.details.length > 0,
                                    expandedRowRender: (record) => {
                                        return (
                                            <div style={{ padding: '10px 20px', background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 4 }}>
                                                <div style={{ fontWeight: 'bold', marginBottom: 10, color: '#096dd9' }}>Chi tiết nhu cầu (đã gộp các đơn):</div>
                                                <Table 
                                                    dataSource={record.details} 
                                                    rowKey={(r, i) => `${r.product_name}_${i}`}
                                                    pagination={false}
                                                    size="small"
                                                    columns={[
                                                        { title: 'Tên Sản Phẩm', dataIndex: 'product_name', render: (t) => <b>{t}</b> },
                                                        { title: 'SL SP Cần SX', dataIndex: 'qty_needed', align: 'right' as const, render: (v) => Number(v || 0).toLocaleString() },
                                                        { title: 'Định Mức / SP', dataIndex: 'bom_quantity', align: 'right' as const },
                                                        { title: '% Hao hụt', dataIndex: 'waste_percent', align: 'center' as const, render: (v) => `${v || 0}%` },
                                                        { title: 'Cần mua (Sau hao hụt)', dataIndex: 'gross_req', align: 'right' as const, render: (v) => <b>{Number(v || 0).toLocaleString()}</b> },
                                                    ]}
                                                />
                                            </div>
                                        )
                                    }
                                }}
                                summary={(pageData) => {
                                    const totalAmount = pageData.reduce((prev, current) => {
                                        return prev + (Number(current.net_requirement || 0) * Number(current.reference_price || 0));
                                    }, 0);
                                    return (
                                        <Table.Summary.Row style={{ background: '#fafafa' }}>
                                            <Table.Summary.Cell index={0} colSpan={9} align="right">
                                                <Text strong>Tổng Thành Tiền Mua NPL:</Text>
                                            </Table.Summary.Cell>
                                            <Table.Summary.Cell index={1} align="right">
                                                <Text strong style={{ color: '#096dd9', fontSize: '1.1em' }}>{totalAmount.toLocaleString()}</Text>
                                            </Table.Summary.Cell>
                                            <Table.Summary.Cell index={2} />
                                        </Table.Summary.Row>
                                    );
                                }}
                            />
                        )
                    },
                    {
                        key: '2',
                        label: <span><ScissorOutlined /> 2. Tổng Hợp Nhu Cầu Gia Công (GC)</span>,
                        children: (
                            <Table 
                                columns={gcColumns} 
                                dataSource={outsourcingSummary} 
                                rowKey={(r) => `${r.product_sku}_${r.step_name}`}
                                loading={loading}
                                size="small"
                                pagination={{ pageSize: 50 }}
                                scroll={{ x: isMobile ? 800 : undefined, y: 500 }}
                                summary={(pageData) => {
                                    const totalAmount = pageData.reduce((prev, current) => prev + Number(current.total_cost || 0), 0);
                                    return (
                                        <Table.Summary.Row style={{ background: '#fafafa' }}>
                                            <Table.Summary.Cell index={0} colSpan={5} align="right">
                                                <Text strong>Tổng Thành Tiền Gia Công:</Text>
                                            </Table.Summary.Cell>
                                            <Table.Summary.Cell index={1} align="right">
                                                <Text strong style={{ color: '#d46b08', fontSize: '1.1em' }}>{totalAmount.toLocaleString()}</Text>
                                            </Table.Summary.Cell>
                                        </Table.Summary.Row>
                                    );
                                }}
                            />
                        )
                    }
                ]}
            />
        </Card>
    );
};

export default MrpSummaryDashboardTab;
