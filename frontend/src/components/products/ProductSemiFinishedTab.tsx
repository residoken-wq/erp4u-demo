import React, { useState, useEffect } from 'react';
import { Card, Button, Input, InputNumber, Select, Space, Tag, Typography, Row, Col, Popconfirm, message, Alert, Tooltip, Divider, Table } from 'antd';
import { PlusOutlined, DeleteOutlined, CopyOutlined, SaveOutlined, ArrowRightOutlined, ExperimentOutlined, CheckCircleOutlined } from '@ant-design/icons';
import api from '../../utils/api';

const { Title } = Typography;

export interface BtpComponent {
    id?: string;
    material_id?: number | null;
    material_code?: string;
    material_name: string;
    quantity: number;
    unit: string;
    waste_percent: number;
    note?: string;
}

export interface SemiFinishedDraft {
    id: string | number;
    isNew?: boolean;
    sku: string;
    name: string;
    unit: string;
    quantity_usage: number; // Định mức dùng cho 1 SP chính
    components: BtpComponent[];
}

interface ProductSemiFinishedTabProps {
    editingItem: any;
    materials: any[];
    fetchDetailData: (id: number) => void;
    components: any[]; 
    boms?: any[];
}

const COMMON_UNITS = [
    { value: 'm', label: 'Mét (m)' },
    { value: 'cuộn', label: 'Cuộn' },
    { value: 'tấm', label: 'Tấm' },
    { value: 'cái', label: 'Cái' },
    { value: 'bộ', label: 'Bộ' },
    { value: 'kg', label: 'Kg' },
    { value: 'con', label: 'Con' }
];

const ProductSemiFinishedTab: React.FC<ProductSemiFinishedTabProps> = ({ editingItem, materials, fetchDetailData, components, boms }) => {
    const [btpList, setBtpList] = useState<SemiFinishedDraft[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Filter components to only SEMI_FINISHED
    const semiFinishedList = components.filter(c => c.child_product?.product_type === 'SEMI_FINISHED');

    useEffect(() => {
        const initData = async () => {
            setLoading(true);
            try {
                const drafts: SemiFinishedDraft[] = [];
                for (const comp of semiFinishedList) {
                    const child = comp.child_product;
                    let bomComponents: BtpComponent[] = [];
                    try {
                        const resBom = await api.get(`/products/${encodeURIComponent(child.sku)}/boms`);
                        if (resBom.data && Array.isArray(resBom.data)) {
                            bomComponents = resBom.data.map((b: any) => ({
                                id: `BOM_${b.id}`,
                                material_id: b.material_id,
                                material_code: b.material?.code,
                                material_name: b.material?.name,
                                quantity: Number(b.quantity),
                                waste_percent: Number(b.waste_percent || 0),
                                unit: b.material?.unit || 'm'
                            }));
                        }
                    } catch (e) {
                        console.error('Lỗi load BOM cho BTP:', child.sku);
                    }

                    drafts.push({
                        id: child.id,
                        isNew: false,
                        sku: child.sku,
                        name: child.name,
                        unit: child.unit || 'cái',
                        quantity_usage: Number(comp.quantity),
                        components: bomComponents
                    });
                }
                setBtpList(drafts);
            } catch (error) {
                console.error(error);
                message.error('Lỗi khi tải dữ liệu Bán Thành Phẩm');
            }
            setLoading(false);
        };

        if (editingItem && editingItem.id) {
            initData();
        }
    }, [editingItem.id, components.length]); // Re-run if components change (e.g. after save)

    const handleAddBtp = () => {
        const newBtp: SemiFinishedDraft = {
            id: `DRAFT_${Date.now()}`,
            isNew: true,
            sku: `${editingItem.sku}_BTP_${Math.floor(Math.random() * 1000)}`,
            name: `${editingItem.name} - (Tên BTP mới)`,
            unit: 'cái',
            quantity_usage: 1,
            components: []
        };
        setBtpList(prev => [...prev, newBtp]);
    };

    const handleCopyFromBOM = (btpIndex: number) => {
        if (!boms || boms.length === 0) {
            message.warning('Sản phẩm chính chưa có dữ liệu BOM.');
            return;
        }

        setBtpList(prev => {
            const newList = [...prev];
            if (!newList[btpIndex]) return prev;

            const copiedComponents = boms.map(b => ({
                id: `COMP_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                material_id: b.material_id,
                material_code: b.material?.code || '',
                material_name: b.material?.name || b.material?.code || '',
                quantity: Number(b.quantity) || 1,
                waste_percent: Number(b.waste_percent || 0),
                unit: b.material?.unit || 'm'
            }));

            newList[btpIndex].components = [...(newList[btpIndex].components || []), ...copiedComponents];
            return newList;
        });
        message.success('Đã lấy NPL từ BOM');
    };

    const handleCloneBtp = (index: number) => {
        setBtpList(prev => {
            const itemToClone = prev[index];
            if (!itemToClone) return prev;
            const cloned: SemiFinishedDraft = {
                ...itemToClone,
                id: `DRAFT_${Date.now()}`,
                isNew: true,
                sku: `${itemToClone.sku}_COPY_${Math.floor(Math.random() * 100)}`,
                name: `${itemToClone.name} (Bản sao)`,
                components: (itemToClone.components || []).map(c => ({ ...c, id: `COMP_${Date.now()}_${Math.floor(Math.random() * 1000)}` }))
            };
            const newList = [...prev];
            newList.splice(index + 1, 0, cloned);
            return newList;
        });
        message.success('Đã nhân bản BTP');
    };

    const handleDeleteBtp = (index: number) => {
        setBtpList(prev => {
            const newList = [...prev];
            newList.splice(index, 1);
            return newList;
        });
    };

    const handleUpdateBtp = (index: number, field: keyof SemiFinishedDraft, value: any) => {
        setBtpList(prev => {
            const newList = [...prev];
            if (!newList[index]) return prev;
            newList[index] = { ...newList[index], [field]: value };
            return newList;
        });
    };

    const handleAddComponent = (btpIndex: number, materialOption?: any) => {
        setBtpList(prev => {
            const newList = [...prev];
            if (!newList[btpIndex]) return prev;
            const newComp: BtpComponent = {
                id: `COMP_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                material_id: materialOption?.id || null,
                material_code: materialOption?.code || '',
                material_name: materialOption?.name || '',
                quantity: 1,
                waste_percent: 0,
                unit: materialOption?.unit || 'm'
            };
            newList[btpIndex].components = [...(newList[btpIndex].components || []), newComp];
            return newList;
        });
    };

    const handleUpdateComponent = (btpIndex: number, compIndex: number, field: keyof BtpComponent, value: any) => {
        setBtpList(prev => {
            const newList = [...prev];
            if (!newList[btpIndex] || !newList[btpIndex].components?.[compIndex]) return prev;
            const components = [...newList[btpIndex].components];
            components[compIndex] = { ...components[compIndex], [field]: value };

            if (field === 'material_id') {
                const mat = materials.find(m => Number(m.value) === Number(value));
                if (mat) {
                    components[compIndex].material_code = mat.label; // usually label contains code + name
                    components[compIndex].material_name = mat.label;
                }
            }

            newList[btpIndex].components = components;
            return newList;
        });
    };

    const handleDeleteComponent = (btpIndex: number, compIndex: number) => {
        setBtpList(prev => {
            const newList = [...prev];
            if (!newList[btpIndex] || !newList[btpIndex].components) return prev;
            const components = [...newList[btpIndex].components];
            components.splice(compIndex, 1);
            newList[btpIndex].components = components;
            return newList;
        });
    };

    const handleSaveBtpList = async () => {
        setSaving(true);
        try {
            // Lấy danh sách components (ngoài SEMI_FINISHED) để giữ lại khi save
            const otherComponents = components.filter(c => c.child_product?.product_type !== 'SEMI_FINISHED').map(c => ({
                sku: c.child_product.sku,
                quantity: c.quantity
            }));

            const savedBtpSkus: { sku: string, quantity: number }[] = [];

            // Xử lý từng BTP
            for (const btp of btpList) {
                let currentBtpId = btp.id;
                let currentBtpSku = btp.sku;

                if (btp.isNew) {
                    // Tạo Product ảo mới
                    const productPayload = {
                        sku: btp.sku,
                        name: btp.name,
                        unit: btp.unit,
                        product_type: 'SEMI_FINISHED',
                        is_active: true,
                        base_price: 0,
                        cost_price: 0
                    };
                    const resProd = await api.post(`/products`, productPayload);
                    currentBtpId = resProd.data.id;
                    currentBtpSku = resProd.data.sku;
                } else {
                    // Cập nhật Product ảo cũ (đổi tên, đơn vị tính)
                    await api.put(`/products/${currentBtpId}`, {
                        name: btp.name,
                        unit: btp.unit
                    });
                }

                // Cập nhật BOM cho BTP này
                const bomPayload = (btp.components || []).map(comp => ({
                    material_id: comp.material_id,
                    quantity: comp.quantity,
                    waste_percent: comp.waste_percent || 0
                }));
                await api.post(`/products/${currentBtpId}/boms`, bomPayload);

                savedBtpSkus.push({ sku: currentBtpSku, quantity: btp.quantity_usage || 1 });
            }

            // Cập nhật liên kết component vào Sản phẩm chính
            const finalComponents = [...otherComponents, ...savedBtpSkus];
            await api.post(`/products/${editingItem.id}/components`, finalComponents);
            
            // Tính lại giá
            await api.get(`/products/calculate-cost/${encodeURIComponent(editingItem.sku)}`);

            message.success('Đã lưu toàn bộ thiết lập Bán Thành Phẩm!');
            fetchDetailData(editingItem.id);
        } catch (e: any) {
            console.error('Error saving BTP:', e);
            message.error('Lỗi khi lưu BTP: ' + (e?.response?.data?.message || e.message));
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div>Đang tải dữ liệu Bán Thành Phẩm...</div>;

    return (
        <div style={{ padding: '4px 0' }}>
            <Alert
                message={<b>Định mức Bán Thành Phẩm (BTP) cho Sản Phẩm Này</b>}
                description={
                    <div>
                        Thiết lập các cấu phần Bán Thành Phẩm (BTP) được sử dụng để tạo nên sản phẩm chính. BTP vẫn đóng vai trò là NPL với định mức riêng (BOM).<br/>
                        <i>Lưu ý: Dữ liệu BTP ở đây sẽ làm cơ sở để PO Gia Công kế thừa tự động khi triển khai sản xuất.</i>
                    </div>
                }
                type="info"
                showIcon
                icon={<ExperimentOutlined />}
                style={{ marginBottom: 16, borderRadius: 8 }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Space>
                    <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddBtp} style={{ borderColor: '#722ed1', color: '#722ed1', fontWeight: 600 }}>
                        + Thêm Bán Thành Phẩm
                    </Button>
                </Space>
                <Button 
                    type="primary" 
                    icon={<SaveOutlined />} 
                    loading={saving} 
                    onClick={handleSaveBtpList}
                    style={{ background: '#722ed1', borderColor: '#722ed1', fontWeight: 600 }}
                >
                    Lưu Bán Thành Phẩm ({btpList.length})
                </Button>
            </div>

            {btpList.length === 0 && (
                <Card style={{ textAlign: 'center', padding: '32px 0', borderStyle: 'dashed', borderColor: '#d3adf7', background: '#faf5ff', borderRadius: 8 }}>
                    <ExperimentOutlined style={{ fontSize: 40, color: '#9254de', marginBottom: 12 }} />
                    <Title level={5} style={{ color: '#531dab', margin: 0 }}>Sản phẩm này chưa cấu hình Bán Thành Phẩm</Title>
                    <p style={{ color: '#888', marginTop: 8, marginBottom: 16 }}>Bấm vào nút bên dưới để tạo cấu thành BTP cho SP.</p>
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleAddBtp} style={{ background: '#722ed1', borderColor: '#722ed1' }}>
                        Tạo BTP Đầu Tiên
                    </Button>
                </Card>
            )}

            {btpList.map((btp, btpIndex) => {
                const inputSummary = (btp.components || []).length > 0
                    ? btp.components.map(c => `${c.quantity} ${c.unit || ''} [${c.material_name || c.material_code || 'Vật tư'}]`).join('  +  ')
                    : 'Chưa chọn NPL đầu vào';
                const outputSummary = `${btp.quantity_usage || 0} ${btp.unit || ''} [${btp.name || 'Bán thành phẩm'}]`;

                return (
                    <Card
                        key={btp.id || btpIndex}
                        style={{
                            marginBottom: 20,
                            border: '1px solid #d3adf7',
                            borderRadius: 8,
                            boxShadow: '0 2px 8px rgba(114, 46, 209, 0.08)'
                        }}
                        bodyStyle={{ padding: '16px 20px' }}
                        title={
                            <Space size={12} wrap>
                                <Tag color="purple" style={{ fontSize: 13, padding: '2px 8px', fontWeight: 600 }}>
                                    #{btpIndex + 1} {btp.sku || 'BTP'}
                                </Tag>
                                <span style={{ fontWeight: 600, color: '#391085', fontSize: 15 }}>
                                    {btp.name || <i style={{ color: '#bfbfbf' }}>(Chưa đặt tên BTP)</i>}
                                </span>
                                <Tag color="blue" style={{ fontSize: 12 }}>
                                    Định mức cho 1 SP chính: <b>{btp.quantity_usage || 0} {btp.unit}</b>
                                </Tag>
                                {btp.isNew && <Tag color="orange">Bản nháp mới</Tag>}
                            </Space>
                        }
                        extra={
                            <Space>
                                <Tooltip title="Nhân bản BTP này">
                                    <Button size="small" icon={<CopyOutlined />} onClick={() => handleCloneBtp(btpIndex)} />
                                </Tooltip>
                                <Popconfirm title="Xóa BTP này?" onConfirm={() => handleDeleteBtp(btpIndex)}>
                                    <Button size="small" danger icon={<DeleteOutlined />} />
                                </Popconfirm>
                            </Space>
                        }
                    >
                        <Row gutter={[16, 12]}>
                            <Col xs={24} sm={12} md={12}>
                                <label style={{ fontSize: 12, color: '#666', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                                    Tên Bán Thành Phẩm (BTP) <span style={{ color: 'red' }}>*</span>:
                                </label>
                                <Input
                                    placeholder="Vd: Lót túi trước..."
                                    value={btp.name}
                                    onChange={e => handleUpdateBtp(btpIndex, 'name', e.target.value)}
                                    style={{ fontWeight: 600, borderColor: btp.name ? undefined : '#ffa39e' }}
                                />
                            </Col>

                            <Col xs={24} sm={12} md={6}>
                                <label style={{ fontSize: 12, color: '#666', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                                    Mã SKU BTP (Tự động):
                                </label>
                                <Input
                                    value={btp.sku}
                                    disabled={!btp.isNew}
                                    onChange={e => handleUpdateBtp(btpIndex, 'sku', e.target.value)}
                                />
                            </Col>

                            <Col xs={12} sm={6} md={3}>
                                <label style={{ fontSize: 12, color: '#666', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                                    Định mức SP:
                                </label>
                                <InputNumber
                                    min={0.01}
                                    step={0.1}
                                    style={{ width: '100%', fontWeight: 600, color: '#722ed1' }}
                                    value={btp.quantity_usage}
                                    onChange={val => handleUpdateBtp(btpIndex, 'quantity_usage', Number(val || 0))}
                                />
                            </Col>

                            <Col xs={12} sm={6} md={3}>
                                <label style={{ fontSize: 12, color: '#666', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                                    Đơn vị tính:
                                </label>
                                <Select
                                    style={{ width: '100%' }}
                                    value={btp.unit || 'cái'}
                                    onChange={val => handleUpdateBtp(btpIndex, 'unit', val)}
                                    options={COMMON_UNITS}
                                />
                            </Col>
                        </Row>

                        <div style={{
                            marginTop: 12,
                            marginBottom: 12,
                            padding: '10px 14px',
                            background: '#f9f0ff',
                            border: '1px dashed #d3adf7',
                            borderRadius: 6,
                            display: 'flex',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 8,
                            fontSize: 13
                        }}>
                            <span style={{ color: '#531dab', fontWeight: 600 }}>⚗️ Công thức phối trộn:</span>
                            <span style={{ color: '#262626', background: '#fff', padding: '2px 8px', borderRadius: 4, border: '1px solid #e8e8e8' }}>
                                {inputSummary}
                            </span>
                            <ArrowRightOutlined style={{ color: '#722ed1', fontSize: 16 }} />
                            <span style={{ color: '#531dab', fontWeight: 700, background: '#efdbff', padding: '2px 8px', borderRadius: 4, border: '1px solid #d3adf7' }}>
                                {outputSummary}
                            </span>
                        </div>

                        <div style={{ marginTop: 14 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <span style={{ fontWeight: 600, fontSize: 13, color: '#333' }}>
                                    📦 Thành phần NPL đầu vào ({btp.components?.length || 0}):
                                </span>
                                <Space size={8}>
                                    <Button 
                                        size="small" 
                                        icon={<CheckCircleOutlined />} 
                                        onClick={() => handleCopyFromBOM(btpIndex)}
                                        style={{ borderColor: '#52c41a', color: '#52c41a' }}
                                    >
                                        Lấy NPL từ BOM
                                    </Button>
                                    <Button 
                                        size="small" 
                                        icon={<PlusOutlined />} 
                                        onClick={() => handleAddComponent(btpIndex)}
                                        style={{ borderColor: '#722ed1', color: '#722ed1' }}
                                    >
                                        + Thêm NPL
                                    </Button>
                                </Space>
                            </div>

                            <Table
                                dataSource={btp.components || []}
                                rowKey="id"
                                pagination={false}
                                size="small"
                                bordered
                                columns={[
                                    {
                                        title: 'NPL / Vật tư đầu vào',
                                        width: 320,
                                        render: (r: BtpComponent, _: any, compIdx: number) => (
                                            <Select
                                                showSearch
                                                placeholder="Chọn NPL..."
                                                style={{ width: '100%' }}
                                                value={r.material_id || undefined}
                                                onChange={(val) => handleUpdateComponent(btpIndex, compIdx, 'material_id', val)}
                                                options={materials}
                                                optionFilterProp="label"
                                            />
                                        )
                                    },
                                    {
                                        title: 'Số lượng / Định mức',
                                        width: 140,
                                        render: (r: BtpComponent, _: any, compIdx: number) => (
                                            <InputNumber
                                                min={0.001}
                                                step={0.1}
                                                style={{ width: '100%', fontWeight: 600, color: '#cf1322' }}
                                                value={r.quantity}
                                                onChange={val => handleUpdateComponent(btpIndex, compIdx, 'quantity', Number(val || 0))}
                                            />
                                        )
                                    },
                                    {
                                        title: 'Hao hụt (%)',
                                        width: 120,
                                        render: (r: BtpComponent, _: any, compIdx: number) => (
                                            <InputNumber
                                                min={0}
                                                max={100}
                                                style={{ width: '100%' }}
                                                value={r.waste_percent}
                                                onChange={val => handleUpdateComponent(btpIndex, compIdx, 'waste_percent', Number(val || 0))}
                                            />
                                        )
                                    },
                                    {
                                        title: '',
                                        width: 50,
                                        align: 'center',
                                        render: (_: any, __: any, compIdx: number) => (
                                            <Button
                                                size="small"
                                                type="text"
                                                danger
                                                icon={<DeleteOutlined />}
                                                onClick={() => handleDeleteComponent(btpIndex, compIdx)}
                                            />
                                        )
                                    }
                                ]}
                            />
                        </div>
                    </Card>
                );
            })}
        </div>
    );
};

export default ProductSemiFinishedTab;
