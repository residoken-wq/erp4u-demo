import React, { useEffect, useState, useMemo } from 'react';
import { Card, Modal, Form, Input, InputNumber, DatePicker, Tabs, Button, message, Drawer, Space, Typography, Tag, Divider, Row, Col, Table, Statistic, Descriptions, Tooltip } from 'antd';
import { ReloadOutlined, PlusOutlined, SettingOutlined, CalculatorOutlined, ShoppingCartOutlined, FileTextOutlined, DeleteOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { API_URL } from '../config';
import useMobile from '../hooks/useMobile';

// Components
import ControlTowerKPI from '../components/planning/ControlTowerKPI';
import PfoKanbanBoard from '../components/planning/PfoKanbanBoard';
import MaterialMatrix from '../components/planning/MaterialMatrix';
import PfoProcessRouting from '../components/planning/PfoProcessRouting';
import PendingOrdersTab from '../components/planning/PendingOrdersTab';
import PfoDetailTabs from '../components/planning/PfoDetailTabs';
import MaterialDemandDashboard from '../components/planning/MaterialDemandDashboard';
import ProductDemandDashboard from '../components/planning/ProductDemandDashboard';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

const PlanningPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState('CONTROL_TOWER');
    const [loading, setLoading] = useState(false);
    const isMobile = !!useMobile();

    // Data State
    const [pendingOrders, setPendingOrders] = useState<any[]>([]);
    const [pfos, setPfos] = useState<any[]>([]);
    const [stats, setStats] = useState<any>({});
    const [suppliers, setSuppliers] = useState<any[]>([]);
    
    // UI State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [form] = Form.useForm();
    
    // PFO Detail Drawer State
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [selectedPfo, setSelectedPfo] = useState<any>(null);
    const [pfoDetails, setPfoDetails] = useState<any>(null);

    // BTP Preview Modal State
    const [isBtpPreviewModalOpen, setIsBtpPreviewModalOpen] = useState(false);
    const [btpPreviewData, setBtpPreviewData] = useState<any[]>([]);
    const [btpOverrides, setBtpOverrides] = useState<Record<string, number>>({});

    const fetchData = async () => {
        setLoading(true);
        try {
            const [resSuggest, resPfos, resSuppliers] = await Promise.all([
                axios.get(`${API_URL}/planning/pfo/suggestions`).catch(() => ({ data: [] })),
                axios.get(`${API_URL}/planning`).catch(() => ({ data: [] })),
                axios.get(`${API_URL}/suppliers`).catch(() => ({ data: [] }))
            ]);
            setPendingOrders(Array.isArray(resSuggest.data) ? resSuggest.data : []);
            
            const loadedPfos = Array.isArray(resPfos.data) ? resPfos.data : [];
            setPfos(loadedPfos);
            setSuppliers(Array.isArray(resSuppliers.data) ? resSuppliers.data : []);
            
            // Calculate real stats
            setStats({
                alerts: loadedPfos.filter(p => p.status === 'WAITING_VENDOR' || !p.vendor_id).length,
                activePfos: loadedPfos.filter(p => ['MATERIAL_PREP', 'IN_PRODUCTION', 'RECEIVING'].includes(p.status)).length,
                qcPassed: loadedPfos.filter(p => p.status === 'COMPLETED').length,
                otif: 95
            });
        } catch (e) { message.error('Lỗi tải dữ liệu'); }
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    // --- Handlers ---
    const handleCreatePfo = async (values: any) => {
        try {
            const selectedOrders = pendingOrders.filter((o: any) => selectedRowKeys.includes(o.id));
            const payload = {
                code: values.code,
                name: values.name,
                start_date: values.dateRange[0].toISOString(),
                end_date: values.dateRange[1].toISOString(),
                orderCode: selectedOrders[0]?.order_code
            };
            await axios.post(`${API_URL}/planning/pfo/generate`, payload);
            message.success('Đã phát hành Lệnh SX (PFO)');
            setIsCreateModalOpen(false); setSelectedRowKeys([]); fetchData(); setActiveTab('CONTROL_TOWER');
        } catch (e: any) { 
            message.error(e.response?.data?.message || 'Lỗi phát hành PFO'); 
        }
    };

    const fetchPfoDetails = async (id: number) => {
        try {
            const res = await axios.get(`${API_URL}/planning/pfo/${id}`);
            const poRes = await axios.get(`${API_URL}/planning/pfo/${id}/pos`).catch(() => ({ data: { pos_npl: [], pos_gc: [] } }));
            const pxkRes = await axios.get(`${API_URL}/planning/pfo/${id}/pxks`).catch(() => ({ data: { pxk_npl: [], pxk_gc: [] } }));
            return { ...res.data, pos: poRes.data, pxks: pxkRes.data };
        } catch (e) {
            return null;
        }
    };

    const handlePfoClick = async (pfo: any) => {
        setLoading(true);
        setSelectedPfo(pfo);
        setIsDrawerOpen(true);
        
        const details = await fetchPfoDetails(pfo.id);
        if (details) {
            setPfoDetails(details);
        } else {
            setPfoDetails({ ...pfo, material_requirements: [], milestones: [], pos: { pos_npl: [], pos_gc: [] }, pxks: { pxk_npl: [], pxk_gc: [] } });
        }
        setLoading(false);
    };

    const [usePfoQtyForBom, setUsePfoQtyForBom] = useState(false);

    const handleCalculateBom = async (usePfoQty: boolean = false) => {
        if (!selectedPfo) return;
        setUsePfoQtyForBom(usePfoQty);
        setLoading(true);
        try {
            const previewRes = await axios.get(`${API_URL}/planning/pfo/${selectedPfo.id}/preview-btp?usePfoQty=${usePfoQty}&t=${Date.now()}`);
            if (previewRes.data && previewRes.data.length > 0) {
                setBtpPreviewData(previewRes.data);
                
                const initialOverrides: Record<string, number> = {};
                previewRes.data.forEach((btp: any) => {
                    initialOverrides[btp.product_id] = Math.min(btp.required_qty, btp.available_stock);
                });
                setBtpOverrides(initialOverrides);
                
                setIsBtpPreviewModalOpen(true);
            } else {
                await proceedCalculateBom({}, usePfoQty);
            }
        } catch (e: any) {
            message.error('Lỗi lấy trước thông tin BTP');
        }
        setLoading(false);
    };

    const proceedCalculateBom = async (overrides: Record<string, number>, usePfoQty: boolean = usePfoQtyForBom) => {
        if (!selectedPfo) return;
        setLoading(true);
        try {
            const res = await axios.post(`${API_URL}/planning/pfo/${selectedPfo.id}/calculate-bom`, { btpOverrides: overrides, usePfoQty });
            message.success(res.data.message || 'Đã bóc tách BOM thành công!');
            
            const newReqs = res.data.requirements || [];
            const details = await fetchPfoDetails(selectedPfo.id);
            if (details) {
                setPfoDetails(details);
            } else {
                setPfoDetails((prev: any) => ({ ...prev, material_requirements: newReqs }));
            }
            fetchData();
        } catch (e: any) { 
            message.error(e.response?.data?.message || 'Lỗi tính toán BOM'); 
        }
        setLoading(false);
        setIsBtpPreviewModalOpen(false);
    };

    const handleSaveRouting = async (routingData: any[]) => {
        if (!selectedPfo) return;
        setLoading(true);
        try {
            const res = await axios.post(`${API_URL}/planning/pfo/${selectedPfo.id}/process-routing`, {
                routing: routingData
            });
            message.success(res.data.message || 'Đã lưu phân công xưởng gia công!');
            
            const details = await fetchPfoDetails(selectedPfo.id);
            if (details) setPfoDetails(details);
            fetchData();
        } catch (e: any) {
            message.error(e.response?.data?.message || 'Lỗi lưu phân công xưởng');
        }
        setLoading(false);
    };

    const handleSaveReqs = async (reqs: any[]) => {
        if (!selectedPfo) return;
        setLoading(true);
        try {
            await axios.post(`${API_URL}/planning/pfo/${selectedPfo.id}/save-requirements`, { requirements: reqs });
            message.success('Đã lưu cấu hình vật tư');
            fetchData();
        } catch (e: any) {
            message.error(e.response?.data?.message || 'Lỗi lưu cấu hình vật tư');
        }
        setLoading(false);
    };

    const handleGeneratePo = async (reqs?: any[]) => {
        if (!selectedPfo) return;
        setLoading(true);
        try {
            if (reqs && reqs.length > 0) {
                await axios.post(`${API_URL}/planning/pfo/${selectedPfo.id}/save-requirements`, { requirements: reqs });
            }
            const res = await axios.post(`${API_URL}/planning/pfo/${selectedPfo.id}/generate-pos`);
            message.success(res.data.message || 'Đã phát hành các Đơn đặt hàng (PO)');
            
            const details = await fetchPfoDetails(selectedPfo.id);
            if (details) setPfoDetails(details);
            fetchData();
        } catch (e: any) { 
            message.error(e.response?.data?.message || 'Lỗi tạo PO'); 
        }
        setLoading(false);
    };

    const handleDeletePfo = () => {
        if (!selectedPfo) return;
        Modal.confirm({
            title: 'Xóa Lệnh Sản Xuất (PFO)?',
            content: 'Bạn có chắc chắn muốn xóa Lệnh Sản Xuất này? Nếu đã có PO được tạo, bạn phải hủy các PO đó trước. Hành động này sẽ chuyển Đơn hàng trở lại trạng thái chờ lập KHSX.',
            okText: 'Xóa Lệnh',
            okType: 'danger',
            cancelText: 'Hủy',
            onOk: async () => {
                setLoading(true);
                try {
                    const res = await axios.delete(`${API_URL}/planning/pfo/${selectedPfo.id}`);
                    message.success(res.data.message || 'Đã xóa Lệnh Sản Xuất');
                    setIsDrawerOpen(false);
                    setSelectedPfo(null);
                    setPfoDetails(null);
                    fetchData();
                } catch (e: any) {
                    message.error(e.response?.data?.message || 'Không thể xóa Lệnh Sản Xuất');
                }
                setLoading(false);
            }
        });
    };

    return (
        <div style={{ maxWidth: isMobile ? '100%' : '95%', margin: '0 auto', padding: isMobile ? '8px 4px' : '16px 0' }}>
            {/* STATS CARDS */}
            <ControlTowerKPI stats={stats} />

            <Card
                bodyStyle={{ padding: isMobile ? '8px 12px' : 16 }}
                style={{ borderRadius: 12, border: '1px solid #e8e8e8', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}
                title={
                    <span style={{ fontSize: isMobile ? 14 : 17, fontWeight: 600, color: '#1d39c4' }}>
                        🏭 Outsourced Manufacturing Control Tower
                    </span>
                }
                extra={
                    <Space>
                        <Button 
                            icon={<PlusOutlined />} 
                            onClick={() => setActiveTab('DEMAND')} 
                            type={activeTab === 'DEMAND' ? 'primary' : 'default'}
                            style={{ borderRadius: 6 }}
                        >
                            Lập KHSX
                        </Button>
                        <Button icon={<ReloadOutlined />} onClick={fetchData} style={{ borderRadius: 6 }} />
                    </Space>
                }
            >
                <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
                    {
                        key: 'DEMAND',
                        label: 'Danh sách cần lập KHSX',
                        children: (
                            <PendingOrdersTab
                                pendingOrders={pendingOrders}
                                selectedRowKeys={selectedRowKeys}
                                onSelectedRowKeysChange={setSelectedRowKeys}
                                onCreatePlan={() => {
                                    if (selectedRowKeys.length === 0) {
                                        message.warning('Chọn ít nhất 1 đơn hàng'); return;
                                    }
                                    if (selectedRowKeys.length > 1) {
                                        message.warning('Hiện tại 1 PFO chỉ link 1 Sales Order'); return;
                                    }
                                    const selectedOrders = pendingOrders.filter(o => selectedRowKeys.includes(o.id));
                                    form.setFieldsValue({
                                        code: `PFO-${selectedOrders[0]?.order_code}`,
                                        name: `Sản xuất ${selectedOrders[0]?.order_code}`
                                    });
                                    setIsCreateModalOpen(true);
                                }}
                                isMobile={isMobile}
                                loading={loading}
                                setLoading={setLoading}
                                onRefresh={fetchData}
                            />
                        )
                    },
                    {
                        key: 'CONTROL_TOWER',
                        label: 'Kanban Theo Dõi (PFO)',
                        children: (
                            <PfoKanbanBoard pfos={pfos} onPfoClick={handlePfoClick} onRefresh={fetchData} />
                        )
                    },
                    {
                        key: 'MATERIAL_DEMAND',
                        label: 'Nhu cầu NPL',
                        children: (
                            <MaterialDemandDashboard isMobile={isMobile} />
                        )
                    },
                    {
                        key: 'PRODUCT_DEMAND',
                        label: 'Nhu cầu GC',
                        children: (
                            <ProductDemandDashboard isMobile={isMobile} />
                        )
                    }
                ]} />
            </Card>

            {/* Create PFO Modal */}
            <Modal title="Phát hành Lệnh SX (PFO)" open={isCreateModalOpen} onCancel={() => setIsCreateModalOpen(false)} onOk={() => form.submit()}>
                <Form form={form} layout="vertical" onFinish={handleCreatePfo}>
                    <Form.Item name="code" label="Mã PFO" rules={[{ required: true }]}><Input /></Form.Item>
                    <Form.Item name="name" label="Tên Lệnh" rules={[{ required: true }]}><Input /></Form.Item>
                    <Form.Item name="dateRange" label="Thời Gian (Planned Start - End)" rules={[{ required: true }]}><RangePicker style={{ width: '100%' }} /></Form.Item>
                </Form>
            </Modal>

            {/* PFO Detail Drawer - Expanded to 92% for spacious workflow */}
            <Drawer
                title={
                    <Space size="large">
                        <Text strong style={{ fontSize: 18, color: '#1d39c4' }}>
                            📋 Chi Tiết Lệnh SX: {selectedPfo?.code} 
                            {pfoDetails?.sales_order?.customer_name || pfoDetails?.sales_order?.customer?.name 
                                ? ` - Khách hàng: ${pfoDetails?.sales_order?.customer_name || pfoDetails?.sales_order?.customer?.name}` 
                                : ''}
                        </Text>
                        <Tag color="blue" style={{ fontSize: 13, padding: '2px 10px' }}>
                            {pfoDetails?.status || selectedPfo?.status}
                        </Tag>
                    </Space>
                }
                placement="right"
                width={isMobile ? '100%' : '80%'}
                onClose={() => setIsDrawerOpen(false)}
                open={isDrawerOpen}
                extra={
                    <Space>
                        <Button 
                            danger 
                            icon={<DeleteOutlined />}
                            onClick={handleDeletePfo}
                            loading={loading}
                        >
                            Xóa Lệnh
                        </Button>
                        <Button 
                            type="primary" 
                            icon={<CalculatorOutlined />}
                            onClick={() => handleCalculateBom(false)}
                            loading={loading}
                        >
                            Tính BOM theo SO
                        </Button>
                        <Button 
                            type="primary" 
                            ghost
                            icon={<CalculatorOutlined />}
                            onClick={() => handleCalculateBom(true)}
                            loading={loading}
                        >
                            Tính BOM theo KHSX
                        </Button>
                        <Button 
                            type="primary" 
                            ghost
                            icon={<ShoppingCartOutlined />}
                            onClick={handleGeneratePo}
                            loading={loading}
                        >
                            Phát Hành Các PO (Gate 4)
                        </Button>
                    </Space>
                }
            >
                {selectedPfo ? (
                    <PfoDetailTabs
                        selectedPfo={selectedPfo}
                        pfoDetails={pfoDetails}
                        suppliers={suppliers}
                        loading={loading}
                        isMobile={isMobile}
                        handleSaveRouting={handleSaveRouting}
                        handleSaveReqs={handleSaveReqs}
                        handleGeneratePo={handleGeneratePo}
                        handleCalculateBom={handleCalculateBom}
                        onRefreshDetails={async () => {
                            if (selectedPfo?.id) {
                                const details = await fetchPfoDetails(selectedPfo.id);
                                if (details) setPfoDetails(details);
                            }
                        }}
                    />
                ) : (
                    <div style={{ textAlign: 'center', padding: 50 }}>Loading...</div>
                )}
            </Drawer>

            {/* BTP Preview Modal */}
            <Modal
                title="Sử dụng tồn kho Bán Thành Phẩm (BTP)"
                open={isBtpPreviewModalOpen}
                onCancel={() => setIsBtpPreviewModalOpen(false)}
                onOk={() => proceedCalculateBom(btpOverrides)}
                okText="Xác nhận & Tính toán"
                cancelText="Hủy"
                width={700}
            >
                <div style={{ marginBottom: 16 }}>
                    Hệ thống phát hiện có nhu cầu Bán Thành Phẩm trong quy trình sản xuất và có tồn kho hiện có. 
                    Vui lòng xác nhận số lượng tồn kho BTP muốn sử dụng. Lượng NPL cho phần thiếu sẽ được tự động tính toán.
                </div>
                <Table 
                    dataSource={btpPreviewData}
                    rowKey="product_id"
                    pagination={false}
                    columns={[
                        { title: 'Tên BTP', dataIndex: 'name', render: (val, r) => `${val} (${r.sku})` },
                        { title: 'SL Yêu cầu', dataIndex: 'required_qty', align: 'right' },
                        { title: 'Tồn kho BTP', dataIndex: 'available_stock', align: 'right', render: (val) => <Text type="success">{val}</Text> },
                        { 
                            title: 'Dùng tồn kho', 
                            key: 'override',
                            align: 'center',
                            render: (_, record) => (
                                <InputNumber
                                    min={0}
                                    max={Math.min(record.required_qty, record.available_stock)}
                                    value={btpOverrides[record.product_id] !== undefined ? btpOverrides[record.product_id] : 0}
                                    onChange={(val) => setBtpOverrides(prev => ({ ...prev, [record.product_id]: val || 0 }))}
                                />
                            )
                        }
                    ]}
                />
            </Modal>
        </div>
    );
};

export default PlanningPage;