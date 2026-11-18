import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Input, InputNumber, Select, Space, Tag, Typography, Row, Col, Popconfirm, message, Alert, Tooltip, Divider } from 'antd';
import { PlusOutlined, DeleteOutlined, CopyOutlined, SaveOutlined, ArrowRightOutlined, ExperimentOutlined, CheckCircleOutlined } from '@ant-design/icons';
import api from '../../utils/api';

const { Text, Title } = Typography;

export interface BtpComponent {
    id?: string;
    material_id?: number | null;
    material_code?: string;
    material_name: string;
    quantity: number;
    unit: string;
    note?: string;
}

export interface SemiFinishedProduct {
    id: string;
    btp_code?: string;
    btp_name: string;
    product_id?: number | null;
    product_name?: string;
    output_quantity: number;
    unit: string;
    target_po_id?: number | null;
    target_po_code?: string;
    target_vendor_id?: number | null;
    target_vendor_name?: string;
    note?: string;
    status?: 'DRAFT' | 'IN_PRODUCTION' | 'COMPLETED';
    components: BtpComponent[];
}

interface POBtpTabProps {
    currentPO: any;
    suppliers: any[];
    products: any[];
    planProducts?: any[];
    purchaseOrders?: any[];
    onSave?: (btpList: SemiFinishedProduct[]) => void;
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

export const POBtpTab: React.FC<POBtpTabProps> = ({ currentPO, suppliers, products, planProducts = [], purchaseOrders = [], onSave }) => {
    const [btpList, setBtpList] = useState<SemiFinishedProduct[]>([]);
    const [availableMaterials, setAvailableMaterials] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);

    // List of candidate products that this PO / KHSX produces
    const candidateProducts: any[] = React.useMemo(() => {
        const map = new Map<number, any>();
        if (currentPO?.items && Array.isArray(currentPO.items)) {
            for (const item of currentPO.items) {
                if (item.product) map.set(item.product.id, item.product);
                else if (item.product_id) map.set(item.product_id, { id: item.product_id, name: item.product_name || item.name, sku: item.sku });
            }
        }
        if (Array.isArray(planProducts)) {
            for (const prod of planProducts) {
                if (prod && prod.id && !map.has(prod.id)) map.set(prod.id, prod);
            }
        }
        if (map.size === 0 && Array.isArray(products)) {
            for (const prod of products) {
                if (prod && prod.id) map.set(prod.id, prod);
            }
        }
        return Array.from(map.values());
    }, [currentPO, planProducts, products]);

    // List of sibling PO_GCs in the same KHSX (or all other PO_GCs)
    const siblingPOs: any[] = React.useMemo(() => {
        if (!Array.isArray(purchaseOrders)) return [];
        return purchaseOrders.filter(p => p.type === 'OUTSOURCING' && p.id !== currentPO?.id);
    }, [purchaseOrders, currentPO?.id]);

    // Helper to get Customer Name from a PO
    const getPoCustomerName = (p: any) => {
        if (!p) return '';
        const pfo = p.pfo || p.plan;
        if (pfo) {
            if (pfo.sales_order) {
                const name = pfo.sales_order.customer?.name || pfo.sales_order.customer_name;
                if (name) return name;
            }
            if (pfo.sales_orders && pfo.sales_orders.length > 0) {
                const names = Array.from(new Set(pfo.sales_orders.map((so: any) => so?.customer?.name || so?.customer_name).filter(Boolean)));
                if (names.length > 0) return names.join(', ');
            }
        }
        if (p.type === 'POOLED' && p.child_pos && p.child_pos.length > 0) {
            const names = new Set<string>();
            for (const child of p.child_pos) {
                const childPfo = child.pfo || child.plan;
                if (childPfo?.sales_order) {
                    const n = childPfo.sales_order.customer?.name || childPfo.sales_order.customer_name;
                    if (n) names.add(n);
                }
            }
            if (names.size > 0) return Array.from(names).join(', ');
        }
        return '';
    };

    // Helper to clean and deduplicate stage names from PO note or items (remove ID/Xưởng #... and deduplicate stages)
    const getPoStagesDesc = (p: any) => {
        if (!p) return '';
        const rawNote = p.note || '';
        const stages = new Set<string>();

        if (rawNote) {
            // Loại bỏ "Đơn gia công cho Xưởng #..." hoặc "Xưởng #..."
            let cleaned = rawNote.replace(/Đơn gia công cho Xưởng\s*#?\d+/gi, '').trim();
            cleaned = cleaned.replace(/Xưởng\s*#?\d+/gi, '').trim();
            cleaned = cleaned.replace(/^\(+/, '').replace(/\)+$/, '').trim();

            cleaned.split(',').forEach((s: string) => {
                let part = s.trim();
                part = part.replace(/^[\(\[\{]+/, '').replace(/[\)\]\}]+$/, '').trim();
                if (part && !part.startsWith('#')) {
                    stages.add(part);
                }
            });
        }

        if (stages.size === 0 && Array.isArray(p.items)) {
            for (const item of p.items) {
                if (item.description) {
                    const match = item.description.match(/Gia công:\s*([^\[\n]+)/);
                    if (match && match[1]) {
                        stages.add(match[1].trim());
                    }
                }
            }
        }

        const uniqueList = Array.from(stages).filter(Boolean);
        return uniqueList.length > 0 ? `(${uniqueList.join(', ')})` : '';
    };

    // Format option label for sibling PO: Mã PO - Tên KH - Tên Nhà GC (Công đoạn)
    const formatPoOptionLabel = (p: any) => {
        const poCode = p.po_code || '';
        const custName = getPoCustomerName(p);
        const vendorName = p.supplier?.name || p.supplier_name || 'Chưa gán NGC';
        const stagesDesc = getPoStagesDesc(p);

        const parts = [poCode];
        if (custName) parts.push(custName);
        parts.push(vendorName);

        const mainText = parts.join(' - ');
        return `🏭 ${mainText}${stagesDesc ? ` ${stagesDesc}` : ''}`;
    };

    useEffect(() => {
        if (currentPO) {
            // Load existing BTP list from PO
            if (Array.isArray(currentPO.semi_finished_products) && currentPO.semi_finished_products.length > 0) {
                setBtpList(currentPO.semi_finished_products);
            } else {
                setBtpList([]);
                // Auto-load from product configurations
                setTimeout(() => {
                    handleLoadBtpFromProducts();
                }, 500);
            }

            // Fetch available outsourcing materials for dropdown
            if (currentPO.id) {
                api.get(`/purchasing/${currentPO.id}/outsourcing-materials`)
                    .then(res => {
                        if (Array.isArray(res.data)) {
                            setAvailableMaterials(res.data);
                        }
                    })
                    .catch(e => console.error('Error fetching outsourcing materials:', e));
            }
        }
    }, [currentPO?.id]);

    const handleLoadBtpFromProducts = async () => {
        if (!candidateProducts || candidateProducts.length === 0) return;
        
        try {
            const newBtpList: SemiFinishedProduct[] = [];
            
            for (const prod of candidateProducts) {
                if (!prod.sku) continue;
                
                // Fetch components of this product
                const resComp = await api.get(`/products/combo/${encodeURIComponent(prod.sku)}`);
                const components = resComp.data || [];
                const btpComponents = components.filter((c: any) => c.child_product?.product_type === 'SEMI_FINISHED');
                
                for (const btp of btpComponents) {
                    const child = btp.child_product;
                    
                    // Fetch BOM for this BTP
                    const resBom = await api.get(`/products/${encodeURIComponent(child.sku)}/boms`);
                    const boms = resBom.data || [];
                    
                    const mappedComponents: BtpComponent[] = boms.map((b: any) => ({
                        id: `COMP_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                        material_id: b.material_id,
                        material_code: b.material?.code || '',
                        material_name: b.material?.name || '',
                        quantity: Number(b.quantity) || 0,
                        unit: b.material?.unit || 'm',
                        note: ''
                    }));

                    const multiplier = Number(currentPO?.items?.[0]?.quantity || 1);
                    const usageQty = Number(btp.quantity) || 1;
                    const outputQty = usageQty * multiplier;

                    newBtpList.push({
                        id: `BTP_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                        btp_code: child.sku,
                        btp_name: child.name,
                        product_id: prod.id,
                        product_name: prod.name || prod.product_name,
                        output_quantity: outputQty,
                        unit: child.unit || 'cái',
                        target_po_id: null,
                        target_po_code: '',
                        target_vendor_id: null,
                        target_vendor_name: '',
                        note: '',
                        status: 'DRAFT',
                        components: mappedComponents
                    });
                }
            }
            
            if (newBtpList.length > 0) {
                // If currently empty, just set it
                setBtpList(prev => prev.length === 0 ? newBtpList : [...prev, ...newBtpList]);
                message.success(`Đã tự động tải ${newBtpList.length} BTP từ định mức Sản phẩm.`);
            }
        } catch (e) {
            console.error('Error loading BTP from products:', e);
        }
    };

    const handleAddBtp = () => {
        const firstProduct = candidateProducts?.[0];
        const newBtp: SemiFinishedProduct = {
            id: `BTP_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            btp_code: `BTP-GC-${currentPO?.po_code ? currentPO.po_code.replace('PO-', '') : Date.now().toString().slice(-4)}`,
            btp_name: '',
            product_id: firstProduct?.id ? Number(firstProduct.id) : null,
            product_name: firstProduct?.name || firstProduct?.product_name || '',
            output_quantity: Number(currentPO?.items?.[0]?.quantity || 1),
            unit: 'm',
            target_po_id: null,
            target_po_code: '',
            target_vendor_id: null,
            target_vendor_name: '',
            note: '',
            status: 'DRAFT',
            components: []
        };
        setBtpList(prev => [...prev, newBtp]);
    };

    const handleCloneBtp = (index: number) => {
        setBtpList(prev => {
            const itemToClone = prev[index];
            if (!itemToClone) return prev;
            const cloned: SemiFinishedProduct = {
                ...itemToClone,
                id: `BTP_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                btp_code: `${itemToClone.btp_code || 'BTP'}-COPY`,
                btp_name: `${itemToClone.btp_name} (Bản sao)`,
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
        message.info('Đã xóa BTP');
    };

    const handleUpdateBtp = (index: number, field: keyof SemiFinishedProduct, value: any) => {
        setBtpList(prev => {
            const newList = [...prev];
            if (!newList[index]) return prev;
            newList[index] = { ...newList[index], [field]: value };
            
            if (field === 'target_vendor_id') {
                const supp = suppliers.find(s => Number(s.id) === Number(value));
                newList[index].target_vendor_name = supp?.name || '';
            }
            if (field === 'product_id') {
                const prod = candidateProducts.find(p => Number(p.id) === Number(value)) || products.find(p => Number(p.id) === Number(value));
                newList[index].product_name = prod?.name || prod?.product_name || '';
            }

            return newList;
        });
    };

    const handleAddComponent = (btpIndex: number, materialOption?: any) => {
        setBtpList(prev => {
            const newList = [...prev];
            if (!newList[btpIndex]) return prev;
            const newComp: BtpComponent = {
                id: `COMP_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                material_id: materialOption?.material_id || null,
                material_code: materialOption?.code || '',
                material_name: materialOption?.name || '',
                quantity: 1,
                unit: materialOption?.unit || 'm',
                note: ''
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
                const mat = availableMaterials.find(m => Number(m.material_id) === Number(value));
                if (mat) {
                    components[compIndex].material_code = mat.code;
                    components[compIndex].material_name = mat.name;
                    components[compIndex].unit = mat.unit || components[compIndex].unit;
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
            await api.put(`/purchasing/${currentPO.id}`, {
                semi_finished_products: btpList
            });
            message.success('Đã lưu danh sách Bán Thành Phẩm thành công!');
            if (onSave) onSave(btpList);
        } catch (e: any) {
            console.error('Error saving BTP:', e);
            message.error('Lỗi khi lưu Bán Thành Phẩm: ' + (e?.response?.data?.message || e.message));
        } finally {
            setSaving(false);
        }
    };

    // Auto-suggest BTP components from available materials
    const handleAutoSuggestFromMaterials = (btpIndex: number) => {
        if (availableMaterials.length === 0) {
            return message.warning('Chưa có danh sách NPL cấp phát từ PO/Kế hoạch');
        }
        setBtpList(prev => {
            const newList = [...prev];
            if (!newList[btpIndex]) return prev;
            const newComponents = availableMaterials.map(m => ({
                id: `COMP_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                material_id: m.material_id ? Number(m.material_id) : null,
                material_code: m.code || '',
                material_name: m.name || '',
                quantity: Number(m.quantity || 1),
                unit: m.unit || 'm',
                note: ''
            }));
            newList[btpIndex].components = newComponents;
            return newList;
        });
        message.success(`Đã tự động điền ${availableMaterials.length} NPL từ kế hoạch`);
    };

    return (
        <div style={{ padding: '4px 0' }}>
            {/* Header & Help Banner */}
            <Alert
                message={<b>Định mức Bán Thành Phẩm (BTP) & Phối Trộn NPL Gia Công</b>}
                description={
                    <div>
                        Phối trộn các Nguyên Phụ Liệu (NPL) được giao cho xưởng này để tạo ra <b>Bán Thành Phẩm (BTP)</b>.<br/>
                        <i>Ví dụ: <b>Vải cara vàng chanh</b> (4 tấm) + <b>Vải dù xám gạo</b> (10m) + <b>Gòn chần 300gr</b> (10m) = <b>Cuộn vải chần gòn 300gr Cara vàng chanh / dù xám</b> (9.8m).</i><br/>
                        BTP tạo ra sẽ sẵn sàng xuất sang <b>Xưởng tiếp theo (NGC đích)</b> để may ráp và hoàn thiện sản phẩm.
                    </div>
                }
                type="info"
                showIcon
                icon={<ExperimentOutlined />}
                style={{ marginBottom: 16, borderRadius: 8 }}
            />

            {/* Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Space>
                    <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddBtp} style={{ borderColor: '#722ed1', color: '#722ed1', fontWeight: 600 }}>
                        + Thêm Bán Thành Phẩm
                    </Button>
                    {candidateProducts.length > 0 && (
                        <Button type="dashed" icon={<CheckCircleOutlined />} onClick={handleLoadBtpFromProducts} style={{ color: '#52c41a', borderColor: '#52c41a' }}>
                            Tải lại BTP mẫu từ SP
                        </Button>
                    )}
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

            {/* Empty state */}
            {btpList.length === 0 && (
                <Card style={{ textAlign: 'center', padding: '32px 0', borderStyle: 'dashed', borderColor: '#d3adf7', background: '#faf5ff', borderRadius: 8 }}>
                    <ExperimentOutlined style={{ fontSize: 40, color: '#9254de', marginBottom: 12 }} />
                    <Title level={5} style={{ color: '#531dab', margin: 0 }}>Chưa có Bán Thành Phẩm nào được thiết lập cho PO này</Title>
                    <p style={{ color: '#888', marginTop: 8, marginBottom: 16 }}>Bấm vào nút bên dưới để tạo công thức phối trộn NPL thành BTP.</p>
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleAddBtp} style={{ background: '#722ed1', borderColor: '#722ed1' }}>
                        Tạo Bán Thành Phẩm Đầu Tiên
                    </Button>
                </Card>
            )}

            {/* BTP Cards List */}
            {btpList.map((btp, btpIndex) => {
                // Build formula string
                const inputSummary = (btp.components || []).length > 0
                    ? btp.components.map(c => `${c.quantity} ${c.unit || ''} [${c.material_name || c.material_code || 'Vật tư'}]`).join('  +  ')
                    : 'Chưa chọn NPL đầu vào';
                const outputSummary = `${btp.output_quantity || 0} ${btp.unit || ''} [${btp.btp_name || 'Bán thành phẩm'}]`;

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
                                    #{btpIndex + 1} {btp.btp_code || 'BTP'}
                                </Tag>
                                <span style={{ fontWeight: 600, color: '#391085', fontSize: 15 }}>
                                    {btp.btp_name || <i style={{ color: '#bfbfbf' }}>(Chưa đặt tên BTP)</i>}
                                </span>
                                <Tag color="blue" style={{ fontSize: 12 }}>
                                    Đầu ra: <b>{btp.output_quantity || 0} {btp.unit}</b>
                                </Tag>
                                {btp.product_name && (
                                    <Tag color="geekblue" style={{ fontSize: 12 }}>
                                        🎯 Cho SP: <b>{btp.product_name}</b>
                                    </Tag>
                                )}
                                {(btp.target_po_code || btp.target_vendor_name) && (
                                    <Tag color="cyan" style={{ fontSize: 12 }}>
                                        <ArrowRightOutlined /> Giao sang: <b>
                                            {(() => {
                                                if (btp.target_po_id) {
                                                    const targetPo = siblingPOs.find(p => p.id === btp.target_po_id);
                                                    if (targetPo) {
                                                        const cust = getPoCustomerName(targetPo);
                                                        return `${targetPo.po_code}${cust ? ` - ${cust}` : ''} - ${targetPo.supplier?.name || targetPo.supplier_name || btp.target_vendor_name || 'NGC'}`;
                                                    }
                                                }
                                                return btp.target_po_code ? `${btp.target_po_code} — ${btp.target_vendor_name}` : btp.target_vendor_name;
                                            })()}
                                        </b>
                                    </Tag>
                                )}
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
                        {/* 1. Thông tin tổng quan BTP */}
                        <Row gutter={[16, 12]}>
                            <Col xs={24} sm={12} md={7}>
                                <label style={{ fontSize: 12, color: '#666', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                                    Tên Bán Thành Phẩm (BTP) <span style={{ color: 'red' }}>*</span>:
                                </label>
                                <Input
                                    placeholder="Vd: Cuộn vải chần gòn 300gr Cara vàng chanh..."
                                    value={btp.btp_name}
                                    onChange={e => handleUpdateBtp(btpIndex, 'btp_name', e.target.value)}
                                    style={{ fontWeight: 600, borderColor: btp.btp_name ? undefined : '#ffa39e' }}
                                />
                            </Col>

                            <Col xs={24} sm={12} md={4}>
                                <label style={{ fontSize: 12, color: '#666', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                                    Mã BTP / Quy cách:
                                </label>
                                <Input
                                    placeholder="Vd: BTP-CHAN-01"
                                    value={btp.btp_code}
                                    onChange={e => handleUpdateBtp(btpIndex, 'btp_code', e.target.value)}
                                />
                            </Col>

                            <Col xs={24} sm={12} md={5}>
                                <label style={{ fontSize: 12, color: '#1890ff', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                                    🎯 Sản phẩm sử dụng BTP này:
                                </label>
                                <Select
                                    showSearch
                                    allowClear
                                    placeholder="Chọn sản phẩm hoàn thiện..."
                                    style={{ width: '100%' }}
                                    value={btp.product_id ? Number(btp.product_id) : undefined}
                                    onChange={(val) => {
                                        const prodId = val != null ? Number(val) : null;
                                        const prod = candidateProducts.find(p => Number(p.id) === Number(val)) || products.find(p => Number(p.id) === Number(val));
                                        const prodName = prod?.name || prod?.product_name || '';
                                        
                                        setBtpList(prev => {
                                            const newList = [...prev];
                                            if (!newList[btpIndex]) return prev;
                                            newList[btpIndex] = {
                                                ...newList[btpIndex],
                                                product_id: prodId,
                                                product_name: prodName
                                            };
                                            return newList;
                                        });
                                    }}
                                    options={candidateProducts.map(p => ({
                                        label: `${p.sku ? `[${p.sku}] ` : ''}${p.name || p.product_name || 'SP'}`,
                                        value: Number(p.id)
                                    }))}
                                    optionFilterProp="label"
                                />
                            </Col>

                            <Col xs={12} sm={6} md={4}>
                                <label style={{ fontSize: 12, color: '#666', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                                    SL Đầu ra <span style={{ color: 'red' }}>*</span>:
                                </label>
                                <InputNumber
                                    min={0.01}
                                    step={0.1}
                                    style={{ width: '100%', fontWeight: 600, color: '#722ed1' }}
                                    value={btp.output_quantity}
                                    onChange={val => handleUpdateBtp(btpIndex, 'output_quantity', Number(val || 0))}
                                />
                            </Col>

                            <Col xs={12} sm={6} md={4}>
                                <label style={{ fontSize: 12, color: '#666', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                                    Đơn vị tính:
                                </label>
                                <Select
                                    style={{ width: '100%' }}
                                    value={btp.unit || 'm'}
                                    onChange={val => handleUpdateBtp(btpIndex, 'unit', val)}
                                    options={COMMON_UNITS}
                                />
                            </Col>

                            <Col xs={24} sm={24} md={24}>
                                <label style={{ fontSize: 12, color: '#722ed1', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                                    🏭 PO_GC nhận tiếp theo trong KHSX (Hoặc Xưởng / NGC đích):
                                </label>
                                <Select
                                    showSearch
                                    allowClear
                                    placeholder="Chọn PO Gia công tiếp theo hoặc NCC nhận BTP..."
                                    style={{ width: '100%' }}
                                    value={btp.target_po_id ? `PO_${btp.target_po_id}` : (btp.target_vendor_id ? `SUPP_${btp.target_vendor_id}` : undefined)}
                                    onChange={(val) => {
                                        setBtpList(prev => {
                                            const newList = [...prev];
                                            if (!newList[btpIndex]) return prev;
                                            if (!val) {
                                                newList[btpIndex].target_po_id = null;
                                                newList[btpIndex].target_po_code = '';
                                                newList[btpIndex].target_vendor_id = null;
                                                newList[btpIndex].target_vendor_name = '';
                                                return newList;
                                            }
                                            const strVal = String(val);
                                            if (strVal.startsWith('PO_')) {
                                                const poId = Number(strVal.replace('PO_', ''));
                                                const foundPo = siblingPOs.find(p => Number(p.id) === poId);
                                                newList[btpIndex].target_po_id = poId;
                                                newList[btpIndex].target_po_code = foundPo?.po_code || '';
                                                newList[btpIndex].target_vendor_id = foundPo?.supplier_id || foundPo?.supplier?.id || null;
                                                newList[btpIndex].target_vendor_name = foundPo?.supplier?.name || foundPo?.supplier_name || '';
                                            } else if (strVal.startsWith('SUPP_')) {
                                                const suppId = Number(strVal.replace('SUPP_', ''));
                                                const foundSupp = suppliers.find(s => Number(s.id) === suppId);
                                                newList[btpIndex].target_po_id = null;
                                                newList[btpIndex].target_po_code = '';
                                                newList[btpIndex].target_vendor_id = suppId;
                                                newList[btpIndex].target_vendor_name = foundSupp?.name || '';
                                            }
                                            return newList;
                                        });
                                    }}
                                    options={[
                                        ...(siblingPOs.length > 0 ? [{
                                            label: '--- Các PO Gia Công Khác Trong KHSX ---',
                                            options: siblingPOs.map(p => ({
                                                label: formatPoOptionLabel(p),
                                                value: `PO_${p.id}`
                                            }))
                                        }] : []),
                                        {
                                            label: '--- Hoặc Chọn Trực Tiếp Nhà Gia Công ---',
                                            options: suppliers.map(s => ({
                                                label: `🏢 ${s.name}`,
                                                value: `SUPP_${s.id}`
                                            }))
                                        }
                                    ]}
                                    optionFilterProp="label"
                                />
                            </Col>
                        </Row>

                        {/* 2. Visual Recipe Formula Preview Box */}
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
                            {btp.product_name && (
                                <Tag color="geekblue" style={{ margin: 0, fontWeight: 600 }}>
                                    🎯 Cho: {btp.product_name}
                                </Tag>
                            )}
                            {(btp.target_po_code || btp.target_vendor_name) && (
                                <>
                                    <ArrowRightOutlined style={{ color: '#13c2c2', fontSize: 16 }} />
                                    <Tag color="cyan" style={{ margin: 0, fontWeight: 600 }}>
                                        Xuất sang: {btp.target_po_code ? `${btp.target_po_code} — ` : ''}{btp.target_vendor_name}
                                    </Tag>
                                </>
                            )}
                        </div>

                        {/* 3. Bảng Thành Phần NPL Đầu Vào */}
                        <div style={{ marginTop: 14 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <span style={{ fontWeight: 600, fontSize: 13, color: '#333' }}>
                                    📦 Thành phần NPL phối trộn đầu vào ({btp.components?.length || 0}):
                                </span>
                                <Space size={8}>
                                    {availableMaterials.length > 0 && (
                                        <Button 
                                            size="small" 
                                            type="link" 
                                            icon={<CheckCircleOutlined />} 
                                            onClick={() => handleAutoSuggestFromMaterials(btpIndex)}
                                            style={{ color: '#52c41a' }}
                                        >
                                            Gợi ý từ NPL Kế hoạch
                                        </Button>
                                    )}
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
                                                allowClear
                                                placeholder="Chọn NPL từ PO hoặc nhập tên..."
                                                style={{ width: '100%' }}
                                                value={r.material_id || r.material_name || undefined}
                                                onChange={(val) => {
                                                    const foundMat = availableMaterials.find(m => m.material_id === val);
                                                    if (foundMat) {
                                                        handleUpdateComponent(btpIndex, compIdx, 'material_id', foundMat.material_id);
                                                    } else {
                                                        handleUpdateComponent(btpIndex, compIdx, 'material_name', val);
                                                    }
                                                }}
                                                options={availableMaterials.map(m => ({
                                                    label: `${m.code ? `[${m.code}] ` : ''}${m.name} (${m.quantity || 0} ${m.unit || ''})`,
                                                    value: m.material_id || m.name
                                                }))}
                                                optionFilterProp="label"
                                            />
                                        )
                                    },
                                    {
                                        title: 'Số lượng tiêu hao',
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
                                        title: 'ĐVT',
                                        width: 110,
                                        render: (r: BtpComponent, _: any, compIdx: number) => (
                                            <Select
                                                style={{ width: '100%' }}
                                                value={r.unit || 'm'}
                                                onChange={val => handleUpdateComponent(btpIndex, compIdx, 'unit', val)}
                                                options={COMMON_UNITS}
                                            />
                                        )
                                    },
                                    {
                                        title: 'Ghi chú / Vị trí',
                                        render: (r: BtpComponent, _: any, compIdx: number) => (
                                            <Input
                                                placeholder="Vd: Mặt trước, Mặt sau, Lớp lót giữa..."
                                                value={r.note}
                                                onChange={e => handleUpdateComponent(btpIndex, compIdx, 'note', e.target.value)}
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

export default POBtpTab;
