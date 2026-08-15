import React from 'react';
import { Table, Tag } from 'antd';
import dayjs from 'dayjs';

interface Revision {
    id: number;
    version_number: number;
    created_at: string;
    created_by: string;
    data_snapshot: any;
}

interface Props {
    revisions: Revision[];
    products: any[];
    customers: any[];
}

const QuotationHistoryTab: React.FC<Props> = ({ revisions, products, customers }) => {
    return (
        <div>
            {/* Confirmed Quotation Info */}
            {revisions.length > 0 && (
                <div style={{ marginBottom: 20, padding: 15, background: '#f0f5ff', borderRadius: 8, border: '1px solid #adc6ff' }}>
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12, color: '#1d39c4' }}>
                        📋 Thông tin Báo giá đã xác nhận
                    </div>
                    {(() => {
                        const firstQuote = revisions[0]?.data_snapshot || {};
                        return (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
                                <div><b>Mã:</b> <Tag color="blue">{firstQuote.order_code}</Tag></div>
                                <div><b>Khách hàng:</b> {customers.find((c: any) => c.id === firstQuote.customer_id)?.name || firstQuote.customer_name || '-'}</div>
                                <div><b>Ngày:</b> {firstQuote.order_date ? dayjs(firstQuote.order_date).format('DD/MM/YYYY') : '-'}</div>
                                <div><b>Tổng tiền:</b> <span style={{ color: 'red', fontWeight: 600 }}>{Number(firstQuote.total_amount || 0).toLocaleString()} ₫</span></div>
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* Revisions Table */}
            <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 14 }}>📜 Lịch sử phiên bản ({revisions.length})</div>
            <Table
                dataSource={revisions}
                rowKey="id"
                size="small"
                pagination={false}
                expandable={{
                    expandedRowRender: (record: any) => {
                        const snapshot = record.data_snapshot || {};
                        const snapItems = snapshot.items || [];
                        return (
                            <div style={{ padding: 10, background: '#fafafa' }}>
                                <div style={{ marginBottom: 10, display: 'flex', gap: 15, flexWrap: 'wrap' }}>
                                    <span><b>Mã:</b> {snapshot.order_code}</span>
                                    <span><b>Ngày đặt:</b> {snapshot.order_date ? dayjs(snapshot.order_date).format('DD/MM/YYYY') : '-'}</span>
                                    <span><b>Ngày giao:</b> {snapshot.delivery_date ? dayjs(snapshot.delivery_date).format('DD/MM/YYYY') : '-'}</span>
                                </div>
                                {snapshot.note && <div style={{ marginBottom: 10, fontStyle: 'italic', color: '#666' }}>Ghi chú: {snapshot.note}</div>}
                                <Table
                                    dataSource={snapItems}
                                    rowKey={(r: any) => r?.sku || Math.random()}
                                    size="small"
                                    bordered
                                    pagination={false}
                                    columns={[
                                        {
                                            title: 'Sản phẩm', dataIndex: 'sku',
                                            render: (sku: string) => {
                                                const p = products.find((x: any) => x.sku === sku);
                                                return p ? <div><b>{p.sku}</b> - {p.name}</div> : sku;
                                            }
                                        },
                                        { title: 'SL', dataIndex: 'quantity', width: 60, align: 'center' as const },
                                        { title: 'Đơn giá', dataIndex: 'unit_price', align: 'right' as const, render: (v: any) => Number(v || 0).toLocaleString() },
                                        { title: 'Thành tiền', dataIndex: 'total_price', align: 'right' as const, render: (v: any) => <b>{Number(v || 0).toLocaleString()}</b> }
                                    ]}
                                    summary={() => (
                                        <Table.Summary.Row style={{ background: '#f5f5f5' }}>
                                            <Table.Summary.Cell index={0} colSpan={3} align="right"><b>Tổng cộng:</b></Table.Summary.Cell>
                                            <Table.Summary.Cell index={1} align="right"><b style={{ color: 'red' }}>{Number(snapshot.total_amount || 0).toLocaleString()}</b></Table.Summary.Cell>
                                        </Table.Summary.Row>
                                    )}
                                />
                            </div>
                        );
                    }
                }}
                columns={[
                    { title: 'Version', dataIndex: 'version_number', width: 80, render: (v: number) => <Tag color="geekblue">v{v}</Tag> },
                    { title: 'Ngày tạo', dataIndex: 'created_at', render: (t: string) => dayjs(t).format('DD/MM/YYYY HH:mm') },
                    { title: 'Người tạo', dataIndex: 'created_by' },
                    {
                        title: 'Tổng tiền',
                        render: (_: any, r: any) => {
                            const amt = Number(r.data_snapshot?.total_amount || 0);
                            return <span style={{ fontWeight: 500 }}>{amt.toLocaleString()} ₫</span>;
                        }
                    }
                ]}
            />

            {revisions.length === 0 && (
                <div style={{ textAlign: 'center', padding: 30, color: '#999' }}>
                    Chưa có lịch sử phiên bản. Nhấn "Tạo Version mới" để lưu snapshot đơn hàng hiện tại.
                </div>
            )}
        </div>
    );
};

export default QuotationHistoryTab;
