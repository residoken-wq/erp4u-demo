import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Card, Tabs, Space, Tooltip, Popconfirm, message, Modal, Descriptions, Divider, Input, Statistic, Row, Col, InputNumber, Select, DatePicker, Form, Alert, AutoComplete, Checkbox } from 'antd';
import { ReloadOutlined, EyeOutlined, DeleteOutlined, SendOutlined, CheckCircleOutlined, ShopOutlined, ScissorOutlined, PrinterOutlined, SearchOutlined, DollarOutlined, CarOutlined, LinkOutlined, ImportOutlined, FileExcelOutlined } from '@ant-design/icons';
import api from '../utils/api';
import dayjs from 'dayjs';
import useMobile from '../hooks/useMobile';
import OutsourcingMaterialIssueModal from '../components/purchasing/OutsourcingMaterialIssueModal';
import POPayments from '../components/purchasing/POPayments';
import POBtpTab from '../components/purchasing/POBtpTab';
import { handlePrintPO } from '../utils/printPurchasingTemplate';
import { exportPOToExcel } from '../utils/exportPOToExcel';

const { RangePicker } = DatePicker;

const PurchasingPage: React.FC = () => {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('ALL');
    const [searchText, setSearchText] = useState('');
    const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
    const [hideDelivered, setHideDelivered] = useState<boolean>(true);
    const isMobile = useMobile();

    // Detail Modal State
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [currentPO, setCurrentPO] = useState<any>(null);
    const [editingItems, setEditingItems] = useState<any[]>([]);

    const [packingList, setPackingList] = useState<any[]>([]); // Matrix data
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false); // Print Selection Modal
    const [planProducts, setPlanProducts] = useState<any[]>([]); // Products in related Plan
    const [planSearchText, setPlanSearchText] = useState('');
    const [products, setProducts] = useState<any[]>([]); // All Products for Relinking
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [companyConfig, setCompanyConfig] = useState<any>(null);

    // --- MỚI: Print Designs ---
    const [printDesigns, setPrintDesigns] = useState<any[]>([]);

    // Delivery Matrix State
    const [deliveryMatrix, setDeliveryMatrix] = useState<any[]>([]);
    const [isDeliveryLoading, setIsDeliveryLoading] = useState(false);



    // --- MỚI: Modal Xuất Kho NPL Gia Công ---
    const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
    const [issueModalPO, setIssueModalPO] = useState<any>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/purchasing`);
            setData(Array.isArray(res.data) ? res.data : []);
        } catch (e) { message.error('Lỗi tải dữ liệu PO'); }
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
        api.get(`/products`).then(res => setProducts(res.data)).catch(console.error);
        api.get(`/suppliers`).then(res => setSuppliers(res.data)).catch(console.error);
        api.get(`/projects`).then(res => setProjects(res.data)).catch(console.error);
        api.get(`/system/company`).then(res => setCompanyConfig(res.data)).catch(console.error);
        api.get(`/designs/print-designs`).then(res => setPrintDesigns(res.data)).catch(console.error);
    }, []);

    const handleStatusChange = async (id: number, status: string) => {
        try {
            await api.put(`/purchasing/${id}/status`, { status });
            message.success('Cập nhật trạng thái thành công');
            fetchData();
            if (currentPO && currentPO.id === id) setCurrentPO({ ...currentPO, status });
        } catch (e) { message.error('Lỗi cập nhật'); }
    };

    const handleDelete = async (id: number) => {
        try {
            await api.delete(`/purchasing/${id}`);
            message.success('Đã xóa PO');
            fetchData();
        } catch (e) { message.error('Lỗi xóa PO'); }
    };

    const handleBatchDelete = async (ids: number[]) => {
        try {
            const res = await api.post(`/purchasing/batch-delete`, { ids });
            message.success(`Đã xóa ${res.data?.deletedCount || 0} PO (DRAFT)`);
            setSelectedMainRows([]);
            setSelectedReqs([]);
            fetchData();
            if (activeTab.startsWith('REQ')) fetchRequirements();
        } catch (e) { message.error('Lỗi xóa PO'); }
    };

    // Helper function tìm item NPL tương ứng trong editingItems một cách chính xác
    const findMatchingPOItem = (items: any[], row: any) => {
        if (!items || !row) return null;
        const rName = (row.material_name || '').trim().toLowerCase();
        const rId = row.material_id;
        return items.find((i: any) => {
            const iId = i.material_id || i.material?.id;
            if (rId && iId && Number(rId) === Number(iId)) return true;
            const iName = (i.material?.name || i.description || i.reference_name || i.sku || '').trim().toLowerCase();
            return iName && (iName === rName || (rName && (iName.includes(rName) || rName.includes(iName))));
        });
    };

    // Helper function đồng bộ Packing List với tất cả Items trong PO (Đơn thường & PO Gộp)
    const buildSyncedPackingList = (
        savedPacking: any[] | undefined,
        items: any[],
        childAggregatedPacking?: any[],
        isPooled?: boolean
    ) => {
        // Helper gộp các item trùng vật tư bằng cách cộng dồn các thông số đóng gói
        const aggregateArray = (list: any[]) => {
            const map = new Map<string, any>();
            (list || []).forEach((p: any, idx: number) => {
                const nameKey = (p.material_name || '').trim().toLowerCase();
                const idKey = p.material_id ? `id-${p.material_id}` : null;
                const primaryKey = idKey || nameKey;
                if (!primaryKey) return;

                let existing = (idKey && map.get(idKey)) || (nameKey && map.get(nameKey));
                if (!existing) {
                    existing = {
                        ...p,
                        id: p.id || (Date.now() + idx),
                        material_name: p.material_name,
                        material_id: p.material_id || null,
                        n1: p.n1 ? String(p.n1) : '',
                        n2: p.n2 ? String(p.n2) : '',
                        c1: p.c1 ? String(p.c1) : '',
                        c2: p.c2 ? String(p.c2) : '',
                        g1: p.g1 ? String(p.g1) : '',
                        g2: p.g2 ? String(p.g2) : '',
                        odd: p.odd ? String(p.odd) : '',
                        border: p.border ? String(p.border) : '',
                        note: p.note || ''
                    };
                    if (idKey) map.set(idKey, existing);
                    if (nameKey) map.set(nameKey, existing);
                } else {
                    if (p.n1) existing.n1 = String((Number(existing.n1) || 0) + Number(p.n1));
                    if (p.n2) existing.n2 = String((Number(existing.n2) || 0) + Number(p.n2));
                    if (p.c1) existing.c1 = String((Number(existing.c1) || 0) + Number(p.c1));
                    if (p.c2) existing.c2 = String((Number(existing.c2) || 0) + Number(p.c2));
                    if (p.g1) existing.g1 = String((Number(existing.g1) || 0) + Number(p.g1));
                    if (p.g2) existing.g2 = String((Number(existing.g2) || 0) + Number(p.g2));
                    if (p.odd) existing.odd = String((Number(existing.odd) || 0) + Number(p.odd));
                    if (p.border) existing.border = String((Number(existing.border) || 0) + Number(p.border));
                    if (p.note && (!existing.note || !existing.note.includes(p.note))) {
                        existing.note = existing.note ? `${existing.note}; ${p.note}` : p.note;
                    }
                }
            });
            return map;
        };

        const savedMap = aggregateArray(savedPacking || []);
        const childMap = aggregateArray(childAggregatedPacking || []);

        return (items || []).map((item: any, idx: number) => {
            const matName = (item.material?.name || item.description || item.reference_name || item.sku || '-').trim();
            const matId = item.material_id || item.material?.id || null;
            const nameKey = matName.toLowerCase();
            const idKey = matId ? `id-${matId}` : null;

            const saved = (idKey && savedMap.get(idKey)) || (nameKey && savedMap.get(nameKey));
            const child = (idKey && childMap.get(idKey)) || (nameKey && childMap.get(nameKey));

            // Đối với PO Gộp, ưu tiên childMap (tổng hợp đầy đủ từ tất cả PO con) nếu có
            const source = isPooled ? (child || saved) : (saved || child);

            if (source) {
                return {
                    ...source,
                    id: source.id || (Date.now() + idx),
                    po_form_code: source.po_form_code !== undefined ? source.po_form_code : (idx + 1),
                    material_name: matName || source.material_name,
                    material_id: matId || source.material_id,
                    quantity: item.quantity !== undefined ? item.quantity : source.quantity
                };
            } else {
                return {
                    id: Date.now() + idx,
                    po_form_code: idx + 1,
                    material_name: matName,
                    material_id: matId,
                    quantity: item.quantity,
                    n1: '', n2: '', c1: '', c2: '', g1: '', g2: '', odd: '', border: '', note: ''
                };
            }
        });
    };

    // --- HÀM TẢI THÔNG TIN SẢN PHẨM & ĐỊNH MỨC NPL TỪ KẾ HOẠCH (PFO) ---
    const loadPlanProductsData = async (pfoIds: number[], targetMaterialIds: Set<number>, targetMaterialNames: Set<string>) => {
        if (!pfoIds || pfoIds.length === 0) return [];
        try {
            const prods = new Map<string, any>();

            const addProductToMap = (product: any, qty: number) => {
                if (!product) return;
                const isCombo = product.product_type === 'COMBO' || (product.components && product.components.length > 0);

                if (isCombo && product.components && product.components.length > 0) {
                    product.components.forEach((comp: any) => {
                        if (comp.child_product) {
                            addProductToMap(comp.child_product, qty * Number(comp.quantity || 1));
                        }
                    });
                } else {
                    const sku = product.sku || product.name;
                    if (!prods.has(sku)) {
                        prods.set(sku, {
                            sku: product.sku || sku,
                            name: product.name || sku,
                            quantity: 0,
                            product: product
                        });
                    }
                    const p = prods.get(sku);
                    p.quantity += Number(qty || 0);
                }
            };

            for (const pfoId of pfoIds) {
                let pfoData: any = null;
                try {
                    const res = await api.get(`/planning/pfo/${pfoId}`);
                    pfoData = res.data;
                } catch (e) {
                    try {
                        const res = await api.get(`/planning/${pfoId}`);
                        pfoData = res.data;
                    } catch (err) {
                        console.error('Error fetching PFO', pfoId, err);
                    }
                }

                if (pfoData) {
                    // Trích xuất Sales Orders
                    const salesOrders = Array.isArray(pfoData.sales_orders)
                        ? pfoData.sales_orders
                        : (pfoData.sales_order ? [pfoData.sales_order] : []);

                    salesOrders.forEach((so: any) => {
                        const itemsList = so.items || [];
                        itemsList.forEach((soItem: any) => {
                            let prod = soItem.product;
                            if (!prod && soItem.sku && products.length > 0) {
                                prod = products.find(p => p.sku === soItem.sku);
                            }
                            if (prod) {
                                addProductToMap(prod, Number(soItem.quantity || 0));
                            } else {
                                const sku = soItem.sku || soItem.product_name || 'SP';
                                if (!prods.has(sku)) {
                                    prods.set(sku, {
                                        sku: soItem.sku || sku,
                                        name: soItem.product_name || soItem.name || sku,
                                        quantity: 0,
                                        product: null
                                    });
                                }
                                prods.get(sku).quantity += Number(soItem.quantity || 0);
                            }
                        });
                    });
                }
            }

            // Tính toán định mức BOM NPL cho từng sản phẩm
            const finalProducts = Array.from(prods.values()).map((p: any) => {
                let unitNorm = 0;
                let materials: any[] = [];
                const prodObj = p.product || products.find(prod => prod.sku === p.sku);

                if (prodObj && prodObj.boms && Array.isArray(prodObj.boms)) {
                    prodObj.boms.forEach((bom: any) => {
                        const matId = Number(bom.material?.id || bom.material_id || 0);
                        const matName = (bom.material?.name || '').toLowerCase().trim();
                        const matCode = bom.material?.code || bom.material_code || '';

                        const isMatch = targetMaterialIds.size === 0 || 
                            targetMaterialIds.has(matId) || 
                            (matName && targetMaterialNames.has(matName));

                        if (isMatch) {
                            const qty = Number(bom.quantity || 0);
                            unitNorm += qty;
                            materials.push({
                                key: bom.id || `${p.sku}-${matId || matName}`,
                                material_name: bom.material?.name || bom.material_name || matName || 'NPL',
                                material_code: matCode,
                                unit_norm: qty,
                                total_norm: qty * Number(p.quantity || 0)
                            });
                        }
                    });
                }

                return {
                    ...p,
                    unit_norm: unitNorm > 0 ? unitNorm : 0,
                    total_norm: (unitNorm > 0 ? unitNorm : 0) * Number(p.quantity || 0),
                    materials
                };
            });

            return finalProducts;
        } catch (err) {
            console.error('Error in loadPlanProductsData:', err);
            return [];
        }
    };

    const viewDetail = async (record: any) => {
        try {
            // Gọi API để lấy data enriched thay vì dùng record từ list
            const res = await api.get(`/purchasing/${record.id}`);
            const poDetail = res.data;

            setCurrentPO(poDetail);

            // --- POOLED PO: Lấy dữ liệu gộp từ child POs ---
            if (poDetail.type === 'POOLED') {
                let aggData: any = null;
                try {
                    const aggRes = await api.get(`/purchasing/pooled/${poDetail.id}/aggregate`);
                    aggData = aggRes.data;
                    const aggItems = (aggData.aggregated_items || []).map((item: any, idx: number) => ({
                        id: `agg-${idx}`,
                        material: item.material_id ? { 
                            id: item.material_id, 
                            name: item.material_name, 
                            code: item.material_code, 
                            unit: item.unit,
                            conversion_factor: item.conversion_factor,
                            purchase_unit: item.purchase_unit
                        } : null,
                        material_id: item.material_id,
                        product: item.product || null,
                        product_id: item.product_id || null,
                        description: item.material_name,
                        quantity: item.total_ordered,
                        raw_quantity: item.total_ordered,
                        total_quantity: item.total_ordered,
                        unit_price: item.unit_price || 0,
                        subtotal: item.total_subtotal || (item.total_ordered * (item.unit_price || 0)),
                        note: `Từ ${item.po_sources?.length || 0} PO: ${(item.po_sources || []).join(', ')}`,
                        po_details: item.po_details || [],
                        wastage_rate: 0,
                    }));
                    setEditingItems(aggItems);

                    // Đồng bộ packing list cho PO Gộp: lấy từ chính PO hoặc fallback từ các PO con
                    const syncedPacking = buildSyncedPackingList(
                        poDetail.packing_list_details,
                        aggItems,
                        aggData?.aggregated_packing_list,
                        true // isPooled
                    );
                    setPackingList(syncedPacking);
                } catch (e) {
                    console.error('Error fetching pooled aggregate', e);
                    setEditingItems([]);
                    setPackingList([]);
                }
                setIsDetailOpen(true);

                // Fetch Plan Products for pooled
                setPlanProducts([]);
                const pfoIds = new Set<number>();
                const targetMaterialIds = new Set<number>();
                const targetMaterialNames = new Set<string>();

                if (aggData && aggData.pooled_po?.child_pos) {
                    aggData.pooled_po.child_pos.forEach((child: any) => {
                        if (child.pfo_id) pfoIds.add(child.pfo_id);
                        child.items?.forEach((item: any) => {
                            if (item.pfo_id) pfoIds.add(item.pfo_id);
                            if (item.plan_id) pfoIds.add(item.plan_id);
                            if (item.material_id) targetMaterialIds.add(Number(item.material_id));
                            if (item.material?.id) targetMaterialIds.add(Number(item.material.id));
                            const name = item.material?.name || item.description || item.reference_name;
                            if (name) targetMaterialNames.add(name.toLowerCase().trim());
                        });
                    });
                }

                if (pfoIds.size > 0) {
                    const finalProds = await loadPlanProductsData(Array.from(pfoIds), targetMaterialIds, targetMaterialNames);
                    setPlanProducts(finalProds);
                }

                fetchDeliveryMatrix(poDetail.id);
                return; // Early return — skip normal items/plan logic
            }

            // Clone items for editing (Normal PO)
            const normalItems = poDetail.items ? poDetail.items.map((i: any) => ({ ...i })) : [];
            setEditingItems(normalItems);

            // Đồng bộ packing list cho Normal PO: đảm bảo luôn có đủ tất cả NPL
            const syncedPacking = buildSyncedPackingList(
                poDetail.packing_list_details,
                normalItems
            );
            setPackingList(syncedPacking);
            setIsDetailOpen(true);

            // Fetch Plan Products for Normal PO
            setPlanProducts([]);
            const pfoIds = new Set<number>();
            if (poDetail.pfo_id) pfoIds.add(poDetail.pfo_id);

            // Thu thập từ items
            if (poDetail.items && poDetail.items.length > 0) {
                poDetail.items.forEach((i: any) => {
                    if (i.pfo_id) pfoIds.add(i.pfo_id);
                    if (i.plan_id) pfoIds.add(i.plan_id);
                });
            }

            // Fallback: Tìm ID trong mã PO (VD: PO-NPL-PFO6-6446 -> PFO 6)
            if (pfoIds.size === 0 && poDetail.po_code) {
                const match = poDetail.po_code.match(/PFO(\d+)/i);
                if (match && match[1]) {
                    pfoIds.add(Number(match[1]));
                }
            }

            const targetMaterialIds = new Set<number>(
                (poDetail.items || []).map((i: any) => Number(i.material_id || i.material?.id)).filter(Boolean)
            );
            const targetMaterialNames = new Set<string>(
                (poDetail.items || []).map((i: any) => (i.material?.name || i.description || i.reference_name || '').toLowerCase().trim()).filter(Boolean)
            );

            if (pfoIds.size > 0) {
                const finalProds = await loadPlanProductsData(Array.from(pfoIds), targetMaterialIds, targetMaterialNames);
                setPlanProducts(finalProds);

                // Fallback enrich PO Items from Plan Products nếu bị thiếu
                const newEditingItems = (poDetail.items || []).map((i: any) => ({ ...i }));
                let hasUpdate = false;
                newEditingItems.forEach((item: any) => {
                    if (!item.product && item.description) {
                        const match = item.description.match(/\(([^)]+)\)\s*$/);
                        if (match && match[1]) {
                            const sku = match[1].trim();
                            const found = finalProds.find(p => p.sku === sku);
                            if (found && found.product) {
                                item.product = found.product;
                                item.product_id = found.product.id;
                                hasUpdate = true;
                            }
                        }
                    }
                });
                if (hasUpdate) {
                    setEditingItems(newEditingItems);
                }
            }

            // Fetch Delivery Matrix Progress
            fetchDeliveryMatrix(poDetail.id);
        } catch (e) {
            message.error('Lỗi tải chi tiết PO');
            console.error('Error fetching PO detail', e);
        }
    };

    const fetchDeliveryMatrix = async (poId: number) => {
        setIsDeliveryLoading(true);
        try {
            // Fetch PO with Items and their GoodsReceiptItems
            // Since we don't have a direct endpoint for matrix progress, we calculate it 
            // by fetching all GoodsReceipts for this PO AND the PO's Packing List.
            // Simplified: We assume we can get receipts. 
            // Better: Endpoint `GET /purchasing/:id/delivery-progress` (Mocking logic here for now or assuming we fetch receipts)

            const res = await api.get(`/inventory/goods-receipt/po/${poId}`);
            const receipts = res.data; // List of receipts with items

            // We need to aggregate received quantities per Matrix Row (identified by material_name or po_form_code)
            // But GoodsReceiptItems currently store `packing_data` (Newly added).

            // Re-use current PO's packing list as base
            /* 
               Logic: 
               1. Get `packing_list_details` from PO (this is the PLAN).
               2. Iterate all Receipts -> Items -> packing_data.
               3. Sum up N1, N2... for each matching Material/Row.
            */
        } catch (e) { console.error('Error fetching delivery', e); }
        setIsDeliveryLoading(false);
    };

    const handleCreateMatrixReceipt = async () => {
        if (!currentPO) return;
        // Filter rows that have input
        const validRows = packingList.filter(r =>
            Number(r.n1_input || 0) > 0 || Number(r.n2_input || 0) > 0 ||
            Number(r.c1_input || 0) > 0 || Number(r.c2_input || 0) > 0 ||
            Number(r.g1_input || 0) > 0 || Number(r.g2_input || 0) > 0 ||
            Number(r.odd_input || 0) > 0 || Number(r.border_input || 0) > 0
        );

        if (validRows.length === 0) return message.warning('Vui lòng nhập số lượng thực nhận vào cột "Giao"');

        try {
            await api.post(`/inventory/goods-receipt/draft`, {
                po_id: currentPO.id,
                items: validRows.map(r => {
                    const poItem = findMatchingPOItem(editingItems, r);
                    const totalQty =
                        Number(r.n1_input || 0) + Number(r.n2_input || 0) +
                        Number(r.c1_input || 0) + Number(r.c2_input || 0) +
                        Number(r.g1_input || 0) + Number(r.g2_input || 0) +
                        Number(r.odd_input || 0) + Number(r.border_input || 0);

                    return {
                        po_item_id: poItem?.id,
                        material_id: poItem?.material?.id || poItem?.material_id || r.material_id,
                        quantity: totalQty,
                        packing_data: {
                            n1: Number(r.n1_input || 0), n2: Number(r.n2_input || 0),
                            c1: Number(r.c1_input || 0), c2: Number(r.c2_input || 0),
                            g1: Number(r.g1_input || 0), g2: Number(r.g2_input || 0),
                            odd: Number(r.odd_input || 0), border: Number(r.border_input || 0)
                        }
                    };
                }),
                note: `Nhập kho (Matrix) từ PO ${currentPO.po_code}`
            });
            message.success('Đã tạo phiếu nhập kho (Draft)');
            // Clear inputs or Refresh
            fetchDeliveryMatrix(currentPO.id);
        } catch (e) { message.error('Lỗi tạo phiếu nhập: ' + e); }
    };

    // ----------------------------------------

    const getCustomerName = (r: any) => {
        // Normal PO: check pfo.sales_order.customer
        const pfo = r.pfo || r.plan;
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

        // POOLED PO: aggregate customer names from child POs
        if (r.type === 'POOLED' && r.child_pos && r.child_pos.length > 0) {
            const names = new Set<string>();
            for (const child of r.child_pos) {
                const childPfo = child.pfo || child.plan;
                if (childPfo?.sales_order) {
                    const n = childPfo.sales_order.customer?.name || childPfo.sales_order.customer_name;
                    if (n) names.add(n);
                }
            }
            if (names.size > 0) return Array.from(names).join(', ');
        }
        return '-';
    };

    const columns = [
        { title: 'Mã PO', dataIndex: 'po_code', render: (t: any, r: any) => <Space><a onClick={() => viewDetail(r)}><b>{t}</b></a>{r.parent_po_id && <Tooltip title="PO này đã được gộp chung"><Tag color="purple" style={{ margin: 0, fontSize: 10, lineHeight: '16px' }}>Đã gộp</Tag></Tooltip>}</Space> },
        { title: 'Khách hàng', key: 'customer', render: (r: any) => getCustomerName(r) },
        { title: 'Loại', dataIndex: 'type', align: 'center' as const, width: 100, render: (t: string) => t === 'MATERIAL' ? <Tag color="blue">NPL</Tag> : t === 'POOLED' ? <Tag color="purple">Gộp</Tag> : <Tag color="orange">Gia công</Tag> },
        { title: 'Ngày', dataIndex: 'created_at', render: (t: any) => dayjs(t).format('DD/MM/YYYY') },
        { title: 'Đối tác', dataIndex: 'supplier', render: (s: any, r: any) => s?.name || (r.note?.split('NCC: ')[1] || '-') },
        { title: 'Tổng tiền', dataIndex: 'total_amount', align: 'right' as const, render: (v: number) => <b>{Number(v).toLocaleString()}</b> },
        { title: 'Trạng thái', dataIndex: 'status', align: 'center' as const, render: (t: string) => <Tag color={t === 'COMPLETED' ? 'green' : t === 'DELIVERED' ? 'cyan' : t === 'PARTIAL_DELIVERED' ? 'orange' : t === 'ORDERED' ? 'geekblue' : t === 'SENT' ? 'blue' : t === 'CONFIRMED' ? 'purple' : 'default'}>{t === 'DELIVERED' ? 'Đã giao đủ' : t === 'PARTIAL_DELIVERED' ? 'Giao 1 phần' : t === 'ORDERED' ? 'Đã đặt' : t === 'CONFIRMED' ? 'Đã xác nhận' : t === 'SENT' ? 'Đã gửi' : t === 'COMPLETED' ? 'Hoàn thành' : t}</Tag> },
        {
            title: '', key: 'act', align: 'right' as const,
            render: (r: any) => (
                <Space>
                    {r.type === 'OUTSOURCING' && (<Tooltip title="Xuất Kho NPL"><Button size="small" style={{ color: '#fa8c16', borderColor: '#fa8c16' }} icon={<CarOutlined />} onClick={() => { setIssueModalPO(r); setIsIssueModalOpen(true); }} /></Tooltip>)}
                    <Tooltip title="Xem"><Button size="small" icon={<EyeOutlined />} onClick={() => viewDetail(r)} /></Tooltip>
                    {r.status === 'DRAFT' && (<Popconfirm title="Xóa?" onConfirm={() => handleDelete(r.id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>)}
                </Space>
            )
        }
    ];

    const filteredData = data.filter((d: any) => {
        const tabMatch = activeTab === 'ALL' || d.type === activeTab;
        if (!tabMatch) return false;

        if (dateRange && dateRange.length === 2) {
            const poDate = dayjs(d.created_at || d.order_date);
            if (poDate.isBefore(dateRange[0], 'day') || poDate.isAfter(dateRange[1], 'day')) {
                return false;
            }
        }

        if (hideDelivered && (activeTab === 'MATERIAL' || activeTab === 'OUTSOURCING')) {
            if (d.status === 'DELIVERED') return false;
        }

        if (!searchText) return true;
        const q = searchText.toLowerCase();
        const poMatch = d.po_code?.toLowerCase().includes(q);
        const supplierMatch = (d.supplier?.name || d.note?.split('NCC: ')[1] || '').toLowerCase().includes(q);
        const customerNames = getCustomerName(d);
        const customerMatch = customerNames.toLowerCase().includes(q);
        return poMatch || supplierMatch || customerMatch;
    });

    // --- LOGIC REQUIREMENT (PO GỘP) ---
    const [requirements, setRequirements] = useState<any[]>([]);
    const [selectedReqs, setSelectedReqs] = useState<any[]>([]);
    const [selectedMainRows, setSelectedMainRows] = useState<any[]>([]); // Chọn PO trên tab chính để gộp

    const filteredRequirements = requirements.filter((r: any) => {
        if (!searchText) return true;
        const q = searchText.toLowerCase();
        const poMatch = r.po_code?.toLowerCase().includes(q);
        const supplierMatch = (r.supplier?.name || r.note?.split('NCC: ')[1] || '').toLowerCase().includes(q);
        const customerNames = getCustomerName(r);
        const customerMatch = customerNames.toLowerCase().includes(q);
        return poMatch || supplierMatch || customerMatch;
    });

    const fetchRequirements = async () => {
        try {
            // Lấy danh sách PO có thể gộp (chưa có parent_po_id, status=DRAFT)
            const type = (activeTab === 'REQ_GC' || activeTab === 'OUTSOURCING') ? 'OUTSOURCING' : 'MATERIAL';
            const res = await api.get(`/purchasing/available-for-pooling?type=${type}`);
            setRequirements(res.data);
        } catch (e) { message.error('Lỗi tải danh sách PO'); }
    };

    useEffect(() => {
        if (activeTab.startsWith('REQ')) fetchRequirements();
        // Reset selection khi đổi tab
        setSelectedMainRows([]);
        setSelectedReqs([]);
    }, [activeTab]);

    const handleCreatePooledPO = async () => {
        // Hỗ trợ gộp từ cả tab chính (MATERIAL/OUTSOURCING) lẫn tab REQ
        const selected = (activeTab === 'MATERIAL' || activeTab === 'OUTSOURCING') ? selectedMainRows : selectedReqs;
        if (selected.length === 0) return message.warning('Chọn ít nhất 1 PO để gộp');
        // Check types
        const types = new Set(selected.map(r => r.type));
        if (types.size > 1) return message.error('Không thể gộp NPL và Gia công chung 1 đơn');

        // Check all selected are DRAFT
        const nonDraft = selected.filter(r => r.status !== 'DRAFT');
        if (nonDraft.length > 0) return message.error(`Chỉ gộp được PO ở trạng thái DRAFT. Có ${nonDraft.length} PO không hợp lệ.`);

        // Temporarily store selected for proceedCreatePooled
        setSelectedReqs(selected);

        // Check vendors (Optional warning)
        const supplierNames = [...new Set(selected.map(r => r.supplier?.name).filter(Boolean))];
        if (supplierNames.length > 1) {
            Modal.confirm({
                title: 'Khác Nhà Cung Cấp',
                content: `Các PO đã chọn thuộc nhiều NCC khác nhau (${supplierNames.join(', ')}). Bạn có chắc muốn gộp chung?`,
                onOk: () => setIsSelectSupplierOpen(true)
            });
        } else {
            setIsSelectSupplierOpen(true);
        }
    };

    // Auxiliary state for selecting supplier
    const [isSelectSupplierOpen, setIsSelectSupplierOpen] = useState(false);
    const [targetSupplierId, setTargetSupplierId] = useState<number | null>(null);
    // const [suppliers, setSuppliers] = useState<any[]>([]); // REMOVED DUPLICATE

    // useEffect(() => {
    //     axios.get(`${API_URL}/suppliers`).then(res => setSuppliers(res.data));
    // }, []);

    const proceedCreatePooled = async (supId: number | null) => {
        try {
            await api.post(`/purchasing/create-pooled`, {
                supplier_id: supId,
                child_po_ids: selectedReqs.map(r => r.id)  // FIX: Đổi tên field
            });
            message.success('Gộp PO thành công!');
            setIsSelectSupplierOpen(false);
            setSelectedReqs([]);
            fetchRequirements(); // Refresh list
            fetchData(); // Refresh main list
        } catch (e) { message.error('Lỗi gộp PO'); }
    }

    const handleSavePOChanges = async () => {
        const isPooled = currentPO?.type === 'POOLED';
        try {
            await api.put(`/purchasing/${currentPO.id}`, {
                items: isPooled ? undefined : editingItems, // FIX: POOLED PO không có items riêng
                packing_list_details: packingList,
                supplier_id: currentPO.supplier?.id, // Include Supplier ID
                project_id: currentPO.project_id, // Include project
                task_id: currentPO.task_id, // Include task
                status: currentPO.status,
                note: currentPO.note,
                vat_rate: currentPO.vat_rate
            });
            message.success('Đã lưu thay đổi PO');
            fetchData(); // Refresh global list
            fetchRequirements(); // Refresh requirements list
            
            // Update local currentPO to reflect changes safely
            const updatedPO = { ...currentPO, items: editingItems, packing_list_details: packingList };
            // Recalc total
            const newTotal = editingItems.reduce((acc, i) => acc + Number(i.subtotal || 0), 0);
            const vatRate = Number(currentPO.vat_rate || 0);
            const finalTotal = newTotal * (1 + vatRate / 100);
            
            updatedPO.total_amount = finalTotal;
            setCurrentPO(updatedPO);
        } catch (e) { message.error('Lỗi lưu PO'); }
    };

    const handleCreateReceipt = async () => {
        if (!currentPO) return;
        
        let receiptItems = [];

        // Ưu tiên nhập kho Bán Thành Phẩm nếu PO là loại Gia Công và có cấu hình BTP
        if (currentPO.type === 'OUTSOURCING' && currentPO.semi_finished_products) {
            let btpList = [];
            try {
                btpList = typeof currentPO.semi_finished_products === 'string' 
                    ? JSON.parse(currentPO.semi_finished_products) 
                    : currentPO.semi_finished_products;
            } catch (e) {}

            if (Array.isArray(btpList) && btpList.length > 0) {
                receiptItems = btpList.map((btp: any) => ({
                    product_id: btp.product_id,
                    quantity: btp.output_quantity !== undefined ? btp.output_quantity : (btp.quantity || 1)
                }));
            }
        }

        // Nếu không có BTP, thì lấy theo danh sách items của PO
        if (receiptItems.length === 0) {
            const items = editingItems?.length > 0 ? editingItems : (currentPO.items || []);
            if (items.length === 0) return message.warning('Không có hàng hóa nào');
            
            receiptItems = items.map((i: any) => ({
                po_item_id: i.id,
                material_id: i.material?.id || i.material_id,
                product_id: i.product?.id || i.product_id,
                quantity: i.quantity
            }));
        }

        try {
            await api.post(`/inventory/goods-receipt/draft`, {
                po_id: currentPO.id,
                items: receiptItems,
                note: `Nhập kho từ PO ${currentPO.po_code}`
            });
            message.success('Đã tạo phiếu nhập kho nháp');
            setIsDetailOpen(false);
        } catch (error) {
            message.error('Lỗi tạo phiếu nhập kho');
        }
    };

    const handlePrint = (template: string, showPrice = true) => {
        const printData = {
            ...currentPO,
            items: currentPO?.type === 'POOLED' ? editingItems : (currentPO?.items || editingItems)
        };
        handlePrintPO(printData, packingList, template, showPrice, companyConfig);
    };

    // ----------------------------------
    const expandedRowRender = (record: any) => {
        if (!record.items || record.items.length === 0) return <div style={{ color: '#888', padding: '10px 20px' }}>Không có chi tiết hàng hóa</div>;
        
        const itemColumns = [
            { title: 'Tên hàng / Mô tả', render: (r: any) => r.material?.name || r.product?.name || r.description || '-' },
            ...(record.type === 'OUTSOURCING' ? [
                { title: 'Màu MT', render: (r: any) => r.product?.attributes?.front_color || '-' },
                { title: 'Màu MS', render: (r: any) => r.product?.attributes?.back_color || '-' }
            ] : []),
            ...(record.type === 'MATERIAL' ? [
                { title: 'Màu vải MT', render: (r: any) => r.front_color || '-' },
                { title: 'Màu vải MS', render: (r: any) => r.back_color || '-' }
            ] : []),
            { 
                title: 'Số lượng (Gốc)', 
                dataIndex: 'quantity', 
                align: 'center' as const, 
                render: (v: number, r: any) => `${Number(v || 0).toLocaleString()} ${r.material?.unit || ''}` 
            },
            { 
                title: 'SL Quy Đổi (Mua)', 
                align: 'center' as const, 
                render: (r: any) => {
                    const factor = r.material ? Number(r.material.conversion_factor || 1) : 1;
                    const unit = r.material ? r.material.purchase_unit : '';
                    const val = factor > 1 ? (r.quantity || 0) / factor : (r.quantity || 0);
                    return r.material && factor > 1 && unit ? `${Number(val.toFixed(2)).toLocaleString()} ${unit}` : '-';
                }
            },
            { title: 'Đơn giá (Gốc)', dataIndex: 'unit_price', align: 'right' as const, render: (v: number) => Number(v || 0).toLocaleString() },
            { title: 'Thành tiền', align: 'right' as const, render: (r: any) => <b>{Number((r.quantity || 0) * (r.unit_price || 0)).toLocaleString()}</b> }
        ];

        return (
            <Table
                columns={itemColumns}
                dataSource={record.items}
                pagination={false}
                size="small"
                rowKey="id"
                style={{ margin: '10px 0', backgroundColor: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 4, padding: '10px 20px' }}
            />
        );
    };

    const uniqueFrontColors = Array.from(new Set(products.map(p => {
        let attr = p.attributes;
        if (typeof attr === 'string') {
            try { attr = JSON.parse(attr); } catch (e) { attr = {}; }
        }
        return attr?.front_color;
    }).filter(Boolean)));
    
    const uniqueBackColors = Array.from(new Set(products.map(p => {
        let attr = p.attributes;
        if (typeof attr === 'string') {
            try { attr = JSON.parse(attr); } catch (e) { attr = {}; }
        }
        return attr?.back_color;
    }).filter(Boolean)));

    return (
        <div>
            <Card
                bodyStyle={{ padding: isMobile ? '8px 12px' : undefined }}
                title={<span style={{ fontSize: isMobile ? 14 : 16 }}>Mua Hàng</span>}
                extra={
                    isMobile ? (
                        <Space size={4}>
                            <Input prefix={<SearchOutlined />} placeholder="Tìm..." value={searchText} onChange={e => setSearchText(e.target.value)} style={{ width: 100 }} allowClear />
                            <Button icon={<ReloadOutlined />} onClick={() => activeTab.startsWith('REQ') ? fetchRequirements() : fetchData()} />
                        </Space>
                    ) : (
                        <Space>
                            {(activeTab === 'REQ_NPL' || activeTab === 'REQ_GC') && <Button type="primary" onClick={handleCreatePooledPO} disabled={selectedReqs.length === 0}>+ Tạo PO Gộp ({selectedReqs.length})</Button>}
                            {(activeTab === 'MATERIAL' || activeTab === 'OUTSOURCING') && <Button type="primary" onClick={handleCreatePooledPO} disabled={selectedMainRows.length === 0} icon={<LinkOutlined />}>Gộp PO ({selectedMainRows.length})</Button>}
                            {(activeTab === 'MATERIAL' || activeTab === 'OUTSOURCING') && selectedMainRows.length > 0 && (
                                <Popconfirm title={`Xóa ${selectedMainRows.length} PO đã chọn?`} onConfirm={() => handleBatchDelete(selectedMainRows.map(r => r.id))}>
                                    <Button danger icon={<DeleteOutlined />}>Xóa PO ({selectedMainRows.length})</Button>
                                </Popconfirm>
                            )}
                            {activeTab === 'POOLED' && <Popconfirm title="Xóa tất cả PO Gộp?" onConfirm={async () => {
                                await api.delete(`/purchasing/pooled/all`);
                                message.success('Đã xóa dữ liệu gộp');
                                fetchData();
                            }}><Button danger>Xóa Data Gộp (Test)</Button></Popconfirm>}
                            <RangePicker onChange={(dates) => setDateRange(dates as any)} format="DD/MM/YYYY" allowClear style={{ width: 220 }} />
                            <Input prefix={<SearchOutlined />} placeholder="Tìm PO..." value={searchText} onChange={e => setSearchText(e.target.value)} style={{ width: 160 }} allowClear />
                            <Button icon={<ReloadOutlined />} onClick={() => activeTab.startsWith('REQ') ? fetchRequirements() : fetchData()}>Làm mới</Button>
                        </Space>
                    )
                }
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Tabs activeKey={activeTab} onChange={setActiveTab} size={isMobile ? 'small' : 'middle'} items={[
                        { key: 'ALL', label: isMobile ? 'Tất cả' : 'Tất cả PO' },
                        { key: 'MATERIAL', label: isMobile ? 'NPL' : 'Mua NPL' },
                        { key: 'OUTSOURCING', label: isMobile ? 'GC' : 'Gia Công' },
                        { key: 'POOLED', label: isMobile ? 'Gộp' : 'PO Gộp' },
                        { key: 'REQ_NPL', label: isMobile ? 'NC NPL' : 'Tổng Hợp Nhu Cầu NPL' },
                        { key: 'REQ_GC', label: isMobile ? 'NC GC' : 'Tổng Hợp Nhu Cầu GC' }
                    ]} />
                    {(activeTab === 'MATERIAL' || activeTab === 'OUTSOURCING') && (
                        <div style={{ marginBottom: 16 }}>
                            <Checkbox checked={hideDelivered} onChange={(e) => setHideDelivered(e.target.checked)}>Ẩn PO đã giao đủ</Checkbox>
                        </div>
                    )}
                </div>

                {(activeTab === 'REQ_NPL' || activeTab === 'REQ_GC') ? (
                    (() => {
                        const supplierGroups: Record<string, any[]> = {};
                        let totalOverallAmount = 0;
                        filteredRequirements.forEach(d => {
                            const supplierName = d.supplier?.name || (d.note?.split('NCC: ')[1]) || 'Chưa chỉ định NCC';
                            if (!supplierGroups[supplierName]) supplierGroups[supplierName] = [];
                            supplierGroups[supplierName].push(d);
                            totalOverallAmount += (Number(d.total_amount) || 0);
                        });
                        const sortedSuppliers = Object.keys(supplierGroups).sort((a, b) => {
                            if (a === 'Chưa chỉ định NCC') return 1;
                            if (b === 'Chưa chỉ định NCC') return -1;
                            return a.localeCompare(b);
                        });
                        
                        const reqColumns = [
                            { title: 'Mã PO', dataIndex: 'po_code', width: 150, render: (t: any, r: any) => <a onClick={() => viewDetail(r)}><Tag color="blue"><b>{t}</b></Tag></a> },
                            { title: 'Khách hàng', key: 'customer', render: (r: any) => getCustomerName(r) },
                            { title: 'NCC', dataIndex: 'supplier', render: (s: any) => <Tag color="purple">{s?.name || '-'}</Tag> },
                            { title: 'Số mặt hàng', width: 100, align: 'center' as const, render: (r: any) => r.items?.length || 0 },
                            { title: 'Tổng tiền', dataIndex: 'total_amount', align: 'right' as const, render: (v: number) => <b>{Number(v).toLocaleString(undefined, { style: 'currency', currency: 'VND' })}</b> },
                            { title: 'Trạng thái', dataIndex: 'status', width: 100, align: 'center' as const, render: (t: string) => <Tag color={t === 'COMPLETED' ? 'green' : t === 'DELIVERED' ? 'cyan' : t === 'PARTIAL_DELIVERED' ? 'orange' : t === 'ORDERED' ? 'blue' : 'default'}>{t === 'PARTIAL_DELIVERED' ? 'Giao 1 phần' : t === 'DELIVERED' ? 'Đã giao đủ' : t}</Tag> },
                            { title: 'Ngày tạo', dataIndex: 'created_at', width: 100, align: 'right' as const, render: (t: any) => dayjs(t).format('DD/MM/YY') }
                        ];

                        if (sortedSuppliers.length === 0) return <Alert message="Không có dữ liệu tổng hợp nhu cầu" type="info" />;
                        
                        return (
                            <div>
                                <div style={{ marginBottom: 16, fontWeight: 600, fontSize: 14, color: '#cf1322' }}>
                                    Tổng cộng tất cả: {totalOverallAmount.toLocaleString(undefined, { style: 'currency', currency: 'VND' })}
                                </div>
                                <Tabs 
                                    tabPosition="top" 
                                    size="small" 
                                    type="card" 
                                    onChange={() => setSelectedReqs([])}
                                    items={sortedSuppliers.map(supName => {
                                        const totalAmount = supplierGroups[supName].reduce((acc, curr) => acc + (Number(curr.total_amount) || 0), 0);
                                        return {
                                            key: supName,
                                            label: (
                                                <div>
                                                    <div>{supName} ({supplierGroups[supName].length})</div>
                                                    <div style={{ fontSize: 11, color: '#cf1322', marginTop: 2 }}>
                                                        {totalAmount.toLocaleString(undefined, { style: 'currency', currency: 'VND' })}
                                                    </div>
                                                </div>
                                            ),
                                            children: (
                                                <Table
                                                    dataSource={supplierGroups[supName]}
                                                    columns={reqColumns}
                                                    rowKey="id"
                                                    loading={loading}
                                                    rowSelection={{
                                                        type: 'checkbox',
                                                        selectedRowKeys: selectedReqs.map(r => r.id),
                                                        onChange: (_, rows) => setSelectedReqs(rows)
                                                    }}
                                                    expandable={{ expandedRowRender, rowExpandable: record => record.items && record.items.length > 0 }}
                                                />
                                            )
                                        };
                                    })} 
                                />
                            </div>
                        );
                    })()
                ) : (activeTab === 'MATERIAL' || activeTab === 'OUTSOURCING') ? (
                    (() => {
                        const supplierGroups: Record<string, any[]> = {};
                        filteredData.forEach(d => {
                            const supplierName = d.supplier?.name || (d.note?.split('NCC: ')[1]) || 'Chưa chỉ định NCC';
                            if (!supplierGroups[supplierName]) supplierGroups[supplierName] = [];
                            supplierGroups[supplierName].push(d);
                        });
                        const sortedSuppliers = Object.keys(supplierGroups).sort((a, b) => {
                            if (a === 'Chưa chỉ định NCC') return 1;
                            if (b === 'Chưa chỉ định NCC') return -1;
                            return a.localeCompare(b);
                        });
                        if (sortedSuppliers.length === 0) return <Alert message="Không có dữ liệu PO nào cho tab này" type="info" />;
                        return (
                            <Tabs 
                                tabPosition="top" 
                                size="small" 
                                type="card" 
                                onChange={() => setSelectedMainRows([])}
                                items={sortedSuppliers.map(supName => ({
                                key: supName,
                                label: `${supName} (${supplierGroups[supName].length})`,
                                children: (
                                    <Table
                                        dataSource={supplierGroups[supName]}
                                        columns={columns}
                                        rowKey="id"
                                        loading={loading}
                                        expandable={{ expandedRowRender, rowExpandable: record => record.items && record.items.length > 0 }}
                                        rowSelection={{
                                            type: 'checkbox',
                                            selectedRowKeys: selectedMainRows.map(r => r.id),
                                            onChange: (_, rows) => setSelectedMainRows(rows),
                                            getCheckboxProps: (record: any) => ({
                                                disabled: record.status !== 'DRAFT' || record.type === 'POOLED',
                                            }),
                                        }}
                                    />
                                )
                            }))} />
                        );
                    })()
                ) : (
                    <Table
                        dataSource={filteredData}
                        columns={columns}
                        rowKey="id"
                        loading={loading}
                        expandable={{ expandedRowRender, rowExpandable: record => record.items && record.items.length > 0 }}
                        rowSelection={undefined}
                    />
                )}
            </Card>

            <Modal title="Chọn Nhà Cung Cấp cho PO" open={isSelectSupplierOpen} onCancel={() => setIsSelectSupplierOpen(false)} onOk={() => proceedCreatePooled(targetSupplierId)}>
                <p>Bạn đang tạo PO gộp cho {selectedReqs.length} vật tư. Vui lòng chọn NCC:</p>
                <Select
                    style={{ width: '100%' }}
                    placeholder="Chọn NCC..."
                    showSearch optionFilterProp="label"
                    onChange={v => setTargetSupplierId(v)}
                    options={suppliers.map(s => ({ label: s.name, value: s.id }))}
                />
            </Modal>

            {/* MODAL DETAIL */}
            <Modal
                title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 32 }}>
                        <span>Chi tiết: {currentPO?.po_code}</span>
                        {currentPO && getCustomerName(currentPO) !== '-' && (
                            <span style={{ fontSize: 14, fontWeight: 'normal', color: '#666' }}>
                                KH: {getCustomerName(currentPO)}
                            </span>
                        )}
                    </div>
                }
                open={isDetailOpen}
                onCancel={() => setIsDetailOpen(false)}
                width={1200}
                style={{ top: 20 }}
                footer={[
                    <Button key="portal" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/portal/po/${currentPO?.uuid}`); message.success('Đã copy link Portal NCC!'); }}>🔗 Copy Link Portal</Button>,
                    <Button key="print" icon={<PrinterOutlined />} onClick={() => setIsPrintModalOpen(true)}>In PO</Button>,
                    <Button key="export" icon={<FileExcelOutlined />} onClick={() => exportPOToExcel(currentPO, editingItems, packingList)} style={{ backgroundColor: '#107c41', color: 'white' }}>Xuất Excel</Button>,
                    <Button key="receipt" icon={<ImportOutlined />} type="dashed" onClick={handleCreateReceipt}>Tạo Phiếu Kho</Button>,
                    <Button key="save" type="primary" onClick={handleSavePOChanges}>Lưu Thay Đổi</Button>,
                    <Button key="close" onClick={() => setIsDetailOpen(false)}>Đóng</Button>
                ]}
            >
                <Descriptions size="small" bordered column={2} style={{ marginBottom: 16 }}>
                    <Descriptions.Item label="NCC">
                        <Select
                            showSearch
                            style={{ width: 250 }}
                            value={currentPO?.supplier?.id}
                            onChange={(id) => setCurrentPO({ ...currentPO, supplier: { ...currentPO.supplier, id: id, name: suppliers.find(s => s.id === id)?.name } })}
                            options={suppliers.map((s: any) => ({ label: s.name, value: s.id }))}
                            optionFilterProp="label"
                        />
                    </Descriptions.Item>
                    <Descriptions.Item label="Trạng thái">
                        <Select
                            style={{ width: 150 }}
                            value={currentPO?.status || 'DRAFT'}
                            onChange={(v) => setCurrentPO({ ...currentPO, status: v })}
                            options={[
                                { value: 'DRAFT', label: 'Nháp' },
                                { value: 'SENT', label: 'Đã gửi NCC' },
                                { value: 'CONFIRMED', label: 'NCC xác nhận' },
                                { value: 'ORDERED', label: 'Đã đặt hàng' },
                                { value: 'PARTIAL_DELIVERED', label: '⚡ Giao 1 phần' },
                                { value: 'DELIVERED', label: '✅ Đã giao đủ' },
                                { value: 'COMPLETED', label: '💰 Đã thanh toán' },
                                { value: 'CANCELLED', label: '❌ Đã hủy' },
                            ]}
                        />
                    </Descriptions.Item>
                    <Descriptions.Item label="Tổng tiền">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <b style={{ fontSize: 16 }}>{Number(currentPO?.total_amount || 0).toLocaleString()} ₫</b>
                            <InputNumber 
                                size="small"
                                addonBefore="VAT %" 
                                style={{ width: 120 }} 
                                min={0} max={100} 
                                value={currentPO?.vat_rate} 
                                onChange={v => setCurrentPO({...currentPO, vat_rate: v})} 
                            />
                        </div>
                    </Descriptions.Item>
                    <Descriptions.Item label="Đã trả" contentStyle={{ color: 'green', fontWeight: 'bold' }}>{Number(currentPO?.paid_amount).toLocaleString()} ₫</Descriptions.Item>
                    <Descriptions.Item label="Còn lại" contentStyle={{ color: 'red' }}>{Number((currentPO?.total_amount || 0) - (currentPO?.paid_amount || 0)).toLocaleString()} ₫</Descriptions.Item>
                    <Descriptions.Item label="Dự án & Task" span={1}>
                        <div style={{ display: 'flex', gap: 5, flexDirection: 'column' }}>
                            <Select 
                                allowClear 
                                placeholder="Chọn dự án..." 
                                style={{ width: '100%' }}
                                value={currentPO?.project_id}
                                onChange={(val) => setCurrentPO({ ...currentPO, project_id: val, task_id: null })}
                            >
                                {projects.map(p => <Select.Option key={p.id} value={p.id}>{p.title}</Select.Option>)}
                            </Select>
                            <Select 
                                allowClear 
                                placeholder="Chọn công việc (Task)..." 
                                style={{ width: '100%' }}
                                disabled={!currentPO?.project_id}
                                value={currentPO?.task_id}
                                onChange={(val) => setCurrentPO({ ...currentPO, task_id: val })}
                            >
                                {currentPO?.project_id && projects.find(p => p.id === currentPO.project_id)?.tasks?.map((t: any) =>
                                    <Select.Option key={t.id} value={t.id}>{t.title}</Select.Option>
                                )}
                            </Select>
                        </div>
                    </Descriptions.Item>
                    <Descriptions.Item label="Ghi chú chung" span={2}>
                        <Input.TextArea
                            rows={2}
                            value={currentPO?.note}
                            onChange={(e) => setCurrentPO({ ...currentPO, note: e.target.value })}
                            placeholder="Ghi chú chung cho đơn hàng..."
                        />
                    </Descriptions.Item>
                </Descriptions>

                <Tabs defaultActiveKey="1" items={[
                    {
                        key: '1', label: 'Chi tiết Đơn hàng', children: (
                            <Table
                                dataSource={editingItems}
                                rowKey="id"
                                pagination={false}
                                size="small"
                                expandable={{
                                    expandedRowRender: (r: any) => {
                                        let materialHtml = null;
                                        if (currentPO?.type === 'MATERIAL' && r.material) {
                                            const relatedProducts = planProducts.filter(p => 
                                                p.materials && p.materials.some((m: any) => m.key === r.material.id)
                                            );
                                            if (relatedProducts.length > 0) {
                                                materialHtml = (
                                                    <div style={{ paddingLeft: 30, color: '#1890ff', fontSize: 13, marginBottom: 8 }}>
                                                        <b style={{color: '#666'}}>Dùng cho SP (SO):</b> {relatedProducts.map(p => `${p.product?.name || p.name} (${p.quantity})`).join(', ')}
                                                    </div>
                                                );
                                            }
                                        }
                                        
                                        let poDetailsHtml = null;
                                        if (r.po_details && r.po_details.length > 0) {
                                            poDetailsHtml = (
                                                <div style={{ padding: '10px 20px', backgroundColor: '#fafafa', borderRadius: 4, border: '1px solid #e8e8e8' }}>
                                                    <div style={{ marginBottom: 8, fontWeight: 'bold', color: '#1890ff' }}>Chi tiết từng PO:</div>
                                                    <Table
                                                        dataSource={r.po_details}
                                                        rowKey="po_code"
                                                        pagination={false}
                                                        size="small"
                                                        columns={[
                                                            { title: 'Mã PO', dataIndex: 'po_code', width: 150 },
                                                            { title: 'Số lượng', dataIndex: 'quantity', width: 120, align: 'right', render: v => Number(v || 0).toLocaleString() },
                                                            { title: 'Đơn giá', dataIndex: 'unit_price', width: 120, align: 'right', render: v => Number(v || 0).toLocaleString() },
                                                            { title: 'Thành tiền', dataIndex: 'subtotal', align: 'right', render: v => <b>{Number(v || 0).toLocaleString()}</b> }
                                                        ]}
                                                    />
                                                </div>
                                            );
                                        }

                                        if (!materialHtml && !poDetailsHtml) return null;
                                        
                                        return (
                                            <>
                                                {materialHtml}
                                                {poDetailsHtml}
                                            </>
                                        );
                                    },
                                    rowExpandable: (r: any) => {
                                        let hasMaterialInfo = false;
                                        if (currentPO?.type === 'MATERIAL' && r.material) {
                                            hasMaterialInfo = planProducts.some(p => p.materials && p.materials.some((m: any) => m.key === r.material.id));
                                        }
                                        let hasPoDetails = r.po_details && r.po_details.length > 0;
                                        return hasMaterialInfo || hasPoDetails;
                                    }
                                }}
                                columns={[
                                    {
                                        title: 'Tên hàng', width: 200, render: (r: any, _: any, index: number) => {
                                            // Handle Product Relinking (Select)
                                            if (r.product || (!r.material && r.description)) {
                                                return <Select
                                                    showSearch
                                                    style={{ width: '100%' }}
                                                    value={r.product_id || r.product?.id}
                                                    placeholder="Chọn sản phẩm..."
                                                    optionFilterProp="label"
                                                    onChange={(val) => {
                                                        const p = products.find(prod => prod.id === val);
                                                        const newItems = [...editingItems];
                                                        if (p) {
                                                            newItems[index].product = p;
                                                            newItems[index].product_id = p.id;
                                                            // Optional: Update description? 
                                                            // Ideally we keep existing desc or allow manual update, 
                                                            // but changing product usually implies a fix.
                                                            // We leave description column to handle display based on NEW product.
                                                        }
                                                        setEditingItems(newItems);
                                                    }}
                                                    options={products.map(p => ({ label: p.name, value: p.id }))}
                                                />
                                            }

                                            // Material Fallback
                                            if (r.material) return <b>{r.material.name}</b>;

                                            return r.description;
                                        }
                                    },
                                    ...((currentPO?.type === 'OUTSOURCING' || (currentPO?.type === 'POOLED' && editingItems.some((i: any) => !i.material))) ? [
                                        { title: 'Màu MT', width: 100, render: (r: any) => <span>{r.product?.attributes?.front_color || '-'}</span> },
                                        { title: 'Màu MS', width: 100, render: (r: any) => <span>{r.product?.attributes?.back_color || '-'}</span> }
                                    ] : []),
                                    ...(currentPO?.type === 'MATERIAL' ? [
                                        {
                                            title: 'Màu vải MT', width: 120, render: (r: any, _: any, index: number) => (
                                                <AutoComplete
                                                    allowClear
                                                    style={{ width: '100%' }}
                                                    placeholder="Chọn màu..."
                                                    value={r.front_color}
                                                    onChange={(val) => {
                                                        const newItems = [...editingItems];
                                                        newItems[index].front_color = val;
                                                        setEditingItems(newItems);
                                                    }}
                                                    options={uniqueFrontColors.map(c => ({ value: c as string }))}
                                                    filterOption={(inputValue, option) =>
                                                        (option?.value as string)?.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                                                    }
                                                />
                                            )
                                        },
                                        {
                                            title: 'Màu vải MS', width: 120, render: (r: any, _: any, index: number) => (
                                                <AutoComplete
                                                    allowClear
                                                    style={{ width: '100%' }}
                                                    placeholder="Chọn màu..."
                                                    value={r.back_color}
                                                    onChange={(val) => {
                                                        const newItems = [...editingItems];
                                                        newItems[index].back_color = val;
                                                        setEditingItems(newItems);
                                                    }}
                                                    options={uniqueBackColors.map(c => ({ value: c as string }))}
                                                    filterOption={(inputValue, option) =>
                                                        (option?.value as string)?.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                                                    }
                                                />
                                            )
                                        }
                                    ] : []),
                                    {
                                        title: 'Mô tả', width: 200, render: (r: any, _: any, index: number) => {
                                            let defaultContent = '';
                                            if (currentPO?.type === 'MATERIAL') {
                                                const mt = r.front_color || '';
                                                const ms = r.back_color || '';
                                                const name = r.material?.name || r.product?.name || r.description || '';
                                                if (mt || ms) {
                                                    defaultContent = `${mt}${ms ? '/' + ms : ''}---${name}`;
                                                } else {
                                                    defaultContent = name;
                                                }
                                            } else {
                                                if (r.product?.processing_description) {
                                                    defaultContent = r.product.processing_description;
                                                } else if (!r.material && r.description) {
                                                    const match = r.description.match(/^(.+?)\s*\([^)]+\)\s*$/);
                                                    if (match) defaultContent = match[1].trim();
                                                    else defaultContent = r.description;
                                                } else if (r.product?.name) {
                                                    defaultContent = r.product.name;
                                                }
                                            }

                                            let displayValue = r.description !== undefined && r.description !== null ? r.description : defaultContent;
                                            if (currentPO?.type === 'OUTSOURCING' && r.product?.processing_description) {
                                                if (!r.description || (r.product.sku && r.description.includes(r.product.sku))) {
                                                    displayValue = r.product.processing_description;
                                                }
                                            }

                                            return <Input.TextArea 
                                                autoSize={{ minRows: 1, maxRows: 3 }}
                                                placeholder="Nhập mô tả..."
                                                value={displayValue}
                                                onChange={(e) => {
                                                    const newItems = [...editingItems];
                                                    newItems[index].description = e.target.value;
                                                    setEditingItems(newItems);
                                                }}
                                            />;
                                        }
                                    },
                                    { title: 'Tổng Cần (Gốc)', width: 80, align: 'center', render: (r: any) => <span>{Number(r.raw_quantity || 0).toLocaleString()} {r.material?.unit}</span> },
                                    { title: '% Hao hụt', width: 70, align: 'center', render: (r: any) => <Tag color="orange">{r.wastage_rate || 0}%</Tag> },
                                    { title: 'Tổng (+Hao hụt) (Gốc)', width: 100, align: 'center', render: (r: any) => <b>{Number(r.total_quantity || r.quantity).toLocaleString()} {r.material?.unit}</b> },
                                    {
                                        title: 'SL Quy Đổi (Mua)', width: 110, render: (r: any, _: any, index: number) => {
                                            const factor = r.material ? Number(r.material.conversion_factor || 1) : 1;
                                            const unit = r.material ? r.material.purchase_unit : '';

                                            const val = factor > 1 ? Number(((r.quantity || 0) / factor).toFixed(2)) : (r.quantity || 0);
                                            return <InputNumber
                                                value={val}
                                                min={0}
                                                style={{ width: '100%' }}
                                                onChange={(v) => {
                                                    const newQ = factor > 1 ? Number(v) * factor : Number(v);
                                                    const newItems = [...editingItems];
                                                    newItems[index].quantity = newQ;
                                                    // Note: Giữ nguyên logic subtotal = SL Gốc * Đơn giá (gốc)
                                                    newItems[index].subtotal = newQ * Number(newItems[index].unit_price);
                                                    setEditingItems(newItems);
                                                }}
                                                addonAfter={unit}
                                            />
                                        }
                                    },
                                    {
                                        title: 'Đơn giá (theo ĐVT Gốc)', width: 160, render: (r: any, _: any, index: number) => (
                                            <InputNumber
                                                value={r.unit_price}
                                                min={0}
                                                style={{ width: '100%' }}
                                                formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                                onChange={(v) => {
                                                    const newItems = [...editingItems];
                                                    newItems[index].unit_price = Number(v);
                                                    newItems[index].subtotal = Number(newItems[index].quantity) * Number(v);
                                                    setEditingItems(newItems);
                                                }}
                                            />
                                        )
                                    },
                                    {
                                        title: 'Ghi chú', width: 150, render: (r: any, _: any, index: number) => (
                                            <Input
                                                value={r.note}
                                                onChange={(e) => {
                                                    const newItems = [...editingItems];
                                                    newItems[index].note = e.target.value;
                                                    setEditingItems(newItems);
                                                }}
                                            />
                                        )
                                    },
                                    { title: 'Thành tiền', render: (r: any) => <b>{Number(r.subtotal).toLocaleString()}</b> }

                                ]}

                            />
                        )
                    },
                    // Renamed from key '3' to '2' effectively in the UI flow, or just keep key logic simpler
                    // Removed old "Thông tin giao hàng" tab that used removed state variables.

                    // Only show Packing Matrix for MATERIAL POs
                    ...(currentPO?.type !== 'OUTSOURCING' ? [{
                        key: '3', label: 'Thông tin đóng gói', children: (
                            <div>
                                <div style={{ marginBottom: 10 }}>
                                    <span style={{ marginLeft: 10, color: '#888' }}>Thông tin đóng gói được tạo tự động từ danh sách NPL</span>
                                </div>
                                <Table
                                    dataSource={packingList}
                                    rowKey="id"
                                    pagination={false}
                                    size="small"
                                    scroll={{ x: 1200 }}
                                    columns={[
                                        {
                                            title: 'Mã PO Form', width: 100, align: 'center', render: (t: any, r: any, idx: number) => <b>{idx + 1}</b>
                                        },
                                        {
                                            title: 'Tên NPL', width: 250, render: (t, r, idx) => <span>{r.material_name}</span>
                                        },
                                        {
                                            title: 'Tổng SL', width: 100, align: 'right', render: (t, r, idx) => {
                                                const matchingItem = findMatchingPOItem(editingItems, r);
                                                const qty = matchingItem ? Number(matchingItem.quantity) : (r.quantity ? Number(r.quantity) : 0);
                                                return <b>{qty > 0 ? qty.toLocaleString() : '-'}</b>;
                                            }
                                        },
                                        {
                                            title: 'N1', width: 100, render: (t, r, idx) => <Input value={r.n1} onChange={e => {
                                                const list = [...packingList]; list[idx].n1 = e.target.value; setPackingList(list);
                                            }} />
                                        },
                                        {
                                            title: 'N2', width: 100, render: (t, r, idx) => <Input value={r.n2} onChange={e => {
                                                const list = [...packingList]; list[idx].n2 = e.target.value; setPackingList(list);
                                            }} />
                                        },
                                        {
                                            title: 'C1', width: 100, render: (t, r, idx) => <Input value={r.c1} onChange={e => {
                                                const list = [...packingList]; list[idx].c1 = e.target.value; setPackingList(list);
                                            }} />
                                        },
                                        {
                                            title: 'C2', width: 100, render: (t, r, idx) => <Input value={r.c2} onChange={e => {
                                                const list = [...packingList]; list[idx].c2 = e.target.value; setPackingList(list);
                                            }} />
                                        },
                                        {
                                            title: 'G1', width: 100, render: (t, r, idx) => <Input value={r.g1} onChange={e => {
                                                const list = [...packingList]; list[idx].g1 = e.target.value; setPackingList(list);
                                            }} />
                                        },
                                        {
                                            title: 'G2', width: 100, render: (t, r, idx) => <Input value={r.g2} onChange={e => {
                                                const list = [...packingList]; list[idx].g2 = e.target.value; setPackingList(list);
                                            }} />
                                        },
                                        {
                                            title: 'Kiện lẻ', width: 100, render: (t, r, idx) => <Input value={r.odd} onChange={e => {
                                                const list = [...packingList]; list[idx].odd = e.target.value; setPackingList(list);
                                            }} />
                                        },
                                        {
                                            title: 'Kiện viền', width: 100, render: (t, r, idx) => <Input value={r.border} onChange={e => {
                                                const list = [...packingList]; list[idx].border = e.target.value; setPackingList(list);
                                            }} />
                                        },
                                        {
                                            title: 'Tổng Nhập', width: 80, render: (t, r) => {
                                                const total =
                                                    Number(r.n1 || 0) + Number(r.n2 || 0) +
                                                    Number(r.c1 || 0) + Number(r.c2 || 0) +
                                                    Number(r.g1 || 0) + Number(r.g2 || 0) +
                                                    Number(r.odd || 0) + Number(r.border || 0);
                                                return <b>{total}</b>;
                                            }
                                        },
                                        {
                                            title: 'Ghi chú', render: (t, r, idx) => <Input value={r.note} onChange={e => {
                                                const list = [...packingList]; list[idx].note = e.target.value; setPackingList(list);
                                            }} />
                                        },
                                        {
                                            title: '', width: 40, fixed: 'right' as const, render: (t, r, idx) => <Button danger icon={<DeleteOutlined />} size="small" type="text" onClick={() => {
                                                const list = [...packingList]; list.splice(idx, 1); setPackingList(list);
                                            }} />
                                        }
                                    ]}
                                />

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                    <b>Thông tin Sản phẩm trong Kế hoạch</b>
                                    <Input
                                        placeholder="Tìm kiếm sản phẩm (Tên, SKU)"
                                        style={{ width: 300 }}
                                        allowClear
                                        prefix={<SearchOutlined />}
                                        value={planSearchText}
                                        onChange={e => setPlanSearchText(e.target.value)}
                                    />
                                </div>
                                <Table
                                    dataSource={planProducts.filter(p => !planSearchText ||
                                        p.sku.toLowerCase().includes(planSearchText.toLowerCase()) ||
                                        p.name.toLowerCase().includes(planSearchText.toLowerCase())
                                    )}
                                    rowKey="sku"
                                    size="small"
                                    pagination={{ pageSize: 10 }}
                                    columns={[
                                        { title: 'SKU', dataIndex: 'sku', width: 150 },
                                        { title: 'Tên sản phẩm', dataIndex: 'name' },
                                        { title: 'Tổng SL (Sản phẩm)', dataIndex: 'quantity', width: 150, align: 'right', render: v => <b>{Number(v).toLocaleString()}</b> }
                                    ]}
                                    expandable={{
                                        expandedRowRender: record => (
                                            <div style={{ padding: '10px 20px', backgroundColor: '#f9f9f9', borderRadius: 4 }}>
                                                <div style={{ marginBottom: 5, fontWeight: 'bold', color: '#1890ff' }}>Chi tiết NPL cần thiết:</div>
                                                <Table
                                                    dataSource={record.materials}
                                                    rowKey="key"
                                                    pagination={false}
                                                    size="small"
                                                    columns={[
                                                        { title: 'Mã NPL', dataIndex: 'material_code', width: 120 },
                                                        { title: 'Tên NPL', dataIndex: 'material_name' },
                                                        { title: 'ĐM / 1 SP', dataIndex: 'unit_norm', width: 120, align: 'right', render: v => Number(v).toLocaleString() },
                                                        { title: 'Tổng Cần', dataIndex: 'total_norm', width: 120, align: 'right', render: v => <b style={{ color: '#fa8c16' }}>{Number(v).toLocaleString()}</b> }
                                                    ]}
                                                />
                                            </div>
                                        ),
                                        rowExpandable: record => record.materials && record.materials.length > 0,
                                    }}
                                />
                            </div>
                        )
                    },
                    {
                        key: '4', label: 'Quản lý Giao hàng', children: (
                            <div>
                                <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: '#888' }}>
                                        Theo dõi tiến độ giao hàng và tạo phiếu nhập kho.
                                    </span>
                                    <Space>
                                        <Button type="primary" ghost size="small" onClick={() => handleCreateMatrixReceipt()} loading={isDeliveryLoading}>+ Tạo Phiếu Kho (Theo Form)</Button>
                                        {currentPO?.status !== 'DELIVERED' && (
                                            <Popconfirm title="Xác nhận đã giao đủ hàng?" onConfirm={() => handleStatusChange(currentPO.id, 'DELIVERED')}>
                                                <Button type="primary" style={{ background: '#52c41a', borderColor: '#52c41a' }} size="small" icon={<CheckCircleOutlined />}>Đã giao đủ</Button>
                                            </Popconfirm>
                                        )}
                                    </Space>
                                </div>

                                <Table
                                    dataSource={packingList}
                                    rowKey="id"
                                    size="small"
                                    pagination={false}
                                    scroll={{ x: 1200 }}
                                    columns={[
                                        { title: 'Mã PO Form', dataIndex: 'po_form_code', width: 80, align: 'center', render: (t: any, r: any, idx: number) => <b>{idx + 1}</b> },
                                        { title: 'Tên NPL', dataIndex: 'material_name', width: 200 },
                                        {
                                            title: 'Tổng SL ĐM', width: 80, align: 'right', render: (t, r, idx) => {
                                                const matchingItem = findMatchingPOItem(editingItems, r);
                                                const qty = matchingItem ? Number(matchingItem.quantity) : (r.quantity ? Number(r.quantity) : 0);
                                                return <b>{qty > 0 ? qty.toLocaleString() : '-'}</b>;
                                            }
                                        },
                                        {
                                            title: 'Tổng SL đặt', width: 80, align: 'right', render: (t, r) => {
                                                const total =
                                                    Number(r.n1 || 0) + Number(r.n2 || 0) +
                                                    Number(r.c1 || 0) + Number(r.c2 || 0) +
                                                    Number(r.g1 || 0) + Number(r.g2 || 0) +
                                                    Number(r.odd || 0) + Number(r.border || 0);
                                                return <b>{total}</b>
                                            }
                                        },
                                        {
                                            title: 'Tổng SL giao', width: 80, align: 'right', render: (t, r) => {
                                                const total =
                                                    Number(r.n1_input || 0) + Number(r.n2_input || 0) +
                                                    Number(r.c1_input || 0) + Number(r.c2_input || 0) +
                                                    Number(r.g1_input || 0) + Number(r.g2_input || 0) +
                                                    Number(r.odd_input || 0) + Number(r.border_input || 0);
                                                return <b style={{ color: total > 0 ? 'green' : 'inherit' }}>{total}</b>
                                            }
                                        },
                                        {
                                            title: 'N1', children: [
                                                { title: 'Đặt', width: 50, dataIndex: 'n1', align: 'center', render: v => v || '-' },
                                                {
                                                    title: 'Giao', width: 60, align: 'center', render: (v, r: any, idx) => <Input size="small" style={{ textAlign: 'center', color: 'green' }} placeholder="0" value={r.n1_input} onChange={(e) => {
                                                        const list = [...packingList]; list[idx].n1_input = e.target.value; setPackingList(list);
                                                    }} />
                                                }
                                            ]
                                        },
                                        {
                                            title: 'N2', children: [
                                                { title: 'Đặt', width: 50, dataIndex: 'n2', align: 'center', render: v => v || '-' },
                                                {
                                                    title: 'Giao', width: 60, align: 'center', render: (v, r: any, idx) => <Input size="small" style={{ textAlign: 'center', color: 'green' }} placeholder="0" value={r.n2_input} onChange={(e) => {
                                                        const list = [...packingList]; list[idx].n2_input = e.target.value; setPackingList(list);
                                                    }} />
                                                }
                                            ]
                                        },
                                        {
                                            title: 'C1', children: [
                                                { title: 'Đặt', width: 50, dataIndex: 'c1', align: 'center', render: v => v || '-' },
                                                {
                                                    title: 'Giao', width: 60, align: 'center', render: (v, r: any, idx) => <Input size="small" style={{ textAlign: 'center', color: 'green' }} placeholder="0" value={r.c1_input} onChange={(e) => {
                                                        const list = [...packingList]; list[idx].c1_input = e.target.value; setPackingList(list);
                                                    }} />
                                                }
                                            ]
                                        },
                                        {
                                            title: 'C2', children: [
                                                { title: 'Đặt', width: 50, dataIndex: 'c2', align: 'center', render: v => v || '-' },
                                                {
                                                    title: 'Giao', width: 60, align: 'center', render: (v, r: any, idx) => <Input size="small" style={{ textAlign: 'center', color: 'green' }} placeholder="0" value={r.c2_input} onChange={(e) => {
                                                        const list = [...packingList]; list[idx].c2_input = e.target.value; setPackingList(list);
                                                    }} />
                                                }
                                            ]
                                        },
                                        {
                                            title: 'G1', children: [
                                                { title: 'Đặt', width: 50, dataIndex: 'g1', align: 'center', render: v => v || '-' },
                                                {
                                                    title: 'Giao', width: 60, align: 'center', render: (v, r: any, idx) => <Input size="small" style={{ textAlign: 'center', color: 'green' }} placeholder="0" value={r.g1_input} onChange={(e) => {
                                                        const list = [...packingList]; list[idx].g1_input = e.target.value; setPackingList(list);
                                                    }} />
                                                }
                                            ]
                                        },
                                        {
                                            title: 'G2', children: [
                                                { title: 'Đặt', width: 50, dataIndex: 'g2', align: 'center', render: v => v || '-' },
                                                {
                                                    title: 'Giao', width: 60, align: 'center', render: (v, r: any, idx) => <Input size="small" style={{ textAlign: 'center', color: 'green' }} placeholder="0" value={r.g2_input} onChange={(e) => {
                                                        const list = [...packingList]; list[idx].g2_input = e.target.value; setPackingList(list);
                                                    }} />
                                                }
                                            ]
                                        },
                                        {
                                            title: 'Kiện lẻ', children: [
                                                { title: 'Đặt', width: 50, dataIndex: 'odd', align: 'center', render: v => v || '-' },
                                                {
                                                    title: 'Giao', width: 60, align: 'center', render: (v, r: any, idx) => <Input size="small" style={{ textAlign: 'center', color: 'green' }} placeholder="0" value={r.odd_input} onChange={(e) => {
                                                        const list = [...packingList]; list[idx].odd_input = e.target.value; setPackingList(list);
                                                    }} />
                                                }
                                            ]
                                        },
                                        {
                                            title: 'Kiện viền', children: [
                                                { title: 'Đặt', width: 50, dataIndex: 'border', align: 'center', render: v => v || '-' },
                                                {
                                                    title: 'Giao', width: 60, align: 'center', render: (v, r: any, idx) => <Input size="small" style={{ textAlign: 'center', color: 'green' }} placeholder="0" value={r.border_input} onChange={(e) => {
                                                        const list = [...packingList]; list[idx].border_input = e.target.value; setPackingList(list);
                                                    }} />
                                                }
                                            ]
                                        }
                                    ]}
                                />
                            </div>
                        )
                    }] : []),
                    // --- MỚI: Tab Thiết kế & In ấn cho Gia công, PO NPL và PO Gộp ---
                    {
                        key: 'design_tab',
                        label: 'Thiết kế & In ấn',
                        children: (
                            <div>
                                <div style={{ marginBottom: 16 }}>
                                    <b>Cập nhật Thiết kế cho NPL / Sản phẩm:</b>
                                    <p style={{ color: '#888' }}>Liên kết mẫu in ấn/thêu/sơ đồ rập để quản lý quy cách sản xuất, định mức khổ vải và số mét in ấn theo sơ đồ.</p>
                                </div>
                                <Table
                                    dataSource={editingItems}
                                    rowKey={(r, idx) => r.id || idx}
                                    pagination={false}
                                    size="small"
                                    columns={[
                                        { title: 'Sản phẩm / NPL', render: (r: any) => r.product?.name || r.material?.name || r.description },
                                        {
                                            title: 'Chọn Sơ đồ Thiết kế / Rập',
                                            width: 500,
                                            render: (r: any, _: any, index: number) => (
                                                <Select
                                                    showSearch
                                                    allowClear
                                                    placeholder="Chọn sơ đồ In/Thêu/Rập..."
                                                    style={{ width: '100%', minWidth: 400 }}
                                                    value={r.print_design_id || r.print_design?.id}
                                                    onDropdownVisibleChange={(open) => {
                                                        if (open) {
                                                            api.get(`/designs/print-designs`).then(res => setPrintDesigns(res.data)).catch(console.error);
                                                        }
                                                    }}
                                                    onChange={(val) => {
                                                        const newItems = [...editingItems];
                                                        newItems[index].print_design_id = val;
                                                        const foundDesign = printDesigns.find(d => d.id === val);
                                                        newItems[index].print_design = foundDesign;
                                                        
                                                        // Tự động tính toán số mét in/cắt theo sơ đồ nếu có
                                                        if (val && foundDesign) {
                                                            const pd = foundDesign;
                                                            if (pd.type === 'PRINT' && pd.tech_pack?.binsByFace) {
                                                                let maxH = 0;
                                                                Object.values(pd.tech_pack.binsByFace).forEach((bins: any) => {
                                                                    if (Array.isArray(bins)) {
                                                                        bins.forEach((b: any) => {
                                                                            if (b.h > maxH) maxH = b.h;
                                                                        });
                                                                    }
                                                                });
                                                                if (maxH > 0) {
                                                                    // Quy đổi cm sang m nếu cần
                                                                    const meters = maxH > 100 ? maxH / 100 : maxH;
                                                                    if (currentPO?.type === 'OUTSOURCING' || newItems[index].material?.unit?.toLowerCase().includes('m') || !newItems[index].material) {
                                                                        newItems[index].quantity = Number(meters.toFixed(2));
                                                                        newItems[index].qty = Number(meters.toFixed(2));
                                                                    }
                                                                }
                                                            }
                                                        }
                                                        
                                                        setEditingItems(newItems);
                                                    }}
                                                    filterOption={(input, option) => {
                                                        const text = option?.['data-search'] || '';
                                                        return typeof text === 'string' && text.toLowerCase().includes(input.toLowerCase());
                                                    }}
                                                    popupMatchSelectWidth={false}
                                                >
                                                    {printDesigns.map(pd => (
                                                        <Select.Option key={pd.id} value={pd.id} data-search={`[${pd.code}] ${pd.name} ${pd.type}`}>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px 0', borderBottom: '1px solid #f0f0f0' }}>
                                                                <div style={{ fontWeight: 'bold', whiteSpace: 'normal', lineHeight: '1.2' }}>{pd.name}</div>
                                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                                    <span style={{ fontSize: '12px', color: '#888' }}>{pd.code}</span>
                                                                    <Tag color={pd.type === 'PRINT' ? 'blue' : 'purple'} style={{ margin: 0, fontSize: 10, lineHeight: '14px' }}>{pd.type}</Tag>
                                                                    {pd.created_at && <span style={{ fontSize: '11px', color: '#bfbfbf' }}>{new Date(pd.created_at).toLocaleDateString('vi-VN')}</span>}
                                                                </div>
                                                            </div>
                                                        </Select.Option>
                                                    ))}
                                                </Select>
                                            )
                                        },
                                        {
                                            title: 'Trạng thái Sơ đồ',
                                            render: (r: any) => {
                                                if (!r.print_design_id && !r.print_design) return <Tag color="default">Chưa liên kết</Tag>;
                                                return <Tag color="blue">Đã liên kết sơ đồ</Tag>;
                                            }
                                        }
                                    ]}
                                />
                            </div>
                        )
                    },
                    // --- MỚI: Tab Sơ đồ rập cho Gia công, PO NPL và PO Gộp ---
                    {
                        key: 'sodo_tab',
                        label: 'Sơ đồ rập',
                        children: (
                            <div style={{ maxHeight: 600, overflowY: 'auto' }}>
                                {editingItems.filter((i: any) => i.print_design?.tech_pack?.resultsByFace).map((item: any, idx: number) => {
                                    const faces = item.print_design.tech_pack.faces || [];
                                    const resultsByFace = item.print_design.tech_pack.resultsByFace;
                                    
                                    const dataSource = faces.map((face: any) => {
                                        const stats = resultsByFace[face.id]?.stats;
                                        if (!stats) return null;
                                        return {
                                            key: face.id,
                                            name: face.name,
                                            runs: stats.runs,
                                            qtyPerFile: stats.qtyPerFile,
                                            totalQty: stats.totalQty,
                                            productQuantity: stats.productQuantity,
                                            width: stats.width,
                                            length: stats.length,
                                            remainderQty: stats.remainderQty,
                                            remainderLength: stats.remainderLength,
                                            expectedTotalLength: stats.expectedTotalLength,
                                            wasteArea: stats.wasteArea
                                        };
                                    }).filter(Boolean);

                                    return (
                                        <Card size="small" title={`Sơ đồ: ${item.description || item.product?.name || item.material?.name}`} key={idx} style={{ marginBottom: 16 }}>
                                            <Table
                                                size="small"
                                                pagination={false}
                                                dataSource={dataSource}
                                                columns={[
                                                    { title: 'Nội dung in / Rập', dataIndex: 'name', render: (t: string) => <b>{t}</b> },
                                                    { title: 'Số lượng SP', dataIndex: 'productQuantity', render: (v: number) => <b>{v || '-'}</b> },
                                                    { title: 'Số lần in / cắt', dataIndex: 'runs', render: (v: number, r: any) => r.remainderQty > 0 ? <span>{v} <br/><small style={{color: '#888'}}>+1 (lượt cuối)</small></span> : v },
                                                    { title: 'Số con/file', dataIndex: 'qtyPerFile', render: (v: number, r: any) => r.remainderQty > 0 ? <span>{v} <br/><small style={{color: '#888'}}>+ {r.remainderQty} (lượt cuối)</small></span> : v },
                                                    { title: 'Tổng mét vải (m)', dataIndex: 'expectedTotalLength', render: (v: number) => <b style={{ color: '#52c41a' }}>{(Number(v || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b> },
                                                    { title: 'Khổ (cm)', dataIndex: 'width' },
                                                    { title: 'Kích thước / file (cm)', dataIndex: 'length', render: (v: number, r: any) => r.remainderQty > 0 ? <span><span style={{ color: '#cf1322' }}>{v?.toFixed(2)}</span> <br/><small style={{color: '#cf1322'}}>+ {r.remainderLength?.toFixed(2)} (lượt cuối)</small></span> : <span style={{ color: '#cf1322' }}>{v?.toFixed(2)}</span> },
                                                    { title: 'Dự kiến cần (m)', render: (r: any) => {
                                                        const factor = item.material ? Number(item.material.conversion_factor || 1) : 1;
                                                        const val = factor > 1 ? Number(((item.quantity || 0) / factor).toFixed(2)) : (item.quantity || 0);
                                                        return <b style={{ color: '#1890ff' }}>{Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>;
                                                    }},
                                                    { title: 'Diện tích dư cuối (m²)', dataIndex: 'wasteArea', render: (v: number) => (Number(v || 0) / 10000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) },
                                                ]}
                                            />
                                        </Card>
                                    );
                                })}
                                {editingItems.filter((i: any) => i.print_design?.tech_pack?.resultsByFace).length === 0 && (
                                    <Alert message="Chưa có thông tin sơ đồ rập nào được liên kết trong đơn hàng này. Bạn có thể liên kết Sơ đồ tại tab 'Thiết kế & In ấn'." type="info" showIcon />
                                )}
                            </div>
                        )
                    },
                    // --- MỚI: Tab Bán Thành Phẩm cho PO Gia công (OUTSOURCING) ---
                    ...(currentPO?.type === 'OUTSOURCING' ? [{
                        key: 'btp_tab',
                        label: (
                            <span>
                                🧩 Bán thành phẩm
                                {Array.isArray(currentPO?.semi_finished_products) && currentPO.semi_finished_products.length > 0 && (
                                    <Tag color="purple" style={{ marginLeft: 6 }}>
                                        {currentPO.semi_finished_products.length}
                                    </Tag>
                                )}
                            </span>
                        ),
                        children: (
                            <POBtpTab
                                currentPO={currentPO}
                                suppliers={suppliers}
                                products={products}
                                planProducts={planProducts}
                                purchaseOrders={data}
                                onSave={(btpList) => {
                                    setCurrentPO((prev: any) => ({ ...prev, semi_finished_products: btpList }));
                                    fetchData();
                                }}
                            />
                        )
                    }] : []),
                    // --- MỚI: Tab Lịch sử thanh toán ---
                    {
                        key: 'payment_history_tab',
                        label: (
                            <span>
                                💰 Lịch sử thanh toán
                                {Number(currentPO?.paid_amount || 0) > 0 && (
                                    <Tag color="green" style={{ marginLeft: 6 }}>
                                        {Number(currentPO.paid_amount).toLocaleString()} ₫
                                    </Tag>
                                )}
                            </span>
                        ),
                        children: (
                            <POPayments
                                po={currentPO}
                                onSuccess={() => {
                                    fetchData();
                                    if (currentPO?.id) {
                                        api.get(`/purchasing/${currentPO.id}`).then(res => {
                                            setCurrentPO(res.data);
                                        }).catch(console.error);
                                    }
                                }}
                            />
                        )
                    }
                ]}
                />
            </Modal>


            {/* MODAL PRINT SELECTION */}
            <Modal title="Chọn Mẫu In PO" open={isPrintModalOpen} onCancel={() => setIsPrintModalOpen(false)} footer={null}>
                <Space direction="vertical" style={{ width: '100%' }}>
                    {currentPO?.supplier?.po_template && (
                        <Button type="primary" block onClick={() => handlePrint('SUPPLIER_TEMPLATE')}>Mẫu của NCC / NGC (Tùy chỉnh)</Button>
                    )}
                    <Button block onClick={() => handlePrint('STANDARD')}>Mẫu Tiêu Chuẩn (Đơn hàng)</Button>
                    <Button block onClick={() => handlePrint('OUTSOURCING', true)}>Mẫu Gia Công (Có Đơn giá)</Button>
                    <Button block onClick={() => handlePrint('OUTSOURCING', false)}>Mẫu Gia Công (Không Đơn giá)</Button>
                    <Button block onClick={() => handlePrint('CARA')}>Mẫu Đóng Gói (Cara Style)</Button>
                    <Button block onClick={() => handlePrint('HQ')}>Mẫu Đóng Gói (HQ Style)</Button>
                    <Button block onClick={() => handlePrint('TV')}>Mẫu Đặt Hàng (Trần Văn)</Button>
                </Space>
            </Modal>



            {/* MỚI: Modal Xuất Kho NPL Gia Công */}
            <OutsourcingMaterialIssueModal
                open={isIssueModalOpen}
                onClose={() => setIsIssueModalOpen(false)}
                currentPO={issueModalPO}
                onRefresh={fetchData}
            />
        </div>
    );
};

export default PurchasingPage;