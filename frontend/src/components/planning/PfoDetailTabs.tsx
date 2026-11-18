import React, { useMemo } from 'react';
import { Card, Row, Col, Typography, Tag, Tabs, Table, Statistic, Divider, Button, Popconfirm, message, Space, InputNumber, Modal, Checkbox, Form, DatePicker, Input } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../utils/api';
import MaterialMatrix from './MaterialMatrix';
import PfoProcessRouting from './PfoProcessRouting';
import PfoGanttChart from './PfoGanttChart';
import PfoSummaryDashboard from './PfoSummaryDashboard';

const { Title, Text } = Typography;

interface PfoDetailTabsProps {
    selectedPfo: any;
    pfoDetails: any;
    suppliers: any[];
    loading: boolean;
    isMobile: boolean;
    handleSaveRouting: (routing: any[]) => void;
    handleSaveReqs: (reqs: any[]) => void;
    handleGeneratePo: (reqs?: any[]) => void;
    handleCalculateBom: () => void;
    onRefreshDetails?: () => void;
}

const PfoDetailTabs: React.FC<PfoDetailTabsProps> = ({
    selectedPfo, pfoDetails, suppliers, loading, isMobile,
    handleSaveRouting, handleSaveReqs, handleGeneratePo, handleCalculateBom,
    onRefreshDetails
}) => {
    // --- PO GC BTP Modal State ---
    const [isBtpModalOpen, setIsBtpModalOpen] = React.useState(false);
    const [selectedPoGc, setSelectedPoGc] = React.useState<any>(null);
    const [selectedBtpIds, setSelectedBtpIds] = React.useState<number[]>([]);
    
    // --- PXK Từ Tồn Kho Modal State ---
    const [isPxkModalVisible, setIsPxkModalVisible] = React.useState(false);
    const [pxkForm] = Form.useForm();
    const [pxkTargetItem, setPxkTargetItem] = React.useState<any>(null);
    
    // Lấy danh sách BTP của PFO hiện tại
    const availableBtps = useMemo(() => {
        return (pfoDetails?.material_requirements || []).filter((r: any) => r.product_id);
    }, [pfoDetails]);
    
    const btpRequirements = useMemo(() => {
        return (pfoDetails?.material_requirements || []).filter((r: any) => r.product_id);
    }, [pfoDetails?.material_requirements]);

    const nplRequirements = useMemo(() => {
        return (pfoDetails?.material_requirements || []).filter((r: any) => !r.product_id);
    }, [pfoDetails?.material_requirements]);
    // 1. Calculate Estimated Costs
    const estimatedBomCost = useMemo(() => {
        if (!pfoDetails?.material_requirements) return 0;
        return pfoDetails.material_requirements
            .filter((req: any) => !req.product_id)
            .reduce((sum: number, req: any) => sum + (Number(req.planned_quantity || 0) * Number(req.unit_price || 0)), 0);
    }, [pfoDetails]);

    const estimatedRoutingCost = useMemo(() => {
        if (!pfoDetails?.milestones) return 0;
        return pfoDetails.milestones.reduce((sum: number, ms: any) => sum + (Number(ms.planned_quantity || selectedPfo?.quantity || 1) * Number(ms.unit_price || 0)), 0);
    }, [pfoDetails, selectedPfo]);

    // Helper for recursive logistics cost
    const getLogisticsCost = (product: any): number => {
        if (!product) return 0;
        let cost = (product.logistics || []).reduce((acc: number, log: any) => acc + Number(log.cost || 0), 0);
        if (product.product_type === 'COMBO' && product.components) {
            cost += product.components.reduce((acc: number, comp: any) => acc + getLogisticsCost(comp.child_product) * Number(comp.quantity || 1), 0);
        }
        return cost;
    };

    const estimatedLogisticCost = useMemo(() => {
        if (!pfoDetails?.sales_order?.items) return 0;
        return pfoDetails.sales_order.items.reduce((sum: number, item: any) => {
            const itemLogCost = getLogisticsCost(item.product);
            return sum + (itemLogCost * Number(item.quantity || 1));
        }, 0);
    }, [pfoDetails]);

    const totalRevenue = useMemo(() => {
        if (!pfoDetails?.sales_order?.items) return 0;
        return pfoDetails.sales_order.items.reduce((sum: number, item: any) => sum + (Number(item.quantity || 0) * Number(item.unit_price || 0)), 0);
    }, [pfoDetails]);

    const totalEstimatedCost = estimatedBomCost + estimatedRoutingCost + estimatedLogisticCost;
    const profitMargin = totalRevenue > 0 ? ((totalRevenue - totalEstimatedCost) / totalRevenue) * 100 : 0;

    // 2. Calculate Actual Costs from POs and Inventory
    const actualNplCost = useMemo(() => {
        if (!pfoDetails?.pos?.pos_npl) return 0;
        return pfoDetails.pos.pos_npl
            .filter((po: any) => po.status !== 'CANCELLED')
            .reduce((sum: number, po: any) => sum + Number(po.total_amount || 0), 0);
    }, [pfoDetails]);

    const actualGcCost = useMemo(() => {
        if (!pfoDetails?.pos?.pos_gc) return 0;
        return pfoDetails.pos.pos_gc
            .filter((po: any) => po.status !== 'CANCELLED')
            .reduce((sum: number, po: any) => sum + Number(po.total_amount || 0), 0);
    }, [pfoDetails]);

    const actualNplInventoryCost = useMemo(() => {
        if (!pfoDetails?.material_requirements) return 0;
        return pfoDetails.material_requirements
            .filter((req: any) => !req.product_id && req.use_inventory)
            .reduce((sum: number, req: any) => sum + (Number(req.inventory_used_quantity || 0) * Number(req.unit_price || 0)), 0);
    }, [pfoDetails]);

    const actualLogisticCost = estimatedLogisticCost; // CP_VC currently uses estimated for actual as well unless PO logistics exist

    const totalActualCost = actualNplCost + actualGcCost + actualNplInventoryCost + actualLogisticCost;
    const actualProfitMargin = totalRevenue > 0 ? ((totalRevenue - totalActualCost) / totalRevenue) * 100 : 0;

    // 2.5 Calculate Progress
    const progressData = useMemo(() => {
        // NPL Progress: items ordered vs items required (only pure NPLs, ignoring BTPs)
        let nplRequired = 0;
        let nplOrdered = 0;
        if (pfoDetails?.material_requirements) {
            const pureNpls = pfoDetails.material_requirements.filter((req: any) => !req.product_id);
            nplRequired = pureNpls.length;
        }
        if (pfoDetails?.pos?.pos_npl) {
            // Count unique materials in PO NPLs
            const orderedMaterials = new Set();
            pfoDetails.pos.pos_npl.forEach((po: any) => {
                if (po.status !== 'CANCELLED' && po.status !== 'DRAFT' && po.items) {
                    po.items.forEach((item: any) => {
                        if (item.material_id) orderedMaterials.add(item.material_id);
                    });
                }
            });
            nplOrdered = orderedMaterials.size;
        }
        const nplProgress = nplRequired > 0 ? Math.round((nplOrdered / nplRequired) * 100) : 0;

        // GC Progress: milestones completed vs total
        let gcTotal = 0;
        let gcCompleted = 0;
        if (pfoDetails?.milestones) {
            gcTotal = pfoDetails.milestones.length;
            gcCompleted = pfoDetails.milestones.filter((m: any) => m.status === 'COMPLETED').length;
        }
        const gcProgress = gcTotal > 0 ? Math.round((gcCompleted / gcTotal) * 100) : 0;

        // Total Progress: simple average or weighted. Using average for now.
        const totalProgress = Math.round((nplProgress + gcProgress) / 2);

        return { nplProgress, gcProgress, totalProgress, nplOrdered, nplRequired };
    }, [pfoDetails]);

    // 3. BOM Tree Data
    const bomTreeData = useMemo(() => {
        if (!pfoDetails?.sales_order?.items) return [];
        return pfoDetails.sales_order.items.map((item: any) => {
            const product = item.product;
            let children: any[] = [];
            
            if (product?.product_type === 'COMBO' && product?.components) {
                children = product.components.map((comp: any) => {
                    const cProd = comp.child_product;
                    return {
                        key: `comp-${comp.id}`,
                        name: cProd?.name || cProd?.sku,
                        sku: cProd?.sku,
                        type: 'Sản phẩm con',
                        quantity: comp.quantity,
                        inventory_qty: cProd?.quantity_in_stock || 0,
                        booking_status: item.booking_status,
                        booked_quantity: Math.floor(Number(item.booked_quantity || 0) * Number(comp.quantity)),
                        product_id: cProd?.id,
                        so_item_id: item.id,
                        children: cProd?.boms?.map((b: any) => ({
                            key: `bom-${comp.id}-${b.id}`,
                            name: b.material?.name || b.material?.sku,
                            sku: b.material?.sku,
                            type: 'NPL',
                            quantity: b.quantity
                        }))
                    };
                });
            } else if (product?.boms) {
                children = product.boms.map((b: any) => ({
                    key: `bom-${b.id}`,
                    name: b.material?.name || b.material?.sku,
                    sku: b.material?.sku,
                    type: 'NPL',
                    quantity: b.quantity
                }));
            }

            return {
                key: `prod-${product?.id}`,
                name: product?.name || product?.sku,
                sku: product?.sku,
                type: 'Thành phẩm',
                quantity: item.quantity,
                inventory_qty: product?.quantity_in_stock || 0,
                booking_status: item.booking_status,
                booked_quantity: item.booked_quantity,
                product_id: product?.id,
                so_item_id: item.id,
                children: children.length > 0 ? children : undefined
            };
        });
    }, [pfoDetails]);

    const columnsBom = [
        { title: 'Tên / Mã', dataIndex: 'name', key: 'name', render: (text: string, record: any) => <b>{text} ({record.sku})</b> },
        { title: 'Loại', dataIndex: 'type', key: 'type' },
        { title: 'Định mức / SL (Gốc)', dataIndex: 'quantity', key: 'quantity' },
        {
            title: 'SL Sale đã book',
            key: 'booked_quantity',
            render: (_: any, record: any) => {
                if (record.type === 'Thành phẩm' || record.type === 'Sản phẩm con') {
                    if (!record.booking_status || record.booking_status === 'NONE') return <Text type="secondary">Chưa book</Text>;
                    const color = record.booking_status === 'CONFIRMED' ? 'green' : 'orange';
                    const text = record.booking_status === 'CONFIRMED' ? 'Đã duyệt' : 'Chờ duyệt';
                    return <div>{Number(record.booked_quantity || 0).toLocaleString()} <Tag color={color}>{text}</Tag></div>;
                }
                return null;
            }
        },
        {
            title: 'Tồn kho TP',
            key: 'inventory_qty',
            render: (_: any, record: any) => {
                if (record.type === 'Thành phẩm' || record.type === 'Sản phẩm con') {
                    return <b>{Number(record.inventory_qty || 0).toLocaleString()}</b>;
                }
                return null;
            }
        },
        { 
            title: 'SL KHSX (Tùy chỉnh)', 
            key: 'custom_quantity', 
            render: (_: any, record: any) => {
                if (record.type === 'Thành phẩm' || record.type === 'Sản phẩm con') {
                    const productId = record.product_id || (record.key && record.key.split('-')[1]);
                    if (!productId) return null;
                    
                    const pfoQuantities = pfoDetails?.custom_quantities || {};
                    const val = pfoQuantities[productId] !== undefined ? pfoQuantities[productId] : '';

                    return (
                        <InputNumber 
                            size="small"
                            placeholder="Mặc định"
                            value={val}
                            min={0}
                            onChange={async (newVal) => {
                                try {
                                    const updatedQs = { ...pfoQuantities, [productId]: newVal === null ? undefined : newVal };
                                    await api.put(`/planning/pfo/${selectedPfo.id}/custom-quantities`, { custom_quantities: updatedQs });
                                    message.success('Đã cập nhật số lượng KHSX cho sản phẩm này');
                                    onRefreshDetails?.();
                                } catch (e) {
                                    message.error('Lỗi cập nhật số lượng');
                                }
                            }}
                            style={{ width: 100 }}
                        />
                    );
                }
                return null;
            }
        },
        {
            title: 'Thao tác',
            key: 'action',
            render: (_: any, record: any) => {
                const actions = [];
                if ((record.type === 'Thành phẩm' || record.type === 'Sản phẩm con') && record.booking_status === 'CONFIRMED' && Number(record.booked_quantity) > 0) {
                    actions.push(
                        <Button 
                            key="use_stock"
                            type="primary" 
                            size="small"
                            onClick={() => {
                                setPxkTargetItem(record);
                                setIsPxkModalVisible(true);
                                setTimeout(() => {
                                    pxkForm.setFieldsValue({
                                        date: dayjs(),
                                        quantity: record.booked_quantity,
                                        note: `Xuất kho thành phẩm cho SO ${selectedPfo?.sales_order?.order_code || ''}`
                                    });
                                }, 50);
                            }}
                        >
                            Dùng tồn kho
                        </Button>
                    );
                }
                
                if ((record.type === 'Thành phẩm' || record.type === 'Sản phẩm con') && record.booking_status === 'TEMPORARY' && record.so_item_id) {
                    actions.push(
                        <Popconfirm
                            key="approve_booking"
                            title="Bạn có chắc chắn duyệt book kho cho sản phẩm này?"
                            onConfirm={async () => {
                                try {
                                    await api.post(`/planning/${selectedPfo.id}/confirm-bookings`, { itemIds: [record.so_item_id] });
                                    message.success('Đã duyệt book kho thành công!');
                                    onRefreshDetails?.();
                                } catch (e: any) {
                                    message.error(e.response?.data?.message || 'Lỗi khi duyệt book kho');
                                }
                            }}
                        >
                            <Button size="small" type="dashed" style={{ borderColor: 'orange', color: 'orange' }}>
                                Duyệt book
                            </Button>
                        </Popconfirm>
                    );
                }

                return <Space>{actions}</Space>;
            }
        }
    ];

    const columnsPo = [
        { title: 'Mã PO', dataIndex: 'po_code', key: 'po_code' },
        { title: 'Trạng thái', dataIndex: 'status', key: 'status', render: (val: string) => <Tag color="blue">{val}</Tag> },
        { title: 'Nhà cung cấp', dataIndex: ['supplier', 'name'], key: 'supplier' },
        { title: 'Tổng tiền', dataIndex: 'total_amount', key: 'total_amount', render: (val: any) => <b>{Number(val).toLocaleString()} ₫</b> }
    ];

    const columnsPoGc = [
        ...columnsPo,
        {
            title: 'Thao tác',
            key: 'action',
            render: (_: any, record: any) => (
                <Button 
                    size="small" 
                    type="primary" 
                    ghost 
                    onClick={() => {
                        setSelectedPoGc(record);
                        // Lấy các BTP đã được gán sẵn (nếu có)
                        const existingBtps = record.semi_finished_products || [];
                        const existingIds = existingBtps.map((b: any) => b.product_id);
                        setSelectedBtpIds(existingIds);
                        setIsBtpModalOpen(true);
                    }}
                >
                    Gán BTP
                </Button>
            )
        }
    ];

    const columnsPxk = [
        { title: 'Mã PXK / Phiếu', dataIndex: 'code', key: 'code', render: (val: any, record: any) => <b>{record.pxk_code || record.code || val || 'N/A'}</b> },
        { title: 'Trạng thái', dataIndex: 'status', key: 'status', render: (val: string) => {
            if (val === 'DRAFT') return <Tag color="blue">Nháp</Tag>;
            if (val === 'CONFIRMED') return <Tag color="orange">Đã duyệt (Chờ giao)</Tag>;
            if (val === 'DELIVERED') return <Tag color="green">Đã nhận (NCC)</Tag>;
            return <Tag color="orange">{val || 'N/A'}</Tag>;
        }},
        { title: 'Ngày giao (Xuất)', dataIndex: 'issue_date', key: 'issue_date', render: (val: any, record: any) => val ? dayjs(val).format('DD/MM/YYYY') : (record?.created_at ? dayjs(record.created_at).format('DD/MM/YYYY') : '-') },
        { title: 'Nhà GC / Nơi nhận', key: 'supplier', render: (_: any, record: any) => record.supplier?.name ? <Text strong>{record.supplier.name}</Text> : (record.from_inventory ? <Tag color="green">Từ Tồn Kho</Tag> : <Tag>Khác</Tag>) },
        {
            title: 'Thao tác',
            key: 'action',
            render: (_: any, record: any) => (
                <Popconfirm
                    title="Xóa phiếu xuất kho này? (Nếu phiếu bị trùng hoặc không dùng)"
                    okText="Xóa"
                    cancelText="Hủy"
                    okButtonProps={{ danger: true }}
                    onConfirm={async () => {
                        try {
                            await api.delete(`/inventory/goods-issue/${record.id}`);
                            message.success('Đã xóa phiếu xuất kho thành công');
                            onRefreshDetails?.();
                        } catch (e: any) {
                            message.error(e.response?.data?.message || 'Lỗi xóa phiếu xuất kho');
                        }
                    }}
                >
                    <Button size="small" danger icon={<DeleteOutlined />}>Xóa</Button>
                </Popconfirm>
            )
        }
    ];

    const expandedRowRenderItems = (record: any) => {
        if (!record.items || record.items.length === 0) return <Text type="secondary" style={{ marginLeft: 32 }}>Không có chi tiết</Text>;
        const itemCols = [
            { title: 'Vật tư / SP', dataIndex: 'product_name', key: 'product_name', render: (val: any, rec: any) => val || rec.material?.name || rec.product?.name || rec.description || 'N/A' },
            { title: 'Yêu cầu', dataIndex: 'quantity', key: 'quantity', align: 'right' as const, render: (val: any) => Number(val || 0).toLocaleString() },
            { title: 'Thực tế', dataIndex: 'actual_quantity', key: 'actual_quantity', align: 'right' as const, render: (val: any) => <b style={{ color: '#52c41a' }}>{Number(val || 0).toLocaleString()}</b> },
            { title: 'Đơn giá', dataIndex: 'unit_price', key: 'unit_price', align: 'right' as const, render: (val: any, rec: any) => {
                const price = Number(val || rec.material?.unit_price || rec.product?.unit_price || 0);
                return `${price.toLocaleString()} ₫`;
            }},
            { title: 'Thành tiền', dataIndex: 'total_price', key: 'total_price', align: 'right' as const, render: (val: any, rec: any) => {
                const price = Number(rec.unit_price || rec.material?.unit_price || rec.product?.unit_price || 0);
                return `${(Number(rec.quantity || 0) * price).toLocaleString()} ₫`;
            }}
        ];
        return (
            <div style={{ padding: '8px 24px', backgroundColor: '#fcfcfc', border: '1px dashed #d9d9d9', borderRadius: 6, margin: '8px 16px' }}>
                <Table columns={itemCols} dataSource={record.items} pagination={false} size="small" rowKey="id" bordered />
            </div>
        );
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* THÔNG TIN CHUNG */}
            <Card size="small" style={{ background: '#fafafa', borderRadius: 10, border: '1px solid #e8e8e8' }}>
                <Row gutter={[16, 8]}>
                    <Col span={isMobile ? 24 : 4}>
                        <Text type="secondary">Mã Đơn Hàng (SO):</Text><br />
                        <Text strong style={{ fontSize: 15, color: '#1890ff' }}>
                            {pfoDetails?.sales_order?.order_code || selectedPfo?.sales_order_code || selectedPfo?.code?.replace('PFO-', '')}
                        </Text>
                    </Col>
                    <Col span={isMobile ? 24 : 4}>
                        <Text type="secondary">Khách Hàng:</Text><br />
                        <Text strong>
                            {pfoDetails?.sales_order?.customer_name || pfoDetails?.sales_order?.customer?.name || 'N/A'}
                        </Text>
                    </Col>
                    <Col span={isMobile ? 24 : 4}>
                        <Text type="secondary">Hạn Giao Hàng:</Text><br />
                        <Text strong style={{ color: '#cf1322' }}>
                            {selectedPfo?.committed_finish_date ? dayjs(selectedPfo.committed_finish_date).format('DD/MM/YYYY') : 'N/A'}
                        </Text>
                    </Col>
                    <Col span={isMobile ? 24 : 4}>
                        <Text type="secondary">Tiến Độ Mua NPL:</Text><br />
                        <Tag color="geekblue" style={{ fontSize: 14 }}>{progressData.nplOrdered} / {progressData.nplRequired} ({progressData.nplProgress}%)</Tag>
                    </Col>
                    <Col span={isMobile ? 24 : 4}>
                        <Text type="secondary">Tiến Độ Gia Công:</Text><br />
                        <Tag color="purple" style={{ fontSize: 14 }}>{progressData.gcProgress}%</Tag>
                    </Col>
                    <Col span={isMobile ? 24 : 4}>
                        <Text type="secondary">Tiến Độ Tổng:</Text><br />
                        <Tag color="green" style={{ fontSize: 14 }}>{progressData.totalProgress}%</Tag>
                    </Col>
                </Row>
            </Card>

            {/* DỰ TÍNH CHI PHÍ & CHI PHÍ THỰC TẾ */}
            <Row gutter={[16, 16]}>
                <Col span={isMobile ? 24 : 12}>
                    <Card size="small" title={
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text strong style={{ color: '#fa8c16' }}>Dự Tính Chi Phí Theo BOM</Text>
                            <div style={{ textAlign: 'right', fontWeight: 'normal' }}>
                                <Text type="secondary" style={{ fontSize: 12 }}>Tổng CP: </Text><Text strong>{totalEstimatedCost.toLocaleString('vi-VN')} ₫</Text>
                                <Divider type="vertical" />
                                <Text type="secondary" style={{ fontSize: 12 }}>Lợi nhuận: </Text><Text strong style={{ color: (totalRevenue - totalEstimatedCost) < 0 ? '#cf1322' : '#3f8600' }}>{(totalRevenue - totalEstimatedCost).toLocaleString('vi-VN')} ₫</Text>
                            </div>
                        </div>
                    } style={{ borderRadius: 10, border: '1px solid #ffd591', background: '#fff7e6' }}>
                        <Row gutter={[16, 16]}>
                            <Col span={isMobile ? 12 : 8}><Statistic title="CP NPL" value={estimatedBomCost} suffix="₫" valueStyle={{ fontSize: 16 }} /></Col>
                            <Col span={isMobile ? 12 : 8}><Statistic title="CP Gia Công" value={estimatedRoutingCost} suffix="₫" valueStyle={{ fontSize: 16 }} /></Col>
                            <Col span={isMobile ? 12 : 8}><Statistic title="CP Vận Chuyển (CP_VC)" value={estimatedLogisticCost} suffix="₫" valueStyle={{ fontSize: 16 }} /></Col>
                            <Col span={isMobile ? 12 : 8}><Statistic title="% Lợi Nhuận" value={profitMargin} precision={2} suffix="%" valueStyle={{ fontSize: 16, color: profitMargin < 0 ? '#cf1322' : '#3f8600' }} /></Col>
                        </Row>
                    </Card>
                </Col>
                <Col span={isMobile ? 24 : 12}>
                    <Card size="small" title={
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text strong style={{ color: '#389e0d' }}>Chi Phí Thực Tế (Từ PO)</Text>
                            <div style={{ textAlign: 'right', fontWeight: 'normal' }}>
                                <Text type="secondary" style={{ fontSize: 12 }}>Tổng CP: </Text><Text strong>{totalActualCost.toLocaleString('vi-VN')} ₫</Text>
                                <Divider type="vertical" />
                                <Text type="secondary" style={{ fontSize: 12 }}>Lợi nhuận: </Text><Text strong style={{ color: (totalRevenue - totalActualCost) < 0 ? '#cf1322' : '#389e0d' }}>{(totalRevenue - totalActualCost).toLocaleString('vi-VN')} ₫</Text>
                            </div>
                        </div>
                    } style={{ borderRadius: 10, border: '1px solid #b7eb8f', background: '#f6ffed', height: '100%' }}>
                        <Row gutter={[16, 16]}>
                            <Col span={isMobile ? 12 : 8}><Statistic title="CP NPL (PO)" value={actualNplCost} suffix="₫" valueStyle={{ fontSize: 16 }} /></Col>
                            <Col span={isMobile ? 12 : 8}><Statistic title="CP NPL (Từ kho)" value={actualNplInventoryCost} suffix="₫" valueStyle={{ fontSize: 16 }} /></Col>
                            <Col span={isMobile ? 12 : 8}><Statistic title="CP Gia Công (PO)" value={actualGcCost} suffix="₫" valueStyle={{ fontSize: 16 }} /></Col>
                            <Col span={isMobile ? 12 : 8}><Statistic title="CP Vận Chuyển" value={actualLogisticCost} suffix="₫" valueStyle={{ fontSize: 16 }} /></Col>
                            <Col span={isMobile ? 12 : 8}><Statistic title="% Lợi Nhuận Thực Tế" value={actualProfitMargin} precision={2} suffix="%" valueStyle={{ fontSize: 16, color: actualProfitMargin < 0 ? '#cf1322' : '#389e0d' }} /></Col>
                        </Row>
                    </Card>
                </Col>
            </Row>

            {/* TABS */}
            <Card size="small" style={{ borderRadius: 10, border: '1px solid #e8e8e8' }}>
                <Tabs items={[
                    {
                        key: 'SUMMARY',
                        label: 'AI Summary',
                        children: (
                            <PfoSummaryDashboard 
                                pfoDetails={pfoDetails} 
                                selectedPfo={selectedPfo}
                                progressData={progressData}
                                totalEstimatedCost={totalEstimatedCost}
                                totalActualCost={totalActualCost}
                            />
                        )
                    },
                    {
                        key: 'TIMELINE',
                        label: 'Gantt Chart',
                        children: (
                            <PfoGanttChart 
                                selectedPfo={selectedPfo}
                                pfoDetails={pfoDetails}
                            />
                        )
                    },
                    {
                        key: 'ROUTING',
                        label: 'Quy trình gia công',
                        children: (
                            <PfoProcessRouting 
                                pfoId={selectedPfo.id}
                                existingMilestones={pfoDetails?.milestones || selectedPfo?.milestones || []}
                                salesOrderItems={pfoDetails?.sales_order?.items || []}
                                customQuantities={pfoDetails?.custom_quantities || {}}
                                suppliers={suppliers}
                                loading={loading}
                                onSaveRouting={handleSaveRouting}
                                onGeneratePo={handleGeneratePo}
                            />
                        )
                    },
                    {
                        key: 'MATRIX_BTP',
                        label: 'Nhu cầu BTP',
                        children: (
                            <MaterialMatrix 
                                requirements={btpRequirements} 
                                suppliers={suppliers}
                                loading={loading}
                                onSaveReqs={handleSaveReqs}
                                onGeneratePo={handleGeneratePo}
                                onCalculateBom={handleCalculateBom}
                            />
                        )
                    },
                    {
                        key: 'MATRIX',
                        label: 'Nhu cầu NPL',
                        children: (
                            <MaterialMatrix 
                                requirements={nplRequirements} 
                                suppliers={suppliers}
                                loading={loading}
                                onSaveReqs={handleSaveReqs}
                                onGeneratePo={handleGeneratePo}
                                onCalculateBom={handleCalculateBom}
                            />
                        )
                    },
                    {
                        key: 'BOM',
                        label: 'Thông tin BOM',
                        children: (
                            <Table 
                                columns={columnsBom} 
                                dataSource={bomTreeData} 
                                size="small" 
                                pagination={false}
                                expandable={{
                                    defaultExpandAllRows: true
                                }}
                            />
                        )
                    },
                    {
                        key: 'CP_VC',
                        label: 'CP_VC',
                        children: (
                            <Table 
                                columns={[
                                    { title: 'Sản phẩm', dataIndex: 'product_name', key: 'product_name' },
                                    { title: 'Khoản mục', dataIndex: 'name', key: 'name' },
                                    { title: 'Chi phí (1 SP)', dataIndex: 'cost', key: 'cost', render: (val: any) => `${Number(val).toLocaleString()} ₫` }
                                ]} 
                                dataSource={pfoDetails?.sales_order?.items?.flatMap((item: any) => {
                                    const logs: any[] = [];
                                    const extractLogs = (prod: any, prefix: string = '') => {
                                        if (!prod) return;
                                        (prod.logistics || []).forEach((log: any) => {
                                            logs.push({ ...log, product_name: prefix + prod.name, key: `log-${log.id}-${prod.id}` });
                                        });
                                        if (prod.product_type === 'COMBO' && prod.components) {
                                            prod.components.forEach((comp: any) => extractLogs(comp.child_product, `${prefix}${prod.name} > `));
                                        }
                                    };
                                    extractLogs(item.product);
                                    return logs;
                                }) || []}
                                size="small"
                                pagination={false}
                            />
                        )
                    },
                    {
                        key: 'PO_NPL',
                        label: 'PO_NPL',
                        children: (
                            <Table 
                                columns={columnsPo} 
                                dataSource={pfoDetails?.pos?.pos_npl || []} 
                                size="small" 
                                rowKey="id"
                                expandable={{ expandedRowRender: expandedRowRenderItems }}
                            />
                        )
                    },
                    {
                        key: 'PO_GC',
                        label: 'PO_GC',
                        children: (
                            <Table 
                                columns={columnsPoGc} 
                                dataSource={pfoDetails?.pos?.pos_gc || []} 
                                size="small" 
                                rowKey="id"
                                expandable={{ expandedRowRender: expandedRowRenderItems }}
                            />
                        )
                    },
                    {
                        key: 'PXK_NPL',
                        label: 'PXK NPL',
                        children: (
                            <Table 
                                columns={columnsPxk} 
                                dataSource={pfoDetails?.pxks?.pxk_npl || []} 
                                size="small" 
                                rowKey="id"
                                expandable={{ expandedRowRender: expandedRowRenderItems }}
                            />
                        )
                    },
                    {
                        key: 'PXK_GC',
                        label: 'PXK GC',
                        children: (
                            <Table 
                                columns={columnsPxk} 
                                dataSource={pfoDetails?.pxks?.pxk_gc || []} 
                                size="small" 
                                rowKey="id"
                                expandable={{ expandedRowRender: expandedRowRenderItems }}
                            />
                        )
                    }
                ]} />
            </Card>

        </div>
    );

    const handlePxkSubmit = async () => {
        try {
            const values = await pxkForm.validateFields();
            if (!pxkTargetItem) return;

            const soId = selectedPfo?.sales_order?.id;
            if (!soId) {
                message.error('Không tìm thấy thông tin Sales Order');
                return;
            }

            const payload = {
                code: `PXK-${dayjs().format('YYMMDD-HHmmss')}`,
                date: values.date.format('YYYY-MM-DD'),
                note: values.note || '',
                delivery_address: selectedPfo?.sales_order?.customer?.address || '',
                contact_name: selectedPfo?.sales_order?.customer?.name || '',
                contact_phone: selectedPfo?.sales_order?.customer?.phone || '',
                status: 'PENDING_EXPORT',
                items: [
                    {
                        sku: pxkTargetItem.sku,
                        quantity: values.quantity
                    }
                ]
            };

            await api.post(`/sales/${soId}/delivery`, payload);
            message.success('Đã tạo PXK (Sales Delivery) thành công');
            setIsPxkModalVisible(false);
            onRefreshDetails?.();
        } catch (error: any) {
            console.error(error);
            if (error.response?.data?.message) {
                message.error(error.response.data.message);
            } else if (error.errorFields) {
                // validation error, do nothing
            } else {
                message.error('Lỗi khi tạo PXK');
            }
        }
    };

    return (
        <div>
            {tabsContent}
            {/* Modal Chọn BTP (Existing) */}
            <Modal
                title={`Chọn Bán Thành Phẩm (Giao cho: ${selectedPoGc?.supplier?.name})`}
                open={isBtpModalOpen}
                onCancel={() => {
                    setIsBtpModalOpen(false);
                    setSelectedBtpIds([]);
                }}
                onOk={async () => {
                    try {
                        await api.put(`/purchasing/po/${selectedPoGc.id}/semi-finished-products`, { semi_finished_products: selectedBtpIds });
                        message.success('Đã cập nhật BTP cho PO Gia công');
                        setIsBtpModalOpen(false);
                        onRefreshDetails?.();
                    } catch (e: any) {
                        message.error(e.response?.data?.message || 'Lỗi khi cập nhật BTP');
                    }
                }}
                okText="Lưu"
                cancelText="Hủy"
                destroyOnClose
            >
                <div style={{ marginBottom: 16 }}>
                    <Text type="secondary">Chọn các Bán Thành Phẩm cần giao cho xưởng gia công này thực hiện:</Text>
                </div>
                {availableBtps.length === 0 ? (
                    <Text type="danger">Lệnh KHSX này chưa có cấu hình Bán Thành Phẩm nào.</Text>
                ) : (
                    <Checkbox.Group 
                        style={{ width: '100%' }} 
                        value={selectedBtpIds}
                        onChange={(checkedValues) => setSelectedBtpIds(checkedValues as number[])}
                    >
                        <Row gutter={[0, 8]}>
                            {availableBtps.map((btp: any) => (
                                <Col span={24} key={btp.product_id}>
                                    <Checkbox value={btp.product_id}>
                                        <Text strong>{btp.product?.sku || `SP-${btp.product_id}`}</Text> - {btp.product?.name || btp.material_name} 
                                        <Tag color="blue" style={{ marginLeft: 8 }}>SL: {btp.planned_quantity}</Tag>
                                    </Checkbox>
                                </Col>
                            ))}
                        </Row>
                    </Checkbox.Group>
                )}
            </Modal>

            {/* Modal Tạo PXK Từ Tồn Kho */}
            <Modal
                title="Tạo PXK xuất kho (Dùng tồn kho)"
                open={isPxkModalVisible}
                onCancel={() => setIsPxkModalVisible(false)}
                onOk={handlePxkSubmit}
                okText="Tạo phiếu"
                cancelText="Hủy"
                destroyOnClose
            >
                {pxkTargetItem && (
                    <Form form={pxkForm} layout="vertical">
                        <div style={{ marginBottom: 16 }}>
                            <Text strong>Sản phẩm:</Text> {pxkTargetItem.name} ({pxkTargetItem.sku})
                            <br />
                            <Text strong>Khách hàng:</Text> {selectedPfo?.sales_order?.customer?.name || 'N/A'}
                        </div>
                        <Form.Item name="date" label="Ngày xuất" rules={[{ required: true, message: 'Vui lòng chọn ngày xuất' }]}>
                            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                        </Form.Item>
                        <Form.Item name="quantity" label="Số lượng xuất" rules={[{ required: true, message: 'Vui lòng nhập số lượng' }]}>
                            <InputNumber 
                                style={{ width: '100%' }} 
                                min={1} 
                                max={pxkTargetItem.booked_quantity} 
                            />
                        </Form.Item>
                        <Form.Item name="note" label="Ghi chú">
                            <Input.TextArea rows={3} placeholder="Ghi chú thêm..." />
                        </Form.Item>
                    </Form>
                )}
            </Modal>
        </div>
    );
};

export default PfoDetailTabs;
