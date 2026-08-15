import React from 'react';
import { Modal, Table, Button, Tag } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

interface Revision {
    id: number;
    version_number: number;
    created_at: string;
    created_by: string;
    data_snapshot: any;
}

interface Product {
    value: string;
    label: string;
    description?: string;
}

interface Customer {
    id: number;
    name: string;
}

interface Props {
    open: boolean;
    onClose: () => void;
    revisions: Revision[];
    products: Product[];
    customers: Customer[];
}

const RevisionHistoryModal: React.FC<Props> = ({
    open,
    onClose,
    revisions,
    products,
    customers,
}) => {
    const showRevisionDetail = (r: Revision) => {
        const snapshot = r.data_snapshot || {};
        const snapItems = snapshot.items || [];

        Modal.info({
            title: `Chi tiết version ${r.version_number} - ${dayjs(r.created_at).format('DD/MM/YYYY HH:mm')}`,
            width: 900,
            icon: <HistoryOutlined />,
            content: (
                <div>
                    <div style={{ marginBottom: 15, display: 'flex', gap: 20, flexWrap: 'wrap', background: '#f5f5f5', padding: 10, borderRadius: 6 }}>
                        <div><b>Mã:</b> {snapshot.order_code}</div>
                        <div><b>Khách hàng:</b> {customers.find(c => c.id === snapshot.customer_id)?.name || snapshot.customer_name || snapshot.customer_id}</div>
                        <div><b>Ngày đặt:</b> {dayjs(snapshot.order_date).format('DD/MM/YYYY')}</div>
                        <div><b>Ngày giao:</b> {snapshot.delivery_date ? dayjs(snapshot.delivery_date).format('DD/MM/YYYY') : 'N/A'}</div>
                    </div>
                    {snapshot.note && <div style={{ marginBottom: 10, fontStyle: 'italic' }}>Ghi chú: {snapshot.note}</div>}

                    <Table
                        dataSource={snapItems}
                        rowKey={(rec: any) => rec?.sku || rec || Math.random()}
                        pagination={false}
                        size="small"
                        bordered
                        columns={[
                            {
                                title: 'Sản phẩm', dataIndex: 'sku',
                                render: (sku: string) => {
                                    const p = products.find(x => x.value === sku);
                                    return p ? (
                                        <div>
                                            <b>{p.label || sku}</b>
                                            <div style={{ fontSize: 11, color: '#888' }}>{p.description}</div>
                                        </div>
                                    ) : sku
                                }
                            },
                            { title: 'SL', dataIndex: 'quantity', width: 60, align: 'center' as const },
                            { title: 'Đơn giá', dataIndex: 'unit_price', align: 'right' as const, render: (v: any) => Number(v).toLocaleString() },
                            { 
                                title: 'Thành tiền', 
                                key: 'total_price', 
                                align: 'right' as const, 
                                render: (_: any, r: any) => {
                                    const itemTotal = Number(r.subtotal) || Number(r.total_price) || (Number(r.quantity || 0) * Number(r.unit_price || 0));
                                    return <b>{itemTotal.toLocaleString()}</b>;
                                } 
                            }
                        ]}
                        summary={() => {
                            const subtotal = snapItems.reduce((s: number, i: any) => {
                                const itemTotal = Number(i.subtotal) || Number(i.total_price) || (Number(i.quantity || 0) * Number(i.unit_price || 0));
                                return s + itemTotal;
                            }, 0);
                            return (
                                <>
                                    <Table.Summary.Row>
                                        <Table.Summary.Cell index={0} colSpan={3} align="right">Tổng tiền hàng</Table.Summary.Cell>
                                        <Table.Summary.Cell index={1} align="right">{subtotal.toLocaleString()}</Table.Summary.Cell>
                                    </Table.Summary.Row>
                                    {Number(snapshot.discount_amount) > 0 && (
                                        <Table.Summary.Row>
                                            <Table.Summary.Cell index={0} colSpan={3} align="right">Giảm giá</Table.Summary.Cell>
                                            <Table.Summary.Cell index={1} align="right"><span style={{ color: 'green' }}>-{Number(snapshot.discount_amount).toLocaleString()}</span></Table.Summary.Cell>
                                        </Table.Summary.Row>
                                    )}
                                    {Number(snapshot.vat_rate) > 0 && (
                                        <Table.Summary.Row>
                                            <Table.Summary.Cell index={0} colSpan={3} align="right">VAT ({snapshot.vat_rate}%)</Table.Summary.Cell>
                                            <Table.Summary.Cell index={1} align="right">
                                                {((Number(snapshot.total_amount) - Number(snapshot.shipping_fee || 0)) - (subtotal - Number(snapshot.discount_amount || 0))).toLocaleString()}
                                            </Table.Summary.Cell>
                                        </Table.Summary.Row>
                                    )}
                                    {Number(snapshot.shipping_fee) > 0 && (
                                        <Table.Summary.Row>
                                            <Table.Summary.Cell index={0} colSpan={3} align="right">Phí vận chuyển</Table.Summary.Cell>
                                            <Table.Summary.Cell index={1} align="right">{Number(snapshot.shipping_fee).toLocaleString()}</Table.Summary.Cell>
                                        </Table.Summary.Row>
                                    )}
                                    <Table.Summary.Row style={{ background: '#fafafa' }}>
                                        <Table.Summary.Cell index={0} colSpan={3} align="right"><b style={{ fontSize: 15 }}>TỔNG CỘNG</b></Table.Summary.Cell>
                                        <Table.Summary.Cell index={1} align="right"><b style={{ color: 'red', fontSize: 15 }}>{Number(snapshot.total_amount).toLocaleString()}</b></Table.Summary.Cell>
                                    </Table.Summary.Row>
                                </>
                            )
                        }}
                    />
                </div>
            ),
            maskClosable: true
        });
    };

    return (
        <Modal title="Lịch sử phiên bản" open={open} onCancel={onClose} footer={null} width={800}>
            <Table
                dataSource={revisions}
                rowKey="id"
                columns={[
                    { title: 'Version', dataIndex: 'version_number', render: (v) => <Tag>v{v}</Tag> },
                    { title: 'Ngày tạo', dataIndex: 'created_at', render: (t) => dayjs(t).format('DD/MM/YYYY HH:mm') },
                    { title: 'Người tạo', dataIndex: 'created_by' },
                    {
                        title: 'Action', render: (r) => (
                            <Button size="small" onClick={() => showRevisionDetail(r)}>Xem chi tiết</Button>
                        )
                    }
                ]}
            />
        </Modal>
    );
};

export default RevisionHistoryModal;
