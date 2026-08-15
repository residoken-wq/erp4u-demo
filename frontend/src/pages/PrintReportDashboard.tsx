import React, { useState, useEffect, useMemo } from 'react';
import { Card, Table, Typography, DatePicker, Select, Space, Row, Col, Statistic, Button, message } from 'antd';
import { PrinterOutlined, DollarOutlined, AreaChartOutlined, FallOutlined } from '@ant-design/icons';
import api from '../utils/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const PrintReportDashboard: React.FC = () => {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [dateRange, setDateRange] = useState<any>([dayjs().startOf('month'), dayjs().endOf('month')]);

    useEffect(() => {
        fetchData();
    }, [dateRange]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const startDate = dateRange?.[0]?.format('YYYY-MM-DD');
            const endDate = dateRange?.[1]?.format('YYYY-MM-DD');
            const res = await api.get('/reports/print-production', {
                params: { startDate, endDate }
            });
            // Giả sử API trả về mảng các record in ấn. 
            // Nếu API chưa sẵn sàng, res.data có thể rỗng, giao diện vẫn render đúng cấu trúc.
            setData(Array.isArray(res.data) ? res.data : []);
        } catch (e) {
            // Không log lỗi nếu API 404 vì user đã báo API chưa có
            setData([]); 
        }
        setLoading(false);
    };

    // Xử lý dữ liệu để tính toán các công thức và gom nhóm theo ngày (rowSpan)
    const processedData = useMemo(() => {
        // Sort by date first
        const sorted = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        let currentDate = '';
        let dateStartIndex = 0;

        const result: any[] = sorted.map((row, index) => {
            // Công thức tính toán
            const soLanIn = Number(row.print_count) || 0;
            const soConFile = Number(row.items_per_file) || 0;
            const kichThuoc = Number(row.dimension_length) || 0;
            const donGia = Number(row.unit_price) || 0;
            const xuatThucTe = Number(row.actual_exported) || 0;

            const tongSoCon = soLanIn * soConFile;
            const duKienCan = soLanIn * kichThuoc; // Công thức user cung cấp
            const chenhLech = duKienCan - xuatThucTe; // Chênh lệch (File - Thực tế)
            const sxDh = chenhLech * donGia; // Công thức user cung cấp
            const thanhTien = xuatThucTe * donGia; // Tạm tính thành tiền theo xuất thực tế

            const formattedRow = {
                ...row,
                tong_so_con: tongSoCon,
                du_kien_can: duKienCan,
                chenh_lech: chenhLech,
                sx_dh: sxDh,
                thanh_tien: thanhTien,
                key: index
            };

            return formattedRow;
        });

        // Calculate rowSpan for Date column
        result.forEach((row, index) => {
            const dateStr = dayjs(row.date).format('DD/MM/YYYY');
            if (dateStr !== currentDate) {
                currentDate = dateStr;
                dateStartIndex = index;
                row.rowSpan = 1;
            } else {
                result[dateStartIndex].rowSpan += 1;
                row.rowSpan = 0;
            }
            row.formattedDate = dateStr;
        });

        return result;
    }, [data]);

    // Tổng hợp KPI
    const kpis = useMemo(() => {
        return processedData.reduce((acc, curr) => ({
            tongDuKien: acc.tongDuKien + curr.du_kien_can,
            tongThucTe: acc.tongThucTe + (Number(curr.actual_exported) || 0),
            tongChenhLech: acc.tongChenhLech + curr.chenh_lech,
            tongThanhTien: acc.tongThanhTien + curr.thanh_tien
        }), { tongDuKien: 0, tongThucTe: 0, tongChenhLech: 0, tongThanhTien: 0 });
    }, [processedData]);

    const columns: any = [
        {
            title: 'NGÀY',
            dataIndex: 'formattedDate',
            key: 'date',
            render: (text: string, record: any) => {
                const obj = {
                    children: <Text strong style={{ color: '#1890ff' }}>{text}</Text>,
                    props: { rowSpan: record.rowSpan }
                };
                return obj;
            }
        },
        { title: 'NỘI DUNG IN', dataIndex: 'design_name', key: 'design_name' },
        { title: 'IN VẢI', dataIndex: 'fabric_type', key: 'fabric_type' },
        { title: 'Số lần in', dataIndex: 'print_count', key: 'print_count', align: 'center' },
        { title: 'Số con/file', dataIndex: 'items_per_file', key: 'items_per_file', align: 'center' },
        { title: 'Tổng số con', dataIndex: 'tong_so_con', key: 'tong_so_con', align: 'center' },
        { title: 'Khổ', dataIndex: 'fabric_width', key: 'fabric_width', align: 'center' },
        { title: 'Kích thước', dataIndex: 'dimension_length', key: 'dimension_length', align: 'center' },
        { 
            title: 'Dự kiến cần', 
            dataIndex: 'du_kien_can', 
            key: 'du_kien_can', 
            align: 'center',
            render: (val: number) => <span style={{ background: '#fffb8f', padding: '2px 8px', fontWeight: 'bold' }}>{val?.toFixed(2)}</span>
        },
        { title: 'XUẤT THỰC TẾ', dataIndex: 'actual_exported', key: 'actual_exported', align: 'center' },
        { 
            title: 'Chênh lệch file/thực tế', 
            dataIndex: 'chenh_lech', 
            key: 'chenh_lech', 
            align: 'center',
            render: (val: number) => <Text type={val < 0 ? 'danger' : 'success'} strong>{val?.toFixed(2)}</Text>
        },
        { 
            title: 'Đơn giá', 
            dataIndex: 'unit_price', 
            key: 'unit_price', 
            align: 'right',
            render: (val: number) => val?.toLocaleString() 
        },
        { 
            title: 'Thành tiền', 
            dataIndex: 'thanh_tien', 
            key: 'thanh_tien', 
            align: 'right',
            render: (val: number) => val?.toLocaleString() 
        },
        { 
            title: 'SX/ĐH', 
            dataIndex: 'sx_dh', 
            key: 'sx_dh', 
            align: 'right',
            render: (val: number) => <Text type={val < 0 ? 'danger' : 'success'}>{val?.toLocaleString()}</Text>
        },
    ];

    return (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Row gutter={16}>
                <Col span={6}>
                    <Card size="small" bordered={false} style={{ background: '#e6f7ff' }}>
                        <Statistic title="Tổng mét dự kiến" value={kpis.tongDuKien} precision={2} prefix={<AreaChartOutlined />} suffix="m" />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card size="small" bordered={false} style={{ background: '#f6ffed' }}>
                        <Statistic title="Tổng xuất thực tế" value={kpis.tongThucTe} precision={2} prefix={<PrinterOutlined />} suffix="m" />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card size="small" bordered={false} style={{ background: '#fff2f0' }}>
                        <Statistic title="Tổng chênh lệch" value={kpis.tongChenhLech} precision={2} prefix={<FallOutlined />} suffix="m" valueStyle={{ color: kpis.tongChenhLech < 0 ? '#cf1322' : '#3f8600' }} />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card size="small" bordered={false} style={{ background: '#f9f0ff' }}>
                        <Statistic title="Tổng thành tiền" value={kpis.tongThanhTien} prefix={<DollarOutlined />} suffix="VNĐ" />
                    </Card>
                </Col>
            </Row>

            <Card 
                title="Báo cáo Gia công In" 
                extra={
                    <Space>
                        <RangePicker value={dateRange} onChange={setDateRange} format="DD/MM/YYYY" />
                        <Button type="primary" onClick={fetchData}>Lọc báo cáo</Button>
                    </Space>
                }
            >
                <Table 
                    columns={columns} 
                    dataSource={processedData} 
                    loading={loading}
                    bordered
                    pagination={false}
                    scroll={{ x: 1300 }}
                    size="small"
                />
            </Card>
        </Space>
    );
};

export default PrintReportDashboard;
