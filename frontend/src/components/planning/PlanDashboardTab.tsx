import React from 'react';
import { Table, Button, Row, Col, Statistic, Tag, Tabs, Select, InputNumber, Checkbox, Input, Progress, Modal, Card } from 'antd';
import { DollarOutlined, ShoppingCartOutlined, ScissorOutlined, TruckOutlined, AppstoreAddOutlined, ExperimentOutlined, DeleteOutlined, SaveOutlined, FallOutlined, SyncOutlined, HistoryOutlined, CloudSyncOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import ProductionStatusTab from './ProductionStatusTab';
import VersionHistoryModal from './VersionHistoryModal';
import axios from 'axios';
import { API_URL } from '../../config';

const { Option } = Select;

interface PlanDashboardTabProps {
    plans: any[];
    mrpData: any;
    outsourcingList: any[];
    logisticsList: any[];
    suppliers: any[];
    costBasis: 'REFERENCE' | 'PURCHASE';
    setCostBasis: (v: 'REFERENCE' | 'PURCHASE') => void;
    isMobile: boolean;
    loading: boolean;
    isDashboardOpen: boolean;
    setIsDashboardOpen: (v: boolean) => void;
    onRunMrp: (planId: number) => void;
    onDeletePlan: (id: number) => void;
    onConfirmBookings: (id: number) => void;
    onDataChange: (type: 'MATERIAL' | 'OUTSOURCING', index: number, field: string, value: any) => void;
    onDetailDataChange: (materialIndex: number, detailIndex: number, value: any) => void;
    onToggleStock: (index: number, checked: boolean) => void;
    onGeneratePOs: (type: 'MATERIAL' | 'OUTSOURCING') => void;
    onSaveAnalysis: () => void;
    onUpdateStatus: (planId: number, status: string) => void;
    onForceRunMrp?: (planId: number) => void;
}

const PlanDashboardTab: React.FC<PlanDashboardTabProps> = ({
    plans, mrpData, outsourcingList, logisticsList, suppliers, costBasis, setCostBasis, isMobile, loading,
    isDashboardOpen, setIsDashboardOpen,
    onRunMrp, onDeletePlan, onConfirmBookings, onDataChange, onDetailDataChange, onToggleStock, onGeneratePOs, onSaveAnalysis, onUpdateStatus, onForceRunMrp
}) => {
    const [historyOpen, setHistoryOpen] = React.useState(false);

    const handleSyncBOD = async (planId: number) => {
        try {
            await axios.post(`${API_URL}/planning/${planId}/sync-bod-followup`);
            alert('Đồng bộ thành công');
        } catch (error) {
            alert('Đồng bộ thất bại');
        }
    };

    const planColumns = [
        { title: 'Mã KH', dataIndex: 'code', render: (t: any) => <b>{t}</b> },
        { title: 'Tên Đợt', dataIndex: 'name' },
        { 
            title: 'Khách hàng', 
            render: (r: any) => {
                if (!r.sales_orders || r.sales_orders.length === 0) return '-';
                // Get unique customer names from sales orders
                const customers = Array.from(new Set(r.sales_orders.map((o: any) => o.customer?.name || o.customer_name || '').filter(Boolean)));
                return (
                    <div style={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={customers.join(', ')}>
                        {customers.map((c: any, i) => <div key={i} style={{ fontSize: 13, color: '#1890ff' }}>{c}</div>)}
                    </div>
                );
            } 
        },
        { title: 'Thời Gian', render: (r: any) => <small>{dayjs(r.start_date).format('DD/MM')} - {dayjs(r.end_date).format('DD/MM')}</small> },
        { 
            title: 'Trạng Thái', 
            dataIndex: 'status', 
            align: 'center' as const, 
            render: (t: any, r: any) => (
                <Select
                    value={t}
                    size="small"
                    style={{ width: 140, fontSize: 12 }}
                    onChange={(newStatus) => onUpdateStatus(r.id, newStatus)}
                    options={[
                        { value: 'DRAFT', label: <Tag>Mới</Tag> },
                        { value: 'CALCULATED', label: <Tag color="cyan">Đã tính MRP</Tag> },
                        { value: 'HAS_PO_MATERIAL', label: <Tag color="purple">Đã có PO_NPL</Tag> },
                        { value: 'HAS_PO_OUTSOURCING', label: <Tag color="magenta">Đã có PO_CG</Tag> },
                        { value: 'IN_PRODUCTION', label: <Tag color="blue">Đang SX</Tag> },
                        { value: 'STOCK_RECEIVED', label: <Tag color="gold">Đã nhập Kho</Tag> },
                        { value: 'DELIVERED_TO_CUSTOMER', label: <Tag color="volcano">Đã giao hàng</Tag> },
                        { value: 'COMPLETED', label: <Tag color="green">Hoàn thành SX</Tag> },
                        { value: 'DONE', label: <Tag color="success">Done</Tag> },
                    ]}
                />
            )
        },
        {
            title: 'Hành động', key: 'act', align: 'right' as const, render: (_: any, r: any) => (
                <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
                    <Button type="default" size="small" icon={<ShoppingCartOutlined />} onClick={() => onConfirmBookings(r.id)}>Duyệt Book</Button>
                    <Button type="primary" size="small" icon={<ExperimentOutlined />} onClick={() => onRunMrp(r.id)}>Phân Tích</Button>
                    <Button danger size="small" icon={<DeleteOutlined />} onClick={() => onDeletePlan(r.id)} />
                </div>
            )
        }
    ];

    const renderDashboard = () => {
        if (!mrpData) return null;
        const totalRevenue = mrpData.plan_info.sales_orders.reduce((s: number, o: any) => s + Number(o.total_amount), 0);
        const estMaterialCost = mrpData.mrp_result.reduce((s: number, i: any) => {
            const price = costBasis === 'REFERENCE' ? Number(i.reference_price || 0) : Number(i.purchase_price || 0);
            return s + (Number(i.net_requirement || 0) * price);
        }, 0);
        const estOutsourceCost = outsourcingList.reduce((s: number, i: any) => s + (Number(i.total_cost)), 0);
        const estLogisticsCost = logisticsList.reduce((s: number, i: any) => s + (Number(i.total_cost)), 0);

        // --- Tính giá trị hao hụt dự kiến ---
        const estWastageCost = mrpData.mrp_result.reduce((s: number, i: any) => {
            const price = costBasis === 'REFERENCE' ? Number(i.reference_price || 0) : Number(i.purchase_price || 0);
            const wastageQty = Math.max(0, Number(i.gross_requirement || 0) - Number(i.gross_raw || 0));
            return s + (wastageQty * price);
        }, 0);

        // --- Tính giá trị hàng dùng kho ---
        const stockProductCost = mrpData.plan_info.sales_orders.reduce((s: number, o: any) => {
            return s + o.items.reduce((sum: number, item: any) => {
                if (Number(item.booked_quantity) > 0) {
                    return sum + (Number(item.booked_quantity || 0) * Number(item.product?.cost_price || 0));
                }
                return sum;
            }, 0);
        }, 0);

        const stockMaterialCost = mrpData.mrp_result.reduce((s: number, i: any) => {
            if (i.use_stock) {
                const usedQty = Math.max(0, Number(i.gross_requirement || 0) - Number(i.net_requirement || 0));
                const price = costBasis === 'REFERENCE' ? Number(i.reference_price || 0) : Number(i.purchase_price || 0);
                return s + (usedQty * price);
            }
            return s;
        }, 0);
        const totalStockCost = stockProductCost + stockMaterialCost;

        return (
            <div>
                <div style={{ marginBottom: 20, background: '#f5f7fa', padding: 15, borderRadius: 8 }}>
                    <div style={{ textAlign: 'right', marginBottom: 10 }}>
                        <span>Cơ sở tính giá: </span>
                        <Select value={costBasis} onChange={setCostBasis} style={{ width: 180 }}>
                            <Option value="REFERENCE">Giá Tham Khảo (NCC)</Option>
                            <Option value="PURCHASE">Giá Đặt Hàng (PO)</Option>
                        </Select>
                    </div>
                    <Row gutter={24} style={{ textAlign: 'center' }}>
                        <Col span={4}><Statistic title="Doanh Thu" value={totalRevenue} prefix={<DollarOutlined />} suffix="đ" valueStyle={{ fontSize: 15 }} /></Col>
                        <Col span={4}>
                            <Statistic title="CP Mua NPL" value={estMaterialCost} prefix={<ShoppingCartOutlined />} suffix="đ" valueStyle={{ color: '#cf1322', fontSize: 15 }} />
                            <small style={{ color: '#888', fontSize: 11 }}>({costBasis === 'REFERENCE' ? 'Theo giá NCC' : 'Theo PO'})</small>
                        </Col>
                        <Col span={4}><Statistic title="CP Hàng Có Sẵn" value={totalStockCost} prefix={<AppstoreAddOutlined />} suffix="đ" valueStyle={{ color: '#531dab', fontSize: 15 }} />
                            <small style={{ color: '#888', fontSize: 11 }}>(Thành phẩm + NPL kho)</small>
                        </Col>
                        <Col span={4}><Statistic title="CP Gia Công" value={estOutsourceCost} prefix={<ScissorOutlined />} suffix="đ" valueStyle={{ color: '#d46b08', fontSize: 15 }} /></Col>
                        <Col span={4}><Statistic title="CP Logistics" value={estLogisticsCost} prefix={<TruckOutlined />} suffix="đ" valueStyle={{ color: '#096dd9', fontSize: 15 }} /></Col>
                        <Col span={4}>
                            <Statistic title="CP Hao Hụt" value={estWastageCost} prefix={<FallOutlined />} suffix="đ" valueStyle={{ color: '#fa8c16', fontSize: 15 }} />
                            <small style={{ color: '#888', fontSize: 11 }}>(Đã tính trong NPL)</small>
                        </Col>
                    </Row>
                    {(() => {
                        // Doanh thu (totalRevenue) đã bao gồm VAT
                        // Lợi nhuận gộp trước thuế GTGT = Doanh thu (gồm VAT) - Tổng chi phí
                        const grossProfitBeforeVat = totalRevenue - estMaterialCost - estOutsourceCost - estLogisticsCost - totalStockCost;
                        // Tính tổng tiền thuế GTGT từ các đơn hàng
                        const totalVatAmount = mrpData.plan_info.sales_orders.reduce((s: number, o: any) => {
                            const total = Number(o.total_amount || 0);
                            const shipping = Number(o.shipping_fee || 0);
                            const vatRate = Number(o.vat_rate || 0);
                            if (vatRate === 0) return s;
                            const taxable = Math.max(0, (total - shipping) / (1 + vatRate / 100));
                            return s + (taxable * vatRate / 100);
                        }, 0);
                        // Lợi nhuận gộp sau thuế GTGT = Trước thuế - Thuế GTGT
                        const grossProfitAfterVat = grossProfitBeforeVat - totalVatAmount;
                        // Lợi nhuận gộp sau thuế TNDN = Sau thuế GTGT * 80% (trừ 20% thuế TNDN)
                        const grossProfitAfterCIT = grossProfitAfterVat * 0.8;

                        return (
                            <div style={{ marginTop: 25, display: 'flex', justifyContent: 'space-around', fontWeight: 'bold', fontSize: 14, background: '#fff', padding: '15px 0', borderRadius: 8, border: '1px solid #e8e8e8' }}>
                                <div style={{ color: grossProfitBeforeVat > 0 ? '#08979c' : 'red', textAlign: 'center' }}>
                                    <div style={{ fontSize: 12, color: '#888', fontWeight: 'normal', marginBottom: 4 }}>1. Lợi Nhuận Gộp Trước Thuế GTGT</div>
                                    <div style={{ fontSize: 16 }}>{Math.round(grossProfitBeforeVat).toLocaleString()} đ</div>
                                </div>
                                <div style={{ width: 1, background: '#f0f0f0' }}></div>
                                <div style={{ color: grossProfitAfterVat > 0 ? '#d46b08' : 'red', textAlign: 'center' }}>
                                    <div style={{ fontSize: 12, color: '#888', fontWeight: 'normal', marginBottom: 4 }}>2. Lợi Nhuận Gộp Sau Thuế GTGT</div>
                                    <div style={{ fontSize: 16 }}>{Math.round(grossProfitAfterVat).toLocaleString()} đ</div>
                                </div>
                                <div style={{ width: 1, background: '#f0f0f0' }}></div>
                                <div style={{ color: grossProfitAfterCIT > 0 ? 'green' : 'red', textAlign: 'center' }}>
                                    <div style={{ fontSize: 12, color: '#888', fontWeight: 'normal', marginBottom: 4 }}>3. Lợi Nhuận Gộp Sau Thuế TNDN (Trừ 20%)</div>
                                    <div style={{ fontSize: 16 }}>{Math.round(grossProfitAfterCIT).toLocaleString()} đ</div>
                                </div>
                            </div>
                        );
                    })()}
                </div>
                <Tabs defaultActiveKey="1" items={[
                    {
                        key: '1', label: '1. Nhu Cầu Nguyên Liệu (MRP)',
                        children: (
                            <div>
                                <div style={{ marginBottom: 16 }}>
                                    <h4 style={{ color: '#1890ff', marginBottom: 12 }}>Thống kê NPL (Cập nhật Real-time theo Dùng Kho)</h4>
                                    <Row gutter={[16, 16]}>
                                        <Col xs={12} sm={6}>
                                            <Card size="small" style={{ background: '#f6ffed', border: '1px solid #b7eb8f' }}>
                                                <Statistic title="Loại NPL" value={mrpData.mrp_result?.length || 0} />
                                            </Card>
                                        </Col>
                                        <Col xs={12} sm={6}>
                                            <Card size="small" style={{ background: '#e6f7ff', border: '1px solid #91d5ff' }}>
                                                <Statistic title="Tổng NPL Tồn Kho" value={mrpData.mrp_result?.reduce((s:number, i:any) => s + (Number(i.available_stock) || 0), 0) || 0} />
                                            </Card>
                                        </Col>
                                        <Col xs={12} sm={6}>
                                            <Card size="small" style={{ background: '#fff7e6', border: '1px solid #ffd591' }}>
                                                <Statistic title="Tổng NPL Dùng Kho" value={mrpData.mrp_result?.reduce((s:number, i:any) => s + (i.use_stock !== false ? Math.min(Number(i.gross_requirement)||0, Number(i.available_stock)||0) : 0), 0) || 0} />
                                            </Card>
                                        </Col>
                                        <Col xs={12} sm={6}>
                                            <Card size="small" style={{ background: '#fff1f0', border: '1px solid #ffa39e' }}>
                                                <Statistic title="Tổng NPL Đặt Thêm" value={mrpData.mrp_result?.reduce((s:number, i:any) => s + (Number(i.net_requirement) || 0), 0) || 0} valueStyle={{ color: '#cf1322' }} />
                                            </Card>
                                        </Col>
                                    </Row>
                                </div>
                                <Table dataSource={mrpData.mrp_result} rowKey="material_id" pagination={false} size="middle" scroll={{ x: 1600, y: 450 }}
                                    expandable={{
                                        rowExpandable: (record) => !!record.details && record.details.length > 0,
                                        expandedRowRender: (record, index) => {
                                            if (!record.details || record.details.length === 0) return null;
                                            return (
                                                <Table
                                                    dataSource={record.details}
                                                    rowKey={(r, i) => i || 0}
                                                    pagination={false}
                                                    size="small"
                                                    columns={[
                                                        { title: 'Mã SKU', dataIndex: 'product_sku', width: 250, render: (v: any, r: any) => <div><b>{v || r.product_name}</b><br/><span style={{fontSize: 12, color: '#888'}}>{r.product_name}</span></div> },
                                                        { title: 'SL Sản xuất', dataIndex: 'qty_needed', width: 100, align: 'center' },
                                                        { title: 'Định mức / SP', dataIndex: 'bom_quantity', width: 120, align: 'center' },
                                                        { title: '% Hao hụt', dataIndex: 'waste_percent', width: 90, align: 'center', render: (v: any) => <Tag color="orange">{v}%</Tag> },
                                                        { title: 'Tổng (+Hao hụt)', dataIndex: 'gross_req', width: 120, align: 'center', render: (v: any) => Number(v || 0).toLocaleString() },
                                                        { title: 'Cần Mua (SL)', dataIndex: 'net_requirement', width: 120,
                                                          render: (v: any, r: any, detailIndex: number) => (
                                                              <InputNumber
                                                                  value={v}
                                                                  min={0}
                                                                  onChange={(val) => onDetailDataChange(index, detailIndex, val)}
                                                                  style={{ width: '100%' }}
                                                              />
                                                          )
                                                        }
                                                    ]}
                                                />
                                            );
                                        }
                                    }}
                                    columns={[
                                        {
                                            title: 'Nguyên Liệu', dataIndex: 'material_name', width: 250, fixed: 'left',
                                            render: (t: any, r: any) => (
                                                <div style={{ wordWrap: 'break-word', whiteSpace: 'normal' }}>
                                                    <div style={{ color: '#096dd9', fontWeight: 'bold' }}>{r.material_code}</div>
                                                    <div>{t}</div>
                                                </div>
                                            )
                                        },
                                        { title: 'Tổng Cần (Gốc)', dataIndex: 'gross_raw', align: 'center' as const, width: 100, render: (v: any) => Number(v || 0).toLocaleString() },
                                        { title: '% Hao hụt', dataIndex: 'wastage_percent', align: 'center' as const, width: 90, render: (v: any) => <Tag color="orange">{v}%</Tag> },
                                        { title: 'Tổng (+Hao hụt)', dataIndex: 'gross_requirement', align: 'center' as const, width: 110, render: (v: any) => <b>{Number(v).toLocaleString()}</b> },
                                        { title: 'Tồn Kho', dataIndex: 'available_stock', align: 'center' as const, width: 90 },
                                        {
                                            title: 'Dùng Kho', align: 'center' as const, width: 80,
                                            render: (v: any, r: any, i: number) => (
                                                <Checkbox checked={r.use_stock} disabled={!r.available_stock || r.available_stock <= 0} onChange={(e) => onToggleStock(i, e.target.checked)} />
                                            )
                                        },
                                        {
                                            title: 'Cần Mua (SL)', dataIndex: 'net_requirement', width: 130, align: 'right' as const,
                                            render: (v: any) => (
                                                <b style={{ color: v > 0 ? '#faad14' : '#888', fontSize: 16 }}>{Number(v || 0).toLocaleString()}</b>
                                            )
                                        },
                                        { title: 'ĐVT', align: 'center' as const, dataIndex: 'unit', width: 70 },
                                        {
                                            title: 'Nhà Cung Cấp', dataIndex: 'supplier_name', width: 220,
                                            render: (v: any, r: any, i: number) => (
                                                <Select value={v} style={{ width: '100%' }} showSearch placeholder="Chọn NCC"
                                                    filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                                                    onChange={(val) => onDataChange('MATERIAL', i, 'supplier_name', val)}
                                                    options={suppliers.filter(s => s.type !== 'MANUFACTURER').map(s => ({ label: s.name, value: s.name }))}
                                                />
                                            )
                                        },
                                        {
                                            title: 'Đơn giá tham khảo', dataIndex: 'reference_price', width: 140,
                                            render: (v: any, r: any, i: number) => (
                                                <InputNumber value={v} min={0} formatter={val => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                                    onChange={(val) => onDataChange('MATERIAL', i, 'reference_price', val)} style={{ width: '100%' }} />
                                            )
                                        },
                                        {
                                            title: 'Giá mua (PO)', dataIndex: 'purchase_price', align: 'right' as const, width: 120,
                                            render: (v: any) => <b style={{ color: costBasis === 'PURCHASE' ? '#cf1322' : '#888' }}>{Number(v || 0).toLocaleString()}</b>
                                        },
                                        {
                                            title: 'Ghi chú PO', width: 150,
                                            render: (t: any, r: any, i: number) => <Input value={r.note} onChange={(e) => onDataChange('MATERIAL', i, 'note', e.target.value)} placeholder="Note..." />
                                        }
                                    ]} />
                                <div style={{ marginTop: 15, textAlign: 'right' }}><Button type="primary" icon={<AppstoreAddOutlined />} onClick={() => onGeneratePOs('MATERIAL')}>Tạo PO Nguyên Liệu</Button></div>
                            </div>
                        )
                    },
                    {
                        key: '2', label: '2. Nhu Cầu Gia Công',
                        children: (
                            <div>
                                <Table dataSource={outsourcingList} rowKey={(r, i) => i || 0} pagination={false} size="small" scroll={{ y: 300 }}
                                    columns={[
                                        { title: 'Mã SKU', dataIndex: 'product_sku', width: 100, render: (t: any) => <b>{t}</b> },
                                        { title: 'Công Đoạn', dataIndex: 'step_name', width: 150 },
                                        {
                                            title: 'Nhà Gia Công', dataIndex: 'supplier_name', width: 180,
                                            render: (v: any, r: any, i: number) => (
                                                <Select value={v} style={{ width: '100%' }} placeholder="Chọn Nhà GC" showSearch
                                                    filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                                                    onChange={(val) => onDataChange('OUTSOURCING', i, 'supplier_name', val)}
                                                    options={suppliers.filter(s => s.type !== 'MATERIAL').map(s => ({ label: s.name, value: s.name }))}
                                                />
                                            )
                                        },
                                        {
                                            title: 'Số Lượng', dataIndex: 'quantity', width: 100,
                                            render: (v: any, r: any, i: number) => (
                                                <InputNumber value={v} min={0} onChange={(val) => onDataChange('OUTSOURCING', i, 'quantity', val)} style={{ width: '100%' }} />
                                            )
                                        },
                                        {
                                            title: 'Đơn Giá', dataIndex: 'unit_price', width: 120,
                                            render: (v: any, r: any, i: number) => (
                                                <InputNumber value={v} min={0} formatter={val => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                                    onChange={(val) => onDataChange('OUTSOURCING', i, 'unit_price', val)} style={{ width: '100%' }} />
                                            )
                                        },
                                        { title: 'Thành Tiền', dataIndex: 'total_cost', align: 'right' as const, width: 120, render: (v: any) => <b>{Number(v).toLocaleString()}</b> },
                                        {
                                            title: 'Ghi chú PO',
                                            render: (t: any, r: any, i: number) => <Input size="small" value={r.note} onChange={(e) => onDataChange('OUTSOURCING', i, 'note', e.target.value)} placeholder="Ghi chú đơn hàng..." />
                                        }
                                    ]} />
                                <div style={{ marginTop: 15, textAlign: 'right' }}><Button type="primary" style={{ backgroundColor: '#d46b08' }} icon={<ScissorOutlined />} onClick={() => onGeneratePOs('OUTSOURCING')}>Tạo Đơn Hàng Gia Công</Button></div>
                            </div>
                        )
                    },
                    {
                        key: '3', label: '3. Chi Phí Vận Chuyển',
                        children: (
                            <div>
                                <div style={{ marginBottom: 10 }}>Dữ liệu lấy từ mục <b>Logistics</b> của từng sản phẩm.</div>
                                <Table dataSource={logisticsList} rowKey={(r, i) => i || 0} pagination={false} size="small"
                                    columns={[
                                        { title: 'Mã SKU', dataIndex: 'product_sku', render: (t: any) => <b>{t}</b> },
                                        { title: 'Khoản Mục', dataIndex: 'name' },
                                        { title: 'Đơn Giá', dataIndex: 'cost', align: 'right' as const, render: (v: any) => Number(v).toLocaleString() },
                                        { title: 'Số Lượng', dataIndex: 'quantity', align: 'center' as const },
                                        { title: 'Thành Tiền', dataIndex: 'total_cost', align: 'right' as const, render: (v: any) => <b style={{ color: '#096dd9' }}>{Number(v).toLocaleString()}</b> },
                                        { title: 'Ghi chú', dataIndex: 'note' }
                                    ]}
                                    summary={(pageData) => {
                                        const total = pageData.reduce((prev, current) => prev + Number(current.total_cost), 0);
                                        return (
                                            <Table.Summary.Row>
                                                <Table.Summary.Cell index={0} colSpan={4} align="right"><b>Tổng:</b></Table.Summary.Cell>
                                                <Table.Summary.Cell index={1} align="right"><b>{total.toLocaleString()}</b></Table.Summary.Cell>
                                                <Table.Summary.Cell index={2} />
                                            </Table.Summary.Row>
                                        );
                                    }}
                                />
                            </div>
                        )
                    },
                    {
                        key: '4', label: '4. Tiến Độ Sản Xuất',
                        children: (
                            <div>
                                <ProductionStatusTab planId={mrpData?.plan_info?.id} />
                            </div>
                        )
                    },
                    {
                        key: '5', label: '5. Chi Tiết SP & BOM',
                        children: (
                            <div>
                                <div style={{ marginBottom: 10 }}>Danh sách sản phẩm thuộc Kế hoạch và định mức nguyên liệu (BOM).</div>
                                <Table
                                    dataSource={(() => {
                                        const uniqueProducts: any[] = [];
                                        const productMap = new Set();
                                        mrpData?.plan_info?.sales_orders?.forEach((o: any) => {
                                            o.items?.forEach((i: any) => {
                                                if (i.product && !productMap.has(i.product.id)) {
                                                    productMap.add(i.product.id);
                                                    uniqueProducts.push(i.product);
                                                }
                                            });
                                        });
                                        return uniqueProducts;
                                    })()}
                                    rowKey="id"
                                    pagination={false}
                                    size="small"
                                    scroll={{ y: 450 }}
                                    columns={[
                                        { title: 'SKU', dataIndex: 'sku', width: 120, render: (t) => <b>{t}</b> },
                                        { title: 'Tên Sản Phẩm', dataIndex: 'name' },
                                        { 
                                            title: 'Loại', dataIndex: 'product_type', width: 120, 
                                            render: (t) => t === 'COMBO' ? <Tag color="purple">COMBO</Tag> : <Tag color="blue">STANDARD</Tag> 
                                        }
                                    ]}
                                    expandable={{
                                        expandedRowRender: (record: any) => {
                                            const renderBOMs = (boms: any[]) => {
                                                if (!boms || boms.length === 0) return <div style={{ color: '#888', fontStyle: 'italic' }}>Chưa có thông tin định mức nguyên liệu (BOM)</div>;
                                                return (
                                                    <Table
                                                        dataSource={boms}
                                                        pagination={false}
                                                        size="small"
                                                        rowKey="id"
                                                        columns={[
                                                            { title: 'Nguyên liệu (Mã)', dataIndex: ['material', 'code'], key: 'code', render: (t) => <b>{t}</b> },
                                                            { title: 'Tên nguyên liệu', dataIndex: ['material', 'name'], key: 'name' },
                                                            { title: 'SL (Định mức)', dataIndex: 'quantity', key: 'qty', render: (v) => Number(v).toLocaleString() },
                                                            { title: '% Hao hụt', dataIndex: 'waste_percent', key: 'waste', render: (v) => `${Number(v)}%` }
                                                        ]}
                                                    />
                                                );
                                            };

                                            if (record.product_type === 'COMBO') {
                                                if (!record.components || record.components.length === 0) return <div style={{ color: '#888' }}>Không có thông tin thành phần</div>;
                                                return (
                                                    <div style={{ padding: '10px 20px', background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 4 }}>
                                                        <div style={{ fontWeight: 'bold', marginBottom: 10, color: '#722ed1' }}>Các thành phần của COMBO:</div>
                                                        {record.components.map((c: any, idx: number) => (
                                                            <div key={idx} style={{ marginBottom: 15, padding: 12, border: '1px solid #d9d9d9', borderRadius: 6, background: '#fff' }}>
                                                                <div style={{ marginBottom: 10, fontSize: 13 }}>
                                                                    <b>{c.child_product?.sku}</b> - {c.child_product?.name} 
                                                                    <Tag color="purple" style={{ marginLeft: 8 }}>Số lượng: {c.quantity}</Tag>
                                                                </div>
                                                                {renderBOMs(c.child_product?.boms)}
                                                            </div>
                                                        ))}
                                                    </div>
                                                );
                                            } else {
                                                return (
                                                    <div style={{ padding: '10px 20px', background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 4 }}>
                                                        <div style={{ fontWeight: 'bold', marginBottom: 10, color: '#096dd9' }}>Định mức nguyên liệu (BOM):</div>
                                                        {renderBOMs(record.boms)}
                                                    </div>
                                                );
                                            }
                                        }
                                    }}
                                />
                            </div>
                        )
                    },
                    {
                        key: '6', label: '6. Tổng Hợp PO',
                        children: (
                            <div>
                                <div style={{ marginBottom: 10 }}>Danh sách các Đơn đặt hàng (PO) liên quan đến Kế hoạch này.</div>
                                <Table
                                    dataSource={mrpData?.plan_info?.purchase_orders || []}
                                    rowKey="id"
                                    pagination={false}
                                    size="small"
                                    columns={[
                                        { title: 'Mã PO', dataIndex: 'code', render: (t) => <b>{t}</b> },
                                        { title: 'Nhà Cung Cấp', dataIndex: ['supplier', 'name'] },
                                        { title: 'Loại', dataIndex: 'type', render: (t) => <Tag color={t === 'MATERIAL' ? 'blue' : 'orange'}>{t}</Tag> },
                                        { title: 'Trạng Thái', dataIndex: 'status', render: (t) => <Tag>{t}</Tag> },
                                        { title: 'Tổng Tiền', dataIndex: 'total_amount', render: (v) => Number(v).toLocaleString() },
                                        { title: 'Ngày Giao', dataIndex: 'delivery_date', render: (v) => v ? dayjs(v).format('DD/MM/YYYY') : '-' }
                                    ]}
                                />
                            </div>
                        )
                    }
                ]} />
            </div>
        );
    };

    return (
        <>
            <Table dataSource={plans} columns={planColumns} rowKey="id" scroll={{ x: isMobile ? 500 : undefined }} />
            <Modal
                title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 30 }}>
                        <span>Phân Tích Kế Hoạch: {mrpData?.plan_info?.name || ''}</span>
                        <div>
                            {onForceRunMrp && mrpData?.plan_info?.id && (
                                <Button 
                                    icon={<SyncOutlined />} 
                                    onClick={() => onForceRunMrp(mrpData.plan_info.id)} 
                                    style={{ marginRight: 8 }}
                                    loading={loading}
                                >
                                    Tính lại
                                </Button>
                            )}
                            <Button 
                                icon={<CloudSyncOutlined />} 
                                onClick={() => mrpData?.plan_info?.id && handleSyncBOD(mrpData.plan_info.id)} 
                                style={{ marginRight: 8 }}
                            >
                                Sync BOD
                            </Button>
                            <Button 
                                icon={<HistoryOutlined />} 
                                onClick={() => setHistoryOpen(true)} 
                                style={{ marginRight: 8 }}
                            >
                                Lịch sử
                            </Button>
                            <Button type="primary" onClick={onSaveAnalysis} icon={<SaveOutlined />} loading={loading}>Lưu Kết Quả</Button>
                        </div>
                    </div>
                }
                open={isDashboardOpen}
                onCancel={() => setIsDashboardOpen(false)}
                footer={null}
                width={1100}
                style={{ top: 20 }}
            >
                {renderDashboard()}
            </Modal>
            
            {mrpData?.plan_info?.id && (
                <VersionHistoryModal 
                    planId={mrpData.plan_info.id} 
                    open={historyOpen} 
                    onClose={() => setHistoryOpen(false)} 
                />
            )}
        </>
    );
};

export default PlanDashboardTab;
