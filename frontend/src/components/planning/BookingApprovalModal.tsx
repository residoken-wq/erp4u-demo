import React, { useState } from 'react';
import { Modal, Table, Button, Tag, Tooltip } from 'antd';
import { CheckCircleOutlined, InfoCircleOutlined, AppstoreOutlined, WarningOutlined, ExclamationCircleOutlined } from '@ant-design/icons';

interface BookingApprovalModalProps {
    open: boolean;
    planName: string;
    items: any[];
    loading: boolean;
    onCancel: () => void;
    onConfirm: (itemIds?: number[]) => void;
}

const BookingApprovalModal: React.FC<BookingApprovalModalProps> = ({
    open,
    planName,
    items,
    loading,
    onCancel,
    onConfirm,
}) => {
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

    // Summary stats
    const temporaryItems = items.filter(i => i.booking_status === 'TEMPORARY');
    const confirmedItems = items.filter(i => i.booking_status === 'CONFIRMED');
    const totalNeeded = temporaryItems.reduce((s, i) => s + Number(i.quantity || 0), 0);
    const sufficientCount = temporaryItems.filter(i => Number(i.available_stock || 0) >= Number(i.quantity || 0)).length;

    const columns = [
        {
            title: 'Mã Đơn',
            dataIndex: 'order_code',
            key: 'order_code',
            width: 120,
            render: (text: string) => <b style={{ color: '#1d39c4' }}>{text}</b>,
        },
        {
            title: 'Khách hàng',
            dataIndex: 'customer_name',
            key: 'customer_name',
            width: 150,
            ellipsis: true,
        },
        {
            title: 'Sản phẩm (SKU)',
            dataIndex: 'sku',
            key: 'sku',
            width: 180,
            render: (text: string, record: any) => (
                <div>
                    <div>
                        {record.product_type === 'COMBO' && <AppstoreOutlined style={{ color: '#722ed1', marginRight: 4 }} />}
                        <b>{text}</b>
                        {record.product_type === 'COMBO' && <Tag color="purple" style={{ margin: '0 0 0 6px', fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>COMBO</Tag>}
                    </div>
                    <div style={{ fontSize: 12, color: '#666' }}>{record.product_name}</div>
                </div>
            )
        },
        {
            title: 'SL Đơn Hàng',
            key: 'quantity',
            align: 'center' as const,
            width: 100,
            render: (_: any, record: any) => <b>{Number(record.quantity || 0).toLocaleString()}</b>
        },
        {
            title: 'TK Thực tế',
            dataIndex: 'real_stock',
            key: 'real_stock',
            align: 'center' as const,
            width: 100,
            render: (v: any) => <span style={{ fontWeight: 500 }}>{Number(v || 0).toLocaleString()}</span>
        },
        {
            title: 'Đã duyệt BK',
            dataIndex: 'approved_booking_stock',
            key: 'approved_booking_stock',
            align: 'center' as const,
            width: 100,
            render: (v: any) => v > 0
                ? <Tag color="blue" style={{ margin: 0 }}>{Number(v).toLocaleString()}</Tag>
                : <span style={{ color: '#bbb' }}>0</span>
        },
        {
            title: 'TK Khả dụng',
            dataIndex: 'available_stock',
            key: 'available_stock',
            align: 'center' as const,
            width: 110,
            render: (v: any, record: any) => {
                const available = Number(v || 0);
                const needed = Number(record.booked_quantity || record.quantity || 0);
                const sufficient = available >= needed;
                return (
                    <span style={{ fontWeight: 'bold', color: sufficient ? '#52c41a' : '#f5222d' }}>
                        {available.toLocaleString()}
                        {sufficient
                            ? <CheckCircleOutlined style={{ marginLeft: 4, fontSize: 11 }} />
                            : <WarningOutlined style={{ marginLeft: 4, fontSize: 11 }} />
                        }
                    </span>
                );
            }
        },
        {
            title: 'Trạng thái',
            dataIndex: 'booking_status',
            key: 'booking_status',
            align: 'center' as const,
            width: 120,
            render: (status: string) => {
                if (status === 'CONFIRMED') return <Tag color="green">Đã duyệt</Tag>;
                if (status === 'TEMPORARY') return <Tag color="orange">Chờ duyệt</Tag>;
                return <Tag>Chưa book</Tag>;
            }
        },
        {
            title: 'Đánh giá',
            key: 'assessment',
            align: 'center' as const,
            width: 140,
            render: (_: any, record: any) => {
                if (record.booking_status === 'CONFIRMED') return <Tag color="green" icon={<CheckCircleOutlined />}>Hoàn tất</Tag>;
                const available = Number(record.available_stock || 0);
                const needed = Number(record.quantity || 0);
                if (available >= needed) return <Tag color="cyan" icon={<CheckCircleOutlined />}>Đủ kho</Tag>;
                if (available > 0) return (
                    <Tooltip title={`Duyệt book: ${available.toLocaleString()} | Tính MRP: ${(needed - available).toLocaleString()}`}>
                        <Tag color="orange" icon={<ExclamationCircleOutlined />}>Duyệt 1 phần</Tag>
                    </Tooltip>
                );
                return <Tag color="red" icon={<WarningOutlined />}>Tính MRP 100%</Tag>;
            }
        }
    ];

    return (
        <Modal
            title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 24 }}>
                    <span style={{ fontSize: 16, fontWeight: 600 }}>Duyệt Book — {planName}</span>
                </div>
            }
            open={open}
            onCancel={onCancel}
            width={1200}
            styles={{ body: { padding: '12px 24px' } }}
            footer={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ color: '#666', fontSize: 13 }}>
                        <InfoCircleOutlined /> Chỉ các mục "Chờ duyệt" mới có thể duyệt.
                    </div>
                    <div>
                        <Button onClick={onCancel} style={{ marginRight: 8 }}>Hủy</Button>
                        <Button
                            type="primary"
                            ghost
                            disabled={selectedRowKeys.length === 0}
                            loading={loading}
                            onClick={() => onConfirm(selectedRowKeys as number[])}
                            style={{ marginRight: 8, borderRadius: 6 }}
                        >
                            Duyệt ({selectedRowKeys.length}) đã chọn
                        </Button>
                        <Button
                            type="primary"
                            icon={<CheckCircleOutlined />}
                            loading={loading}
                            onClick={() => onConfirm()}
                            style={{ borderRadius: 6, fontWeight: 500 }}
                        >
                            Duyệt TẤT CẢ ({temporaryItems.length})
                        </Button>
                    </div>
                </div>
            }
        >
            {/* Summary Stats */}
            <div style={{
                display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap',
                background: 'linear-gradient(135deg, #f0f5ff 0%, #e6f7ff 100%)',
                padding: '10px 16px', borderRadius: 8, border: '1px solid #adc6ff'
            }}>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', flex: 1 }}>
                    <span>Chờ duyệt: <Tag color="orange" style={{ fontSize: 13 }}>{temporaryItems.length}</Tag></span>
                    <span>Đã duyệt: <Tag color="green" style={{ fontSize: 13 }}>{confirmedItems.length}</Tag></span>
                    <span>Đủ kho: <Tag color="cyan" style={{ fontSize: 13 }}>{sufficientCount}/{temporaryItems.length}</Tag></span>
                </div>
            </div>

            <Table
                dataSource={items}
                columns={columns}
                rowKey="id"
                size="small"
                pagination={false}
                scroll={{ y: 450, x: 1100 }}
                rowClassName={(record: any) => {
                    if (record.booking_status === 'CONFIRMED') return 'booking-row-confirmed';
                    const available = Number(record.available_stock || 0);
                    const needed = Number(record.booked_quantity || record.quantity || 0);
                    if (available < needed) return 'booking-row-insufficient';
                    return '';
                }}
                expandable={{
                    expandedRowRender: (record: any) => {
                        if (!record.combo_components?.length) return null;
                        return (
                            <div style={{ padding: '4px 0 4px 10px', background: '#fafafa' }}>
                                <div style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 6, color: '#722ed1' }}>
                                    <AppstoreOutlined /> Thành phần Combo:
                                </div>
                                <table style={{ width: '100%', maxWidth: 700, fontSize: 12, borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ background: '#f0f0f0' }}>
                                            <th style={{ padding: '4px 8px', textAlign: 'left', border: '1px solid #e8e8e8' }}>SKU Con</th>
                                            <th style={{ padding: '4px 8px', textAlign: 'left', border: '1px solid #e8e8e8' }}>Tên SP</th>
                                            <th style={{ padding: '4px 8px', textAlign: 'center', border: '1px solid #e8e8e8' }}>SL/Combo</th>
                                            <th style={{ padding: '4px 8px', textAlign: 'center', border: '1px solid #e8e8e8' }}>Cần</th>
                                            <th style={{ padding: '4px 8px', textAlign: 'center', border: '1px solid #e8e8e8' }}>TK Thực tế</th>
                                            <th style={{ padding: '4px 8px', textAlign: 'center', border: '1px solid #e8e8e8' }}>Đã duyệt BK</th>
                                            <th style={{ padding: '4px 8px', textAlign: 'center', border: '1px solid #e8e8e8' }}>TK Khả dụng</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {record.combo_components.map((c: any, idx: number) => {
                                            const childAvailable = Number(c.available_stock || 0);
                                            const childNeeded = Number(c.total_needed || 0);
                                            const sufficient = childAvailable >= childNeeded;
                                            return (
                                                <tr key={idx}>
                                                    <td style={{ padding: '4px 8px', border: '1px solid #e8e8e8', fontWeight: 500 }}>{c.sku}</td>
                                                    <td style={{ padding: '4px 8px', border: '1px solid #e8e8e8' }}>{c.name}</td>
                                                    <td style={{ padding: '4px 8px', textAlign: 'center', border: '1px solid #e8e8e8' }}>x{c.quantity_per_combo}</td>
                                                    <td style={{ padding: '4px 8px', textAlign: 'center', border: '1px solid #e8e8e8', fontWeight: 'bold' }}>{childNeeded.toLocaleString()}</td>
                                                    <td style={{ padding: '4px 8px', textAlign: 'center', border: '1px solid #e8e8e8' }}>{Number(c.real_stock || 0).toLocaleString()}</td>
                                                    <td style={{ padding: '4px 8px', textAlign: 'center', border: '1px solid #e8e8e8' }}>{Number(c.approved_booking_stock || 0).toLocaleString()}</td>
                                                    <td style={{ padding: '4px 8px', textAlign: 'center', border: '1px solid #e8e8e8', fontWeight: 'bold', color: sufficient ? '#52c41a' : '#f5222d' }}>
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
                rowSelection={{
                    selectedRowKeys,
                    onChange: (keys) => setSelectedRowKeys(keys),
                    getCheckboxProps: (record) => ({
                        disabled: record.booking_status !== 'TEMPORARY',
                    }),
                }}
            />

            <style>{`
                .booking-row-confirmed td { background: #f6ffed !important; }
                .booking-row-insufficient td { background: #fff1f0 !important; }
            `}</style>
        </Modal>
    );
};

export default BookingApprovalModal;
