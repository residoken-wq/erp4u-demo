import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, message, Modal, Tooltip, Input } from 'antd';
import { ReloadOutlined, UndoOutlined, AppstoreOutlined, SearchOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';
import api from '../../utils/api';
import dayjs from 'dayjs';

interface BookingListTabProps {
    isMobile: boolean;
}

const BookingListTab: React.FC<BookingListTabProps> = ({ isMobile }) => {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');

    const fetchBookings = async () => {
        setLoading(true);
        try {
            const res = await api.get('/planning/bookings');
            setData(Array.isArray(res.data) ? res.data : []);
        } catch (e) {
            message.error('Lỗi tải danh sách booking');
        }
        setLoading(false);
    };

    useEffect(() => { fetchBookings(); }, []);

    const handleRevert = (itemId: number, sku: string) => {
        Modal.confirm({
            title: 'Chuyển lại trạng thái Chờ duyệt?',
            content: `Booking của sản phẩm ${sku} sẽ chuyển từ "Đã duyệt" về "Chờ duyệt".`,
            okText: 'Xác nhận',
            cancelText: 'Hủy',
            onOk: async () => {
                try {
                    await api.post(`/planning/bookings/${itemId}/revert`);
                    message.success('Đã chuyển về trạng thái Chờ duyệt');
                    fetchBookings();
                } catch (e: any) {
                    message.error(e.response?.data?.message || 'Lỗi revert booking');
                }
            }
        });
    };

    const columns = [
        {
            title: 'Mã KH SX', dataIndex: 'plan_code', width: 110,
            render: (t: string) => t ? <Tag color="blue" style={{ fontWeight: 500 }}>{t}</Tag> : <Tag>Chưa gắn</Tag>
        },
        {
            title: 'Mã SO', dataIndex: 'order_code', width: 120,
            render: (t: string) => <b style={{ color: '#1d39c4' }}>{t}</b>
        },
        {
            title: 'SKU', dataIndex: 'sku', width: 140,
            render: (t: string, r: any) => (
                <span>
                    {r.product_type === 'COMBO' && <AppstoreOutlined style={{ color: '#722ed1', marginRight: 4 }} />}
                    <b>{t}</b>
                    {r.product_type === 'COMBO' && <Tag color="purple" style={{ margin: '0 0 0 4px', fontSize: 10, lineHeight: '16px', padding: '0 3px' }}>COMBO</Tag>}
                </span>
            )
        },
        {
            title: 'Sản phẩm', dataIndex: 'product_name', width: 180,
            ellipsis: true
        },
        { 
            title: 'Khách hàng', dataIndex: 'customer_name', width: 160, ellipsis: true,
            render: (t: any, r: any) => t || r.customer?.name || r.order?.customer_name || r.order?.customer?.name 
        },
        {
            title: 'Ngày giao', dataIndex: 'delivery_date', width: 100,
            render: (d: string) => {
                if (!d) return <span style={{ color: '#bbb' }}>—</span>;
                const dd = dayjs(d);
                const daysLeft = dd.diff(dayjs(), 'day');
                return <Tooltip title={`Còn ${daysLeft} ngày`}><span style={{ color: daysLeft < 0 ? '#f5222d' : daysLeft <= 7 ? '#fa8c16' : undefined }}>{dd.format('DD/MM/YYYY')}</span></Tooltip>;
            }
        },
        { title: 'NV Sale', dataIndex: 'assigned_to_name', width: 120 },
        {
            title: 'SL Book', dataIndex: 'booked_quantity', width: 80, align: 'center' as const,
            render: (v: number) => <b>{Number(v || 0).toLocaleString()}</b>
        },
        {
            title: 'TK Thực tế', dataIndex: 'real_stock', width: 90, align: 'center' as const,
            render: (v: any) => <span style={{ fontWeight: 500 }}>{Number(v || 0).toLocaleString()}</span>
        },
        {
            title: 'Đã duyệt BK', dataIndex: 'approved_booking_stock', width: 100, align: 'center' as const,
            render: (v: any) => v > 0 ? <Tag color="blue" style={{ margin: 0 }}>{Number(v).toLocaleString()}</Tag> : <span style={{ color: '#bbb' }}>0</span>
        },
        {
            title: 'TK Khả dụng', dataIndex: 'available_stock', width: 100, align: 'center' as const,
            render: (v: any, r: any) => {
                const available = Number(v || 0);
                const needed = Number(r.booked_quantity || 0);
                const sufficient = available >= needed;
                return (
                    <span style={{ fontWeight: 'bold', color: sufficient ? '#52c41a' : '#f5222d' }}>
                        {available.toLocaleString()}
                        {sufficient
                            ? <CheckCircleOutlined style={{ marginLeft: 3, fontSize: 11 }} />
                            : <WarningOutlined style={{ marginLeft: 3, fontSize: 11 }} />
                        }
                    </span>
                );
            }
        },
        {
            title: 'Trạng thái', dataIndex: 'booking_status', width: 110, align: 'center' as const,
            render: (s: string) => {
                if (s === 'CONFIRMED') return <Tag color="green">Đã duyệt</Tag>;
                if (s === 'TEMPORARY') return <Tag color="orange">Chờ duyệt</Tag>;
                return <Tag>{s}</Tag>;
            },
            filters: [
                { text: 'Chờ duyệt', value: 'TEMPORARY' },
                { text: 'Đã duyệt', value: 'CONFIRMED' },
            ],
            onFilter: (value: any, record: any) => record.booking_status === value,
        },
        {
            title: 'Hết hạn', dataIndex: 'booking_expires_at', width: 100,
            render: (d: string) => {
                if (!d) return <span style={{ color: '#bbb' }}>—</span>;
                const exp = dayjs(d);
                const isExpired = exp.isBefore(dayjs());
                return <span style={{ color: isExpired ? '#f5222d' : '#888', fontWeight: isExpired ? 600 : 400 }}>{exp.format('DD/MM HH:mm')}</span>;
            }
        },
        {
            title: '', key: 'action', width: 50, align: 'center' as const,
            render: (_: any, record: any) => {
                if (record.booking_status === 'CONFIRMED') {
                    return (
                        <Tooltip title="Chuyển về Chờ duyệt">
                            <Button
                                icon={<UndoOutlined />}
                                size="small"
                                danger
                                onClick={() => handleRevert(record.id, record.sku)}
                            />
                        </Tooltip>
                    );
                }
                return null;
            }
        }
    ];

    // Filter
    const filteredData = searchText
        ? data.filter(d => {
            const cName = d.customer_name || d.customer?.name || d.order?.customer_name || d.order?.customer?.name || '';
            return (d.sku || '').toLowerCase().includes(searchText.toLowerCase()) ||
                (d.order_code || '').toLowerCase().includes(searchText.toLowerCase()) ||
                cName.toLowerCase().includes(searchText.toLowerCase()) ||
                (d.product_name || '').toLowerCase().includes(searchText.toLowerCase());
        })
        : data;

    // Summary stats
    const totalBookings = filteredData.length;
    const pendingCount = filteredData.filter(d => d.booking_status === 'TEMPORARY').length;
    const confirmedCount = filteredData.filter(d => d.booking_status === 'CONFIRMED').length;
    const comboCount = filteredData.filter(d => d.product_type === 'COMBO').length;
    const insufficientCount = filteredData.filter(d => Number(d.available_stock || 0) < Number(d.booked_quantity || 0)).length;

    return (
        <div>
            {/* Summary & Filter Bar */}
            <div style={{
                marginBottom: 12,
                background: 'linear-gradient(135deg, #f0f5ff 0%, #e6f7ff 100%)',
                padding: '10px 16px',
                borderRadius: 8,
                border: '1px solid #adc6ff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8
            }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: '#1d39c4' }}>Tổng: <b>{totalBookings}</b></span>
                    <Tag color="orange" style={{ borderRadius: 10, padding: '0 10px' }}>Chờ duyệt: {pendingCount}</Tag>
                    <Tag color="green" style={{ borderRadius: 10, padding: '0 10px' }}>Đã duyệt: {confirmedCount}</Tag>
                    {comboCount > 0 && <Tag color="purple" style={{ borderRadius: 10, padding: '0 10px' }}>Combo: {comboCount}</Tag>}
                    {insufficientCount > 0 && <Tag color="red" style={{ borderRadius: 10, padding: '0 10px' }}>Thiếu kho: {insufficientCount}</Tag>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <Input.Search
                        placeholder="Tìm SKU, SO, KH..."
                        allowClear
                        size="small"
                        prefix={<SearchOutlined style={{ color: '#bbb' }} />}
                        onChange={(e) => setSearchText(e.target.value)}
                        style={{ width: isMobile ? 160 : 220, borderRadius: 6 }}
                    />
                    <Button icon={<ReloadOutlined />} onClick={fetchBookings} size="small" style={{ borderRadius: 6 }}>Làm mới</Button>
                </div>
            </div>

            <Table
                dataSource={filteredData}
                columns={columns}
                rowKey="id"
                size="small"
                loading={loading}
                pagination={{ pageSize: 20 }}
                scroll={{ x: isMobile ? 1200 : 1600 }}
                rowClassName={(record: any) => {
                    if (record.booking_status === 'CONFIRMED') return 'booking-row-confirmed';
                    if (record.booking_status === 'TEMPORARY') return 'booking-row-temporary';
                    return '';
                }}
                expandable={{
                    expandedRowRender: (record: any) => {
                        if (!record.combo_components?.length) return null;
                        return (
                            <div style={{ padding: '4px 0 4px 10px', background: '#fafafa' }}>
                                <div style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 4, color: '#722ed1' }}>
                                    <AppstoreOutlined /> Thành phần Combo ({record.combo_components.length} SP con):
                                </div>
                                <table style={{ width: '100%', maxWidth: 700, fontSize: 12, borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ background: '#f0f0f0' }}>
                                            <th style={{ padding: '3px 8px', textAlign: 'left', border: '1px solid #e8e8e8' }}>SKU Con</th>
                                            <th style={{ padding: '3px 8px', textAlign: 'left', border: '1px solid #e8e8e8' }}>Tên SP</th>
                                            <th style={{ padding: '3px 8px', textAlign: 'center', border: '1px solid #e8e8e8' }}>SL/Combo</th>
                                            <th style={{ padding: '3px 8px', textAlign: 'center', border: '1px solid #e8e8e8' }}>Cần</th>
                                            <th style={{ padding: '3px 8px', textAlign: 'center', border: '1px solid #e8e8e8' }}>TK Thực tế</th>
                                            <th style={{ padding: '3px 8px', textAlign: 'center', border: '1px solid #e8e8e8' }}>Đã duyệt BK</th>
                                            <th style={{ padding: '3px 8px', textAlign: 'center', border: '1px solid #e8e8e8' }}>TK Khả dụng</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {record.combo_components.map((c: any, idx: number) => {
                                            const childAvailable = Number(c.available_stock || 0);
                                            const childNeeded = Number(c.total_needed || 0);
                                            const sufficient = childAvailable >= childNeeded;
                                            return (
                                                <tr key={idx}>
                                                    <td style={{ padding: '3px 8px', border: '1px solid #e8e8e8', fontWeight: 500 }}>{c.sku}</td>
                                                    <td style={{ padding: '3px 8px', border: '1px solid #e8e8e8' }}>{c.name}</td>
                                                    <td style={{ padding: '3px 8px', textAlign: 'center', border: '1px solid #e8e8e8' }}>x{c.quantity_per_combo}</td>
                                                    <td style={{ padding: '3px 8px', textAlign: 'center', border: '1px solid #e8e8e8', fontWeight: 'bold' }}>{childNeeded.toLocaleString()}</td>
                                                    <td style={{ padding: '3px 8px', textAlign: 'center', border: '1px solid #e8e8e8' }}>{Number(c.real_stock || 0).toLocaleString()}</td>
                                                    <td style={{ padding: '3px 8px', textAlign: 'center', border: '1px solid #e8e8e8' }}>{Number(c.approved_booking_stock || 0).toLocaleString()}</td>
                                                    <td style={{ padding: '3px 8px', textAlign: 'center', border: '1px solid #e8e8e8', fontWeight: 'bold', color: sufficient ? '#52c41a' : '#f5222d' }}>
                                                        {childAvailable.toLocaleString()} {sufficient ? '✓' : `(-${(childNeeded - childAvailable).toLocaleString()})`}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        );
                    },
                    rowExpandable: (record: any) => record.product_type === 'COMBO' && record.combo_components?.length > 0,
                }}
            />

            <style>{`
                .booking-row-confirmed td { background: #f6ffed !important; }
                .booking-row-confirmed:hover td { background: #d9f7be !important; }
                .booking-row-temporary td { background: #fffbe6 !important; }
                .booking-row-temporary:hover td { background: #fff1b8 !important; }
            `}</style>
        </div>
    );
};

export default BookingListTab;
