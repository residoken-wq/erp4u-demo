import React, { useEffect, useState, useMemo } from 'react';
import { Table, Button, message, Card, Modal, Form, Input, Select, InputNumber, Row, Col, Tabs, Tag, Statistic, Radio, Divider, Space, Badge, Checkbox, Popconfirm, DatePicker, Alert, Tooltip } from 'antd';
import {
    ReloadOutlined, SwapOutlined, HistoryOutlined,
    AppstoreOutlined, ArrowUpOutlined, ArrowDownOutlined,
    InboxOutlined, ShopOutlined, AlertOutlined, CheckCircleOutlined, CarOutlined, PlusOutlined, EditOutlined, DeleteOutlined, InfoCircleOutlined
} from '@ant-design/icons';
import api from '../utils/api';
import dayjs from 'dayjs';
import useMobile from '../hooks/useMobile';


const { Option } = Select;

// ĐỊNH NGHĨA 4 KHO & QUY ĐỊNH LOẠI HÀNG CHO TỪNG KHO
const WAREHOUSES = [
    { code: 'KHO_TP', name: '1. Kho Thành Phẩm', color: 'green', allowedTypes: ['PRODUCT'] },
    { code: 'KHO_BTP', name: '2. Kho Bán Thành Phẩm', color: 'orange', allowedTypes: ['PRODUCT'] }, // BTP thường là SP dở dang
    { code: 'KHO_NPL', name: '3. Kho Nguyên Phụ Liệu', color: 'blue', allowedTypes: ['MATERIAL'] }, // Kho này chỉ chứa NL
    { code: 'KHO_LOI', name: '4. Kho Hàng Lỗi', color: 'red', allowedTypes: ['PRODUCT'] }, // Hàng lỗi trả về thường là SP
    { code: 'KHO_THANH_LY', name: '5. Kho Thanh Lý', color: 'gray', allowedTypes: ['PRODUCT', 'MATERIAL'] }, // Hàng chờ thanh lý
];

const InventoryPage: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const isMobile = useMobile();

    const [products, setProducts] = useState<any[]>([]);
    const [materials, setMaterials] = useState<any[]>([]);
    const [stocks, setStocks] = useState<any[]>([]); // Dữ liệu tồn chi tiết
    const [history, setHistory] = useState<any[]>([]);
    const [pendingReceipts, setPendingReceipts] = useState<any[]>([]);
    const [pendingDeliveries, setPendingDeliveries] = useState<any[]>([]); // <--- New State: Pending Export Requests
    const [completedDeliveries, setCompletedDeliveries] = useState<any[]>([]); // <--- New State: Completed Export Deliveries
    const [shippingCarriers, setShippingCarriers] = useState<any[]>([]); // <--- Shipping Carriers
    const [goodsIssues, setGoodsIssues] = useState<any[]>([]); // <--- Phiếu Xuất NPL
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]); // <--- POs
    const [productionPlans, setProductionPlans] = useState<any[]>([]); // <--- PFOs
    const [selectedSuppliers, setSelectedSuppliers] = useState<Record<string, number>>({});

    const [searchText, setSearchText] = useState('');

    const [activeTab, setActiveTab] = useState('ALL_STOCKS'); // Tab chính
    const [isModalOpen, setIsModalOpen] = useState(false);

    // --- STATE ---
    const [showNegativeOnly, setShowNegativeOnly] = useState(false);
    const [resetCode, setResetCode] = useState('');
    const [isResetModalOpen, setIsResetModalOpen] = useState(false);

    // --- TRANSFER MODAL STATE ---
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [transferForm] = Form.useForm();
    const [transferTarget, setTransferTarget] = useState<{ item: any, fromWh: string, toWh: string, title: string } | null>(null);

    // --- CONVERT BTP MODAL STATE ---
    const [isConvertBtpModalOpen, setIsConvertBtpModalOpen] = useState(false);
    const [convertBtpForm] = Form.useForm();
    const [convertBtpTarget, setConvertBtpTarget] = useState<any>(null);

    // --- CARRIER MODAL STATE ---
    const [isCarrierModalOpen, setIsCarrierModalOpen] = useState(false);
    const [carrierForm] = Form.useForm();
    const [editingCarrier, setEditingCarrier] = useState<any>(null);

    // --- CONFIRM RECEIPT MODAL STATE ---
    const [isConfirmReceiptModalOpen, setIsConfirmReceiptModalOpen] = useState(false);
    const [confirmReceiptForm] = Form.useForm();
    const [selectedReceipt, setSelectedReceipt] = useState<any>(null);

    // --- CONFIRM GOODS ISSUE MODAL STATE ---
    const [isConfirmGiModalOpen, setIsConfirmGiModalOpen] = useState(false);
    const [selectedGiForConfirm, setSelectedGiForConfirm] = useState<any>(null);
    const [confirmGiItems, setConfirmGiItems] = useState<any[]>([]);
    const [bulkSupplierId, setBulkSupplierId] = useState<number | null>(null);

    // --- EDIT GOODS ISSUE MODAL STATE ---
    const [isEditGiModalOpen, setIsEditGiModalOpen] = useState(false);
    const [selectedGiForEdit, setSelectedGiForEdit] = useState<any>(null);
    const [editGiItems, setEditGiItems] = useState<any[]>([]);
    const [editGiForm] = Form.useForm();

    const [form] = Form.useForm();


    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const adjustmentType = Form.useWatch('type', form);
    const itemType = Form.useWatch('itemType', form);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [pRes, mRes, sRes, hRes, grRes, dRes, cdRes, cRes, giRes, supRes, poRes, pfoRes] = await Promise.all([
                api.get('/products'),
                api.get('/materials'),
                api.get('/inventory/stocks'),
                api.get('/inventory/history'),
                api.get('/inventory/goods-receipt/pending'),
                api.get('/inventory/deliveries/pending'),
                api.get('/inventory/deliveries/completed'),
                api.get('/inventory/shipping-carriers'),
                api.get('/inventory/goods-issue'),
                api.get('/suppliers'),
                api.get('/purchasing'),
                api.get('/planning')
            ]);
            setProducts(pRes.data);
            setMaterials(mRes.data);
            setStocks(sRes.data);
            setHistory(hRes.data);
            setPendingReceipts(grRes.data || []);
            setPendingDeliveries(dRes.data || []);
            setCompletedDeliveries(cdRes.data || []);
            setShippingCarriers(cRes.data || []);
            setGoodsIssues(giRes.data || []);
            setSuppliers(supRes.data || []);
            setPurchaseOrders(poRes.data || []);
            setProductionPlans(pfoRes.data || []);
        } catch (error) {
            message.error('Đã xảy ra lỗi khi tải dữ liệu');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleAdjust = async (values: any) => {
        try {
            await api.post('/inventory/adjust', values);
            message.success('Điều chỉnh thành công');
            setIsModalOpen(false);
            form.resetFields();
            fetchData();
        } catch (error) {
            message.error('Lỗi điều chỉnh kho');
        }
    };

    const getStockQty = (type: string, id: number, whCode: string) => {
        if (type === 'PRODUCT') {
            const product = products.find(p => p.id === id);
            if (product && product.product_type === 'COMBO') {
                if (!product.combo_components || product.combo_components.length === 0) return 0;
                let minStock = Infinity;
                for (const comp of product.combo_components) {
                    const childStockRecord = stocks.find(s => s.item_type === 'PRODUCT' && Number(s.item_id) === comp.child_id && s.warehouse_code === whCode);
                    const childQty = childStockRecord ? Number(childStockRecord.quantity) : 0;
                    const possibleStock = Math.floor(childQty / (Number(comp.quantity) || 1));
                    if (possibleStock < minStock) {
                        minStock = possibleStock;
                    }
                }
                return minStock === Infinity ? 0 : minStock;
            }
        }
        
        const record = stocks.find(s => s.item_type === type && Number(s.item_id) === id && s.warehouse_code === whCode);
        return record ? Number(record.quantity) : 0;
    };

    // --- TRANSFER ---
    const openTransferModal = (record: any, actionType: 'REPORT_DEFECT' | 'RE_IMPORT' | 'LIQUIDATE') => {
        let fromWh = '', toWh = '';
        let title = '';

        if (actionType === 'REPORT_DEFECT') {
            fromWh = 'KHO_TP';
            toWh = 'KHO_LOI';
            title = `Báo lỗi SP: ${record.name} (${record.sku})`;
        } else if (actionType === 'RE_IMPORT') {
            fromWh = 'KHO_LOI';
            toWh = 'KHO_TP';
            title = `Tái nhập kho SP: ${record.name}`;
        } else if (actionType === 'LIQUIDATE') {
            fromWh = 'KHO_LOI';
            toWh = 'KHO_THANH_LY';
            title = `Thanh lý SP: ${record.name}`;
        }

        setTransferTarget({ item: record, fromWh, toWh, title });
        transferForm.setFieldsValue({ quantity: 1, note: '' });
        setIsTransferModalOpen(true);
    };

    const handleTransfer = async () => {
        try {
            const values = await transferForm.validateFields();
            if (!transferTarget) return;

            await api.post('/inventory/transfer', {
                itemType: transferTarget.item.item_type,
                itemId: transferTarget.item.id,
                quantity: values.quantity,
                fromWh: transferTarget.fromWh,
                toWh: transferTarget.toWh,
                note: values.note
            });

            message.success('Chuyển kho thành công');
            setIsTransferModalOpen(false);
            fetchData();
        } catch (e) {
            message.error('Lỗi chuyển kho');
        }
    };

    // --- CONVERT BTP LOGIC ---
    const openConvertBtpModal = (record: any) => {
        setConvertBtpTarget(record);
        convertBtpForm.setFieldsValue({
            sourceSku: record.sku,
            quantity: 1,
            targetSku: undefined
        });
        setIsConvertBtpModalOpen(true);
    };

    const handleConvertBtp = async () => {
        try {
            const values = await convertBtpForm.validateFields();
            if (!convertBtpTarget) return;

            await api.post('/inventory/convert-btp', {
                sourceSku: values.sourceSku,
                targetSku: values.targetSku,
                quantity: values.quantity
            });

            message.success('Chuyển đổi BTP thành công');
            setIsConvertBtpModalOpen(false);
            fetchData();
        } catch (e: any) {
            message.error(e.response?.data?.message || 'Lỗi chuyển đổi BTP');
        }
    };

    const openConfirmReceiptModal = (receipt: any) => {
        setSelectedReceipt(receipt);
        const initialValues: any = {
            actual_receive_date: dayjs(),
            shipping_fee: 0,
            delivery_note_url: ''
        };
        receipt.items.forEach((item: any) => {
            initialValues[`quantity_${item.id}`] = item.quantity;
        });
        confirmReceiptForm.setFieldsValue(initialValues);
        setIsConfirmReceiptModalOpen(true);
    };

    const handleConfirmReceipt = async () => {
        try {
            const values = await confirmReceiptForm.validateFields();
            if (!selectedReceipt) return;
            
            const payload = {
                actual_receive_date: values.actual_receive_date ? values.actual_receive_date.format('YYYY-MM-DD') : undefined,
                shipping_fee: values.shipping_fee,
                delivery_note_url: values.delivery_note_url,
                items: selectedReceipt.items.map((item: any) => ({
                    id: item.id,
                    quantity: values[`quantity_${item.id}`] !== undefined ? values[`quantity_${item.id}`] : item.quantity
                }))
            };

            await api.post(`/inventory/goods-receipt/${selectedReceipt.id}/confirm`, payload);
            message.success('Đã nhập kho thành công');
            setIsConfirmReceiptModalOpen(false);
            fetchData();
        } catch (e) {
            message.error('Lỗi nhập kho');
        }
    };

    const handleDeleteReceipt = async (id: number) => {
        try {
            await api.delete(`/inventory/goods-receipt/${id}`);
            message.success('Đã hủy phiếu nhập');
            fetchData();
        } catch (e) {
            message.error('Lỗi hủy phiếu nhập');
        }
    };

    const handleConfirmExport = async (id: number) => {
        try {
            // Defaulting to KHO_TP for now as per requirement, but could be selectable
            await api.post(`/inventory/deliveries/${id}/confirm`, { warehouse: 'KHO_TP' });
            message.success('Đã xác nhận xuất kho');
            fetchData();
        } catch (e) {
            message.error('Lỗi xác nhận xuất kho');
        }
    };

    const getGiCustomerName = (gi: any) => {
        if (!gi) return '';
        // 1. Từ PFO
        const pfoId = gi.pfo_id || gi.plan_id;
        if (pfoId) {
            const pfo = productionPlans.find(p => p.id === pfoId);
            if (pfo?.sales_order?.customer?.name) return pfo.sales_order.customer.name;
            if (pfo?.sales_order?.customer_name) return pfo.sales_order.customer_name;
        }
        // 2. Từ PO
        const poId = gi.po_id;
        if (poId) {
            const po = purchaseOrders.find(p => p.id === poId);
            if (po?.pfo?.sales_order?.customer?.name) return po.pfo.sales_order.customer.name;
            if (po?.pfo?.sales_order?.customer_name) return po.pfo.sales_order.customer_name;
            if (po?.type === 'POOLED' && po.child_pos?.length > 0) {
                const names = new Set<string>();
                po.child_pos.forEach((c: any) => {
                    const n = c.pfo?.sales_order?.customer?.name || c.pfo?.sales_order?.customer_name;
                    if (n) names.add(n);
                });
                if (names.size > 0) return Array.from(names).join(', ');
            }
        }
        // 3. Trực tiếp từ relation nếu có
        if (gi.purchase_order?.pfo?.sales_order?.customer?.name) {
            return gi.purchase_order.pfo.sales_order.customer.name;
        }
        return '';
    };

    // --- HELPER LẤY THÔNG TIN QUẢN LÝ GIAO HÀNG & MA TRẬN CHO PHIẾU NHẬP KHO ---
    const getReceiptCustomerName = (receipt: any) => {
        if (!receipt) return '';
        const po = receipt.purchase_order || purchaseOrders.find(p => p.id === receipt.po_id);
        if (!po) return '';
        const pfo = po.pfo || po.plan;
        if (pfo) {
            if (pfo.sales_order?.customer?.name) return pfo.sales_order.customer.name;
            if (pfo.sales_order?.customer_name) return pfo.sales_order.customer_name;
            if (pfo.sales_orders && pfo.sales_orders.length > 0) {
                const names = Array.from(new Set(pfo.sales_orders.map((so: any) => so?.customer?.name || so?.customer_name).filter(Boolean)));
                if (names.length > 0) return names.join(', ');
            }
        }
        if (po.type === 'POOLED' && po.child_pos && po.child_pos.length > 0) {
            const names = new Set<string>();
            po.child_pos.forEach((c: any) => {
                const n = c.pfo?.sales_order?.customer?.name || c.pfo?.sales_order?.customer_name;
                if (n) names.add(n);
            });
            if (names.size > 0) return Array.from(names).join(', ');
        }
        return '';
    };

    const getReceiptSupplierName = (receipt: any) => {
        const po = receipt.purchase_order || purchaseOrders.find(p => p.id === receipt.po_id);
        if (!po) return '';
        return po.supplier?.name || po.supplier_name || (po.note?.split('NCC: ')[1] || '');
    };

    const getReceiptItemDeliveryInfo = (receipt: any, item: any, idx?: number) => {
        const po = receipt.purchase_order || purchaseOrders.find(p => p.id === receipt.po_id);
        const packingListDetails: any[] = po?.packing_list_details || [];
        const poItems: any[] = po?.items || [];

        // Tìm PO item tương ứng
        let matchedPoItem = null;
        if (item.po_item_id) {
            matchedPoItem = poItems.find(pi => pi.id === item.po_item_id);
        }
        if (!matchedPoItem) {
            matchedPoItem = poItems.find(pi => 
                (item.material_id && (pi.material_id === item.material_id || pi.material?.id === item.material_id)) ||
                (item.product_id && (pi.product_id === item.product_id || pi.product?.id === item.product_id)) ||
                (item.material?.name && (pi.material?.name === item.material.name || pi.description === item.material.name))
            );
        }

        // Tìm dòng trong packing_list_details (Quản lý giao hàng của PO)
        let matchedPacking: any = null;
        if (packingListDetails.length > 0) {
            matchedPacking = packingListDetails.find((p: any) => {
                if (item.material_id && p.material_id && Number(p.material_id) === Number(item.material_id)) return true;
                const matName = (item.material?.name || item.product?.name || '').toLowerCase().trim();
                const pMatName = (p.material_name || '').toLowerCase().trim();
                if (matName && pMatName && (matName === pMatName || matName.includes(pMatName) || pMatName.includes(matName))) return true;
                return false;
            });
            if (!matchedPacking && idx !== undefined && packingListDetails[idx]) {
                matchedPacking = packingListDetails[idx];
            }
        }

        // 1. Số lượng Định Mức (ĐM)
        const normQty = matchedPacking?.quantity !== undefined && matchedPacking?.quantity !== null && matchedPacking?.quantity !== ''
            ? Number(matchedPacking.quantity) 
            : (matchedPoItem?.quantity ? Number(matchedPoItem.quantity) : Number(item.quantity || 0));

        // 2. Số lượng Đặt (Tổng N1..border hoặc theo PO item hoặc BTP)
        let orderQty = 0;
        
        // KIỂM TRA BTP GIA CÔNG TRƯỚC
        let matchedBtp = null;
        if (po?.type === 'OUTSOURCING' && po?.semi_finished_products) {
            try {
                const btpList = typeof po.semi_finished_products === 'string' 
                    ? JSON.parse(po.semi_finished_products) 
                    : po.semi_finished_products;
                
                if (Array.isArray(btpList)) {
                    matchedBtp = btpList.find((b: any) => {
                        const bProdId = b.product_id || b.product?.id;
                        const iProdId = item.product_id || item.product?.id;
                        return Number(bProdId) === Number(iProdId);
                    });
                    console.log('DEBUG BTP MATCH:', { btpList, itemProductId: item.product_id || item.product?.id, matchedBtp });
                }
            } catch (e) {}
        }

        if (matchedBtp) {
            orderQty = Number(matchedBtp.output_quantity !== undefined ? matchedBtp.output_quantity : (matchedBtp.quantity || 0));
        } else if (po?.type === 'OUTSOURCING' && po?.semi_finished_products && !item.po_item_id) {
            // Đây chắc chắn là BTP item được tạo từ logic mới (không có po_item_id)
            // Số lượng item.quantity lúc tạo draft PNK chính là output_quantity của BTP
            orderQty = Number(item.quantity || 0);
        } else if (matchedPacking) {
            const matrixOrderTotal = 
                Number(matchedPacking.n1 || 0) + Number(matchedPacking.n2 || 0) +
                Number(matchedPacking.c1 || 0) + Number(matchedPacking.c2 || 0) +
                Number(matchedPacking.g1 || 0) + Number(matchedPacking.g2 || 0) +
                Number(matchedPacking.odd || 0) + Number(matchedPacking.border || 0);
            orderQty = matrixOrderTotal > 0 ? matrixOrderTotal : (Number(matchedPacking.quantity) || Number(matchedPoItem?.quantity) || Number(item.quantity || 0));
        } else if (matchedPoItem) {
            orderQty = Number(matchedPoItem.quantity || 0);
        } else {
            orderQty = Number(item.quantity || 0);
        }

        // 3. Số lượng Giao (Trong phiếu này)
        const deliveryQty = Number(item.quantity || 0);

        // 4. Ma trận chi tiết
        const pData = item.packing_data || {};
        const matrix = {
            n1: { order: matchedPacking?.n1 ?? null, delivery: pData.n1 !== undefined ? pData.n1 : (matchedPacking?.n1_input ?? null) },
            n2: { order: matchedPacking?.n2 ?? null, delivery: pData.n2 !== undefined ? pData.n2 : (matchedPacking?.n2_input ?? null) },
            c1: { order: matchedPacking?.c1 ?? null, delivery: pData.c1 !== undefined ? pData.c1 : (matchedPacking?.c1_input ?? null) },
            c2: { order: matchedPacking?.c2 ?? null, delivery: pData.c2 !== undefined ? pData.c2 : (matchedPacking?.c2_input ?? null) },
            g1: { order: matchedPacking?.g1 ?? null, delivery: pData.g1 !== undefined ? pData.g1 : (matchedPacking?.g1_input ?? null) },
            g2: { order: matchedPacking?.g2 ?? null, delivery: pData.g2 !== undefined ? pData.g2 : (matchedPacking?.g2_input ?? null) },
            odd: { order: matchedPacking?.odd ?? null, delivery: pData.odd !== undefined ? pData.odd : (matchedPacking?.odd_input ?? null) },
            border: { order: matchedPacking?.border ?? null, delivery: pData.border !== undefined ? pData.border : (matchedPacking?.border_input ?? null) },
        };

        const hasMatrixData = Boolean(
            matchedPacking?.n1 || matchedPacking?.n2 || matchedPacking?.c1 || matchedPacking?.c2 ||
            matchedPacking?.g1 || matchedPacking?.g2 || matchedPacking?.odd || matchedPacking?.border ||
            pData.n1 !== undefined || pData.n2 !== undefined || pData.c1 !== undefined || pData.c2 !== undefined ||
            pData.g1 !== undefined || pData.g2 !== undefined || pData.odd !== undefined || pData.border !== undefined
        );

        return {
            matchedPoItem,
            matchedPacking,
            normQty,
            orderQty,
            deliveryQty,
            matrix,
            hasMatrixData,
            poFormCode: matchedPacking?.po_form_code || (idx !== undefined ? idx + 1 : 1)
        };
    };

    const openConfirmGiModal = (record: any) => {
        setSelectedGiForConfirm(record);
        setConfirmGiItems(record.items.map((i: any) => ({
            id: i.id,
            material_id: i.material_id,
            material: i.material,
            original_quantity: i.quantity,
            quantity: i.quantity,
            supplier_id: i.supplier_id || record.supplier_id || null
        })));
        setBulkSupplierId(record.supplier_id || null);
        setIsConfirmGiModalOpen(true);
    };

    const handleConfirmGiSubmit = async () => {
        if (!selectedGiForConfirm) return;
        try {
            await api.post(`/inventory/goods-issue/${selectedGiForConfirm.id}/confirm`, {
                supplier_id: bulkSupplierId,
                items: confirmGiItems
            });
            message.success('Đã xác nhận xuất kho!');
            setIsConfirmGiModalOpen(false);
            fetchData();
        } catch (e: any) {
            message.error(e.response?.data?.message || 'Lỗi xác nhận xuất kho');
        }
    };

    const openEditGiModal = (record: any) => {
        setSelectedGiForEdit(record);
        setEditGiItems(record.items.map((i: any, index: number) => ({
            key: `item_${index}`,
            id: i.id,
            material_id: i.material_id,
            material: i.material,
            quantity: i.quantity,
            note: i.note,
            supplier_id: i.supplier_id || record.supplier_id || null
        })));
        editGiForm.setFieldsValue({
            pfo_id: record.pfo_id,
            po_id: record.po_id,
            supplier_id: record.supplier_id,
            note: record.note,
            vehicle: record.vehicle
        });
        setIsEditGiModalOpen(true);
    };

    const handleEditGiSubmit = async () => {
        if (!selectedGiForEdit) return;
        try {
            const values = await editGiForm.validateFields();
            await api.put(`/inventory/goods-issue/${selectedGiForEdit.id}`, {
                ...values,
                items: editGiItems
            });
            message.success('Đã cập nhật Phiếu xuất kho!');
            setIsEditGiModalOpen(false);
            fetchData();
        } catch (e: any) {
            message.error(e.response?.data?.message || 'Lỗi cập nhật Phiếu xuất kho');
        }
    };

    // --- SHIPPING CARRIER CRUD ---
    const openCarrierModal = (carrier?: any) => {
        if (carrier) {
            setEditingCarrier(carrier);
            carrierForm.setFieldsValue(carrier);
        } else {
            setEditingCarrier(null);
            carrierForm.resetFields();
        }
        setIsCarrierModalOpen(true);
    };

    const handleSaveCarrier = async () => {
        try {
            const values = await carrierForm.validateFields();
            if (editingCarrier) {
                await api.put(`/inventory/shipping-carriers/${editingCarrier.id}`, values);
                message.success('Đã cập nhật đơn vị vận chuyển');
            } else {
                await api.post('/inventory/shipping-carriers', values);
                message.success('Đã thêm đơn vị vận chuyển');
            }
            setIsCarrierModalOpen(false);
            fetchData();
        } catch (e) {
            message.error('Lỗi lưu đơn vị vận chuyển');
        }
    };

    const handleDeleteCarrier = async (id: number) => {
        try {
            await api.delete(`/inventory/shipping-carriers/${id}`);
            message.success('Đã xóa đơn vị vận chuyển');
            fetchData();
        } catch (e) {
            message.error('Lỗi xóa');
        }
    };

    // --- PREPARE DATA TỔNG HỢP ---
    const masterData = useMemo(() => {
        const prodList = products.map(p => ({ ...p, item_type: 'PRODUCT', key: `P_${p.id}` }));
        const matList = materials.map(m => ({ ...m, item_type: 'MATERIAL', key: `M_${m.id}` }));
        return [...prodList, ...matList];
    }, [products, materials]);

    // --- LỌC DATA THEO SEARCH TEXT & FILTER ---
    const filteredMasterData = useMemo(() => {
        let data = masterData;

        // 1. Filter Text
        if (searchText) {
            const lower = searchText.toLowerCase();
            data = data.filter(item =>
                (item.name && item.name.toLowerCase().includes(lower)) ||
                (item.sku && item.sku.toLowerCase().includes(lower)) ||
                (item.code && item.code.toLowerCase().includes(lower))
            );
        }

        // 2. Filter Negative
        if (showNegativeOnly) {
            // Logic: Nếu đang xem All -> check total stock < 0. Nếu đang xem kho con -> check stock in that warehouse (nhưng logic kho con nằm ở getDataByWarehouse).
            // Tuy nhiên filteredMasterData là nguồn chung.
            // Giải pháp: Ở đây ta chỉ lọc những item mà CÓ ÍT NHẤT 1 kho bị âm HOẶC tổng âm?
            // Đơn giản nhất: Lọc những item có quantity_in_stock < 0 (Tổng âm).
            // User request: "tìm các sản phẩm đang bị âm số lượng". Thường là tổng âm hoặc âm kho.
            // Hãy check quantity_in_stock < 0.
            data = data.filter(item => Number(item.quantity_in_stock || 0) < 0);
        }

        return data;
    }, [masterData, searchText, showNegativeOnly]);

    // --- HÀM LỌC DATA THEO KHO ---
    const getDataByWarehouse = (whCode: string) => {
        const whConfig = WAREHOUSES.find(w => w.code === whCode);
        if (!whConfig) return [];
        let data = filteredMasterData.filter(item => whConfig.allowedTypes.includes(item.item_type));

        // Fix: Đối với Kho Lỗi, Kho Thanh Lý, Kho BTP, chỉ hiển thị những sản phẩm có tồn kho khác 0
        if (whCode === 'KHO_LOI' || whCode === 'KHO_THANH_LY' || whCode === 'KHO_BTP') {
            data = data.filter(item => getStockQty(item.item_type, item.id, whCode) !== 0);
        }

        return data;
    };

    // ...



    // Cột hiển thị linh động theo Kho
    const getStockColumns = (whCode?: string) => [
        {
            title: 'Phân loại', dataIndex: 'item_type', width: 100,
            render: (t: string) => t === 'PRODUCT' ? <Tag color="blue">Sản phẩm</Tag> : <Tag color="cyan">Nguyên liệu</Tag>
        },
        { title: 'Mã', dataIndex: 'sku', render: (t: any, r: any) => <b>{t || r.code}</b> },
        { title: 'Tên hàng', dataIndex: 'name', render: (val: string, r: any) => {
            if (whCode === 'KHO_BTP' && r.item_type === 'PRODUCT') {
                const btpStock = stocks.find(s => s.item_type === 'PRODUCT' && Number(s.item_id) === Number(r.id) && s.warehouse_code === 'KHO_BTP');
                if (btpStock && btpStock.btp_name) {
                    return <span style={{ color: '#1890ff', fontWeight: 500 }}>{btpStock.btp_name}</span>;
                }
            }
            return val;
        } },
        { title: 'ĐVT', dataIndex: 'unit', align: 'center' as const, width: 80 },
        {
            title: whCode ? `Tồn ${WAREHOUSES.find(w => w.code === whCode)?.name}` : 'Tổng Tồn Hệ Thống',
            key: 'qty', align: 'right' as const, width: 150,
            render: (_: any, r: any) => {
                const qty = whCode
                    ? getStockQty(r.item_type, r.id, whCode)
                    : Number(r.quantity_in_stock || 0); // Nếu xem tất cả thì lấy tổng

                return <Tag color={qty > 0 ? 'green' : 'red'} style={{ fontSize: 14, fontWeight: 'bold' }}>{qty.toLocaleString()}</Tag>
            }
        },
        {
            title: '', key: 'action', align: 'center' as const, width: 180,
            render: (_: any, r: any) => (
                <Space>
                    <Button size="small" icon={<SwapOutlined />} onClick={() => {
                        form.setFieldsValue({
                            itemType: r.item_type,
                            itemId: r.id,
                            type: 'IMPORT',
                            warehouse: whCode || 'KHO_TP' // Default
                        });
                        setIsModalOpen(true);
                    }}>Đ/C</Button>

                    {/* KHO LỖI: HIỆN NÚT XỬ LÝ */}
                    {whCode === 'KHO_LOI' && (
                        <>
                            <Button size="small" type="primary" ghost icon={<InboxOutlined />} title="Tái nhập kho tốt" onClick={() => openTransferModal(r, 'RE_IMPORT')} />
                            <Button size="small" danger icon={<ShopOutlined />} title="Thanh lý" onClick={() => openTransferModal(r, 'LIQUIDATE')} />
                        </>
                    )}

                    {/* KHO BTP: NÚT CHUYỂN ĐỔI */}
                    {whCode === 'KHO_BTP' && r.item_type === 'PRODUCT' && (
                        <Button size="small" type="primary" ghost icon={<SwapOutlined />} title="Chuyển đổi BTP" onClick={() => openConvertBtpModal(r)} />
                    )}

                    {/* KHO THƯỜNG HOẶC ALL: HIỆN NÚT BÁO LỖI (CHỈ CHO PRODUCT) */}
                    {whCode !== 'KHO_LOI' && whCode !== 'KHO_THANH_LY' && r.item_type === 'PRODUCT' && (
                        <Button size="small" type="dashed" danger icon={<AlertOutlined />} title="Báo lỗi (Chuyển sang Kho Lỗi)" onClick={() => openTransferModal(r, 'REPORT_DEFECT')} />
                    )}
                </Space>
            )
        }
    ];

    const historyColumns = [
        { title: 'Thời gian', dataIndex: 'created_at', width: 140, render: (t: any) => <span style={{ fontSize: 12 }}>{dayjs(t).format('DD/MM/YY HH:mm')}</span> },
        { title: 'Kho', dataIndex: 'warehouse', width: 120, render: (w: string) => { const wh = WAREHOUSES.find(x => x.code === w); return <Tag color={wh?.color}>{wh?.name || w}</Tag> } },
        { title: 'GD', dataIndex: 'type', width: 80, render: (t: string) => t === 'IMPORT' ? <span style={{ color: 'green' }}><ArrowDownOutlined /> Nhập</span> : <span style={{ color: 'red' }}><ArrowUpOutlined /> Xuất</span> },
        { title: 'Mã Hàng', dataIndex: 'item_code', width: 120, render: (t: any) => <b>{t}</b> },
        { title: 'SL', dataIndex: 'quantity', align: 'right' as const, width: 80, render: (v: any, r: any) => <b style={{ color: r.type === 'IMPORT' ? 'green' : 'red' }}>{r.type === 'IMPORT' ? '+' : '-'}{Number(v).toLocaleString()}</b> },
        { title: 'Tồn sau', dataIndex: 'balance_after', align: 'right' as const, width: 80, render: (v: any) => Number(v).toLocaleString() },
        { title: 'Ref', dataIndex: 'reference_code', render: (t: any) => <Tag>{t}</Tag> },
        { title: 'Người Cập Nhật', dataIndex: 'updated_by', width: 130, render: (t: any) => t ? <Tag color="blue">{t}</Tag> : '-' },
        { title: 'Note', dataIndex: 'note' }
    ];

    // List item cho Select trong Modal (Chỉ hiện item đúng loại đã chọn)
    const itemList = useMemo(() => {
        if (itemType === 'PRODUCT') return products.map(p => ({ label: `${p.sku} - ${p.name}`, value: p.id }));
        if (itemType === 'MATERIAL') return materials.map(m => ({ label: `${m.code} - ${m.name}`, value: m.id }));
        return [];
    }, [itemType, products, materials]);

    // --- ADMIN RESET ---

    const handleSystemReset = async () => {
        if (resetCode !== 'RESET') return message.error('Mã xác nhận không đúng');
        try {
            await api.post('/inventory/reset');
            message.success('Hệ thống kho đã được Reset về 0');
            setIsResetModalOpen(false);
            setResetCode('');
            fetchData();
        } catch (e) { message.error('Lỗi reset hệ thống'); }
    };

    return (
        <div>
            {/* --- DASHBOARD MINI - HORIZONTAL SCROLL ON MOBILE --- */}
            <div style={{ overflowX: isMobile ? 'auto' : 'visible', marginBottom: 16 }}>
                <Row gutter={[isMobile ? 8 : 16, 8]} wrap={!isMobile} style={{ flexWrap: isMobile ? 'nowrap' : 'wrap', minWidth: isMobile ? 700 : 'auto' }}>
                    {WAREHOUSES.map(wh => {
                        const whData = getDataByWarehouse(wh.code);
                        const totalInWh = whData.reduce((sum, item) => sum + getStockQty(item.item_type, item.id, wh.code), 0);
                        return (
                            <Col flex={isMobile ? '140px' : 1} key={wh.code}>
                                <Card size="small" bodyStyle={{ padding: isMobile ? 8 : 12 }} style={{ borderTop: `3px solid ${wh.color}` }}>
                                    <Statistic
                                        title={<span style={{ fontSize: isMobile ? 11 : 14 }}>{wh.name.split('.')[1] || wh.name}</span>}
                                        value={totalInWh}
                                        valueStyle={{ color: wh.color, fontSize: isMobile ? 16 : 24 }}
                                        prefix={<AppstoreOutlined />}
                                        suffix="đv"
                                    />
                                </Card>
                            </Col>
                        )
                    })}
                </Row>
            </div>

            <Card
                bodyStyle={{ padding: isMobile ? '8px 12px' : undefined }}
                title={<span style={{ fontSize: isMobile ? 14 : 16 }}>Kho Hàng</span>}
                extra={
                    isMobile ? (
                        <Space size={4}>
                            <Input.Search
                                placeholder="Tìm..."
                                onSearch={val => setSearchText(val)}
                                onChange={e => setSearchText(e.target.value)}
                                style={{ width: 120 }}
                                allowClear
                            />
                            <Button icon={<ReloadOutlined />} onClick={fetchData} />
                        </Space>
                    ) : (
                        <Space>
                            <Tag color="gold" style={{ fontSize: 14, padding: '5px 10px' }}>
                                Tổng giá trị: <b>{filteredMasterData.reduce((sum, item) => sum + (Number(item.quantity_in_stock || 0) * Number(item.cost_price || item.cost_per_unit || 0)), 0).toLocaleString()} ₫</b>
                            </Tag>
                            <Divider type="vertical" />
                            <Input.Search
                                placeholder="Tìm tên SP / SKU..."
                                onSearch={val => setSearchText(val)}
                                onChange={e => setSearchText(e.target.value)}
                                style={{ width: 250 }}
                                allowClear
                            />
                            <Checkbox checked={showNegativeOnly} onChange={e => setShowNegativeOnly(e.target.checked)} style={{ marginLeft: 10 }}>
                                <span style={{ color: showNegativeOnly ? 'red' : 'inherit' }}>Chỉ hiện tồn âm</span>
                            </Checkbox>
                            <Divider type="vertical" />
                            <Button type="primary" icon={<SwapOutlined />} onClick={() => { form.resetFields(); setIsModalOpen(true) }}>Điều Chỉnh Kho</Button>
                            <Button icon={<ReloadOutlined />} onClick={fetchData}>Làm mới</Button>
                            <Button type="text" danger icon={<AlertOutlined />} onClick={() => setIsResetModalOpen(true)} title="Admin Reset System" />
                        </Space>
                    )
                }
            >
                <Tabs activeKey={activeTab} onChange={setActiveTab} type="card">
                    {/* TAB TỔNG HỢP: HIỆN TẤT CẢ */}
                    <Tabs.TabPane tab={<span><AppstoreOutlined /> Toàn bộ hệ thống</span>} key="ALL_STOCKS">
                        <Table dataSource={filteredMasterData} columns={getStockColumns()} size="small" rowKey="key" pagination={{ pageSize: 10 }} />
                    </Tabs.TabPane>

                    {/* CÁC TAB KHO CON: LỌC THEO LOGIC */}
                    {WAREHOUSES.map(wh => (
                        <Tabs.TabPane tab={<span style={{ color: wh.color }}>{wh.name}</span>} key={wh.code}>
                            <Table
                                dataSource={getDataByWarehouse(wh.code)} // <--- LỌC DỮ LIỆU Ở ĐÂY
                                columns={getStockColumns(wh.code)}
                                size="small"
                                rowKey="key"
                                pagination={{ pageSize: 10 }}
                            />
                        </Tabs.TabPane>
                    ))}

                    {/* TAB LỊCH SỬ */}
                    <Tabs.TabPane tab={<span><HistoryOutlined /> Nhật Ký GD</span>} key="HISTORY">
                        <Table dataSource={history} columns={historyColumns} size="small" rowKey="id" pagination={{ pageSize: 15 }} />
                    </Tabs.TabPane>

                    {/* TAB YÊU CẦU XUẤT KHO (New) */}
                    <Tabs.TabPane tab={<span><ArrowUpOutlined /> Yêu cầu Xuất kho <Badge count={pendingDeliveries.length} offset={[5, 0]} /></span>} key="EXPORT_REQUESTS">
                        <Table
                            dataSource={pendingDeliveries}
                            rowKey="id"
                            size="small"
                            expandable={{
                                expandedRowRender: record => (
                                    <Table
                                        dataSource={record.items}
                                        size="small"
                                        pagination={false}
                                        columns={[
                                            { title: 'SKU', dataIndex: 'sku', render: (t: any) => <b>{t}</b> },
                                            { title: 'Số lượng', dataIndex: 'quantity', render: (v: number) => <b>{Number(v).toLocaleString()}</b> },
                                            {
                                                title: 'Tồn kho thực tế',
                                                render: (_: any, item: any) => {
                                                    const prod = products.find(p => p.sku === item.sku);
                                                    return <b>{prod ? Number(prod.quantity_in_stock || 0).toLocaleString() : '-'}</b>;
                                                }
                                            },
                                            {
                                                title: 'Tồn kho khả dụng',
                                                render: (_: any, item: any) => {
                                                    const prod = products.find(p => p.sku === item.sku);
                                                    const qty = Number(prod?.quantity_in_stock || 0);
                                                    const approved = Number(prod?.approved_booking_stock || 0);
                                                    return <b>{(qty - approved).toLocaleString()}</b>;
                                                }
                                            },
                                            {
                                                title: 'Booking',
                                                render: (_: any, item: any) => {
                                                    const prod = products.find(p => p.sku === item.sku);
                                                    return <b>{prod ? Number(prod.booking_stock || 0).toLocaleString() : '-'}</b>;
                                                }
                                            },
                                            {
                                                title: 'Approve',
                                                render: (_: any, item: any) => {
                                                    const prod = products.find(p => p.sku === item.sku);
                                                    return <b>{prod ? Number(prod.approved_booking_stock || 0).toLocaleString() : '-'}</b>;
                                                }
                                            },
                                            { title: 'Ghi chú', dataIndex: 'note' },
                                        ]}
                                    />
                                )
                            }}
                            columns={[
                                { title: 'Mã PXK', dataIndex: 'code', render: (t: any) => <b>{t}</b> },
                                { title: 'Đơn hàng', render: (r: any) => <Tag color="blue">{r.sales_order?.order_code}</Tag> },
                                { title: 'Khách hàng', render: (r: any) => r.sales_order?.customer?.name || r.sales_order?.customer_name },
                                { title: 'Ngày giao', dataIndex: 'delivery_date', render: (t: any) => dayjs(t).format('DD/MM/YYYY') },
                                { title: 'Ghi chú', dataIndex: 'note' },
                                {
                                    title: 'Thao tác', render: (r: any) => (
                                        <Popconfirm title="Xác nhận đủ hàng và xuất kho?" onConfirm={() => handleConfirmExport(r.id)}>
                                            <Button type="primary" danger size="small" icon={<CheckCircleOutlined />}>Xuất Kho</Button>
                                        </Popconfirm>
                                    )
                                }
                            ]}
                        />
                    </Tabs.TabPane>

                    {/* TAB DANH SÁCH PHIẾU XUẤT KHO ĐÃ HOÀN THÀNH (New) */}
                    <Tabs.TabPane tab={<span><CheckCircleOutlined /> Phiếu Xuất kho</span>} key="COMPLETED_EXPORTS">
                        <Table
                            dataSource={completedDeliveries}
                            rowKey="id"
                            size="small"
                            expandable={{
                                expandedRowRender: record => (
                                    <Table
                                        dataSource={record.items}
                                        size="small"
                                        pagination={false}
                                        columns={[
                                            { title: 'SKU', dataIndex: 'sku', render: (t: any) => <b>{t}</b> },
                                            { title: 'Số lượng', dataIndex: 'quantity', render: (v: number) => <b>{Number(v).toLocaleString()}</b> },
                                            { title: 'Ghi chú', dataIndex: 'note' },
                                        ]}
                                    />
                                )
                            }}
                            columns={[
                                { title: 'Mã PXK', dataIndex: 'code', render: (t: any) => <b>{t}</b> },
                                { title: 'Đơn hàng', render: (r: any) => <Tag color="blue">{r.sales_order?.order_code}</Tag> },
                                { title: 'Khách hàng', render: (r: any) => r.sales_order?.customer?.name || r.sales_order?.customer_name },
                                { title: 'Ngày giao', dataIndex: 'delivery_date', render: (t: any) => dayjs(t).format('DD/MM/YYYY') },
                                { title: 'Trạng thái', dataIndex: 'status', render: () => <Tag color="green">Đã xuất kho</Tag> },
                                { title: 'Ghi chú', dataIndex: 'note' }
                            ]}
                        />
                    </Tabs.TabPane>

                    {/* TAB PHIẾU XUẤT NPL (GIA CÔNG) */}
                    <Tabs.TabPane tab={<span><AppstoreOutlined /> Phiếu Xuất NPL (Gia Công) {goodsIssues.filter(g => g.status === 'DRAFT').length > 0 && <Tag color="blue" style={{ borderRadius: 10, marginLeft: 4 }}>{goodsIssues.filter(g => g.status === 'DRAFT').length}</Tag>}</span>} key="GOODS_ISSUE">
                        <Table
                            dataSource={goodsIssues}
                            rowKey="id"
                            size="small"
                            expandable={{
                                expandedRowRender: record => (
                                    <Table
                                        dataSource={record.items}
                                        size="small"
                                        pagination={false}
                                        columns={[
                                            { title: 'NPL', dataIndex: ['material', 'name'] },
                                            { title: 'Mã NPL', dataIndex: ['material', 'code'] },
                                            { title: 'Số lượng xuất', dataIndex: 'quantity', render: (v: number) => <b>{Number(v).toLocaleString()}</b> },
                                        ]}
                                    />
                                )
                            }}
                            columns={[
                                { title: 'Mã PXK', dataIndex: 'code', render: (t: any) => <b>{t}</b> },
                                { title: 'PO / Plan', render: (r: any) => r.po_id ? <Tag color="blue">PO #{r.po_id}</Tag> : '-' },
                                { title: 'Nhà Gia Công', render: (r: any) => {
                                    if (r.status === 'DRAFT') {
                                        return (
                                            <Select 
                                                size="small" 
                                                style={{ width: 150 }} 
                                                value={selectedSuppliers[r.id] || r.supplier_id} 
                                                onChange={(val) => setSelectedSuppliers(prev => ({ ...prev, [r.id]: val }))}
                                                placeholder="Chọn nhà gia công"
                                                showSearch
                                                optionFilterProp="children"
                                                allowClear
                                            >
                                                {suppliers.map(s => <Option key={s.id} value={s.id}>{s.name || s.supplier_name}</Option>)}
                                            </Select>
                                        );
                                    }
                                    return r.supplier?.name || '-';
                                } },
                                { title: 'Loại', dataIndex: 'type', render: (t: any) => t === 'OUTSOURCING' ? <Tag color="orange">Gia công</Tag> : <Tag>{t}</Tag> },
                                { title: 'Trạng thái', dataIndex: 'status', render: (t: any) => {
                                    if (t === 'DRAFT') return <Tag color="blue">Nháp</Tag>;
                                    if (t === 'CONFIRMED') return <Tag color="orange">Đã duyệt (Chờ giao)</Tag>;
                                    if (t === 'DELIVERED') return <Tag color="green">Đã nhận (NCC)</Tag>;
                                    return <Tag>{t}</Tag>;
                                }},
                                { title: 'Ngày tạo', dataIndex: 'created_at', render: (t: any) => dayjs(t).format('DD/MM/YY HH:mm') },
                                { title: 'Ghi chú', dataIndex: 'note' },
                                {
                                    title: 'Thao tác', render: (r: any) => (
                                        <Space>
                                            {r.status === 'DRAFT' && (
                                                <Button type="primary" size="small" icon={<CheckCircleOutlined />} onClick={() => openConfirmGiModal(r)}>Xác nhận xuất</Button>
                                            )}
                                            <Button size="small" icon={<EditOutlined />} onClick={() => openEditGiModal(r)}>Sửa</Button>
                                            {r.status === 'CONFIRMED' && (
                                                <Popconfirm title="Đã giao đến NCC thành công?" onConfirm={async () => {
                                                    try {
                                                        await api.post(`/inventory/goods-issue/${r.id}/delivered`);
                                                        message.success('Đã xác nhận giao hàng!');
                                                        fetchData();
                                                    } catch (e: any) {
                                                        message.error(e.response?.data?.message || 'Lỗi xác nhận');
                                                    }
                                                }}>
                                                    <Button style={{backgroundColor:'#52c41a', color:'#fff'}} size="small" icon={<CarOutlined />}>Đã giao NCC</Button>
                                                </Popconfirm>
                                            )}
                                            <Popconfirm
                                                title="Xóa phiếu xuất kho này? (Nếu phiếu bị trùng hoặc không dùng)"
                                                okText="Xóa"
                                                cancelText="Hủy"
                                                okButtonProps={{ danger: true }}
                                                onConfirm={async () => {
                                                    try {
                                                        await api.delete(`/inventory/goods-issue/${r.id}`);
                                                        message.success('Đã xóa phiếu xuất kho thành công');
                                                        fetchData();
                                                    } catch (e: any) {
                                                        message.error(e.response?.data?.message || 'Lỗi xóa phiếu xuất kho');
                                                    }
                                                }}
                                            >
                                                <Button size="small" danger icon={<DeleteOutlined />}>Xóa</Button>
                                            </Popconfirm>
                                        </Space>
                                    )
                                }
                            ]}
                        />
                    </Tabs.TabPane>

                    {/* TAB PHIẾU NHẬP KHO CHỜ DUYỆT */}
                    <Tabs.TabPane tab={<span><InboxOutlined /> Nhập Kho Chờ Duyệt <Badge count={pendingReceipts.length} offset={[5, 0]} /></span>} key="RECEIPTS">
                        <Table
                            dataSource={pendingReceipts}
                            rowKey="id"
                            size="small"
                            expandable={{
                                defaultExpandAllRows: true,
                                expandedRowRender: record => (
                                    <div style={{ margin: '6px 0', background: '#fafafa', padding: '10px 14px', borderRadius: 6, border: '1px solid #e8e8e8' }}>
                                        <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontWeight: 600, color: '#1890ff', fontSize: 13 }}>
                                                📋 Chi tiết hàng hóa & Quản lý giao hàng theo PO (Ma trận Cây / Cuộn / Kiện):
                                            </span>
                                        </div>
                                        <Table
                                            dataSource={record.items}
                                            rowKey="id"
                                            size="small"
                                            pagination={false}
                                            scroll={{ x: 1100 }}
                                            columns={[
                                                { 
                                                    title: 'Mã PO Form', 
                                                    width: 80, 
                                                    align: 'center', 
                                                    render: (_: any, item: any, idx: number) => {
                                                        const info = getReceiptItemDeliveryInfo(record, item, idx);
                                                        return <b>{info.poFormCode}</b>;
                                                    } 
                                                },
                                                { 
                                                    title: 'Tên NPL / Sản phẩm', 
                                                    width: 220,
                                                    render: (_: any, item: any) => {
                                                        const name = item.material?.name || item.product?.name || item.material?.code || item.product?.sku || '-';
                                                        const unit = item.material?.unit || item.product?.unit || '';
                                                        return (
                                                            <div>
                                                                <span style={{ fontWeight: 600 }}>{name}</span>
                                                                {unit && <Tag color="default" style={{ marginLeft: 6, fontSize: 11 }}>{unit}</Tag>}
                                                            </div>
                                                        );
                                                    } 
                                                },
                                                { 
                                                    title: 'Mã NPL / SKU', 
                                                    width: 140,
                                                    render: (_: any, item: any) => item.material?.code || item.product?.sku || item.product?.code || '-' 
                                                },
                                                { 
                                                    title: 'Tổng SL ĐM', 
                                                    width: 90, 
                                                    align: 'right', 
                                                    render: (_: any, item: any, idx: number) => {
                                                        const info = getReceiptItemDeliveryInfo(record, item, idx);
                                                        return <b>{info.normQty > 0 ? info.normQty.toLocaleString() : '-'}</b>;
                                                    } 
                                                },
                                                { 
                                                    title: 'Tổng SL đặt', 
                                                    width: 90, 
                                                    align: 'right', 
                                                    render: (_: any, item: any, idx: number) => {
                                                        const info = getReceiptItemDeliveryInfo(record, item, idx);
                                                        return <b style={{ color: '#1890ff' }}>{info.orderQty > 0 ? info.orderQty.toLocaleString() : '-'}</b>;
                                                    } 
                                                },
                                                { 
                                                    title: 'Tổng SL giao', 
                                                    width: 90, 
                                                    align: 'right', 
                                                    render: (_: any, item: any, idx: number) => {
                                                        const info = getReceiptItemDeliveryInfo(record, item, idx);
                                                        return <b style={{ color: '#52c41a', fontSize: 13 }}>{info.deliveryQty.toLocaleString()}</b>;
                                                    } 
                                                },
                                                {
                                                    title: 'N1',
                                                    children: [
                                                        { 
                                                            title: 'Đặt', 
                                                            width: 50, 
                                                            align: 'center', 
                                                            render: (_: any, item: any, idx: number) => {
                                                                const info = getReceiptItemDeliveryInfo(record, item, idx);
                                                                return info.matrix.n1.order !== null && info.matrix.n1.order !== undefined && info.matrix.n1.order !== '' ? info.matrix.n1.order : '-';
                                                            } 
                                                        },
                                                        { 
                                                            title: 'Giao', 
                                                            width: 55, 
                                                            align: 'center', 
                                                            render: (_: any, item: any, idx: number) => {
                                                                const info = getReceiptItemDeliveryInfo(record, item, idx);
                                                                const val = info.matrix.n1.delivery;
                                                                return val !== null && val !== undefined && val !== '' ? <b style={{ color: '#52c41a' }}>{val}</b> : <span style={{ color: '#bfbfbf' }}>0</span>;
                                                            } 
                                                        }
                                                    ]
                                                },
                                                {
                                                    title: 'N2',
                                                    children: [
                                                        { 
                                                            title: 'Đặt', 
                                                            width: 50, 
                                                            align: 'center', 
                                                            render: (_: any, item: any, idx: number) => {
                                                                const info = getReceiptItemDeliveryInfo(record, item, idx);
                                                                return info.matrix.n2.order !== null && info.matrix.n2.order !== undefined && info.matrix.n2.order !== '' ? info.matrix.n2.order : '-';
                                                            } 
                                                        },
                                                        { 
                                                            title: 'Giao', 
                                                            width: 55, 
                                                            align: 'center', 
                                                            render: (_: any, item: any, idx: number) => {
                                                                const info = getReceiptItemDeliveryInfo(record, item, idx);
                                                                const val = info.matrix.n2.delivery;
                                                                return val !== null && val !== undefined && val !== '' ? <b style={{ color: '#52c41a' }}>{val}</b> : <span style={{ color: '#bfbfbf' }}>0</span>;
                                                            } 
                                                        }
                                                    ]
                                                },
                                                {
                                                    title: 'C1',
                                                    children: [
                                                        { 
                                                            title: 'Đặt', 
                                                            width: 50, 
                                                            align: 'center', 
                                                            render: (_: any, item: any, idx: number) => {
                                                                const info = getReceiptItemDeliveryInfo(record, item, idx);
                                                                return info.matrix.c1.order !== null && info.matrix.c1.order !== undefined && info.matrix.c1.order !== '' ? info.matrix.c1.order : '-';
                                                            } 
                                                        },
                                                        { 
                                                            title: 'Giao', 
                                                            width: 55, 
                                                            align: 'center', 
                                                            render: (_: any, item: any, idx: number) => {
                                                                const info = getReceiptItemDeliveryInfo(record, item, idx);
                                                                const val = info.matrix.c1.delivery;
                                                                return val !== null && val !== undefined && val !== '' ? <b style={{ color: '#52c41a' }}>{val}</b> : <span style={{ color: '#bfbfbf' }}>0</span>;
                                                            } 
                                                        }
                                                    ]
                                                },
                                                {
                                                    title: 'C2',
                                                    children: [
                                                        { 
                                                            title: 'Đặt', 
                                                            width: 50, 
                                                            align: 'center', 
                                                            render: (_: any, item: any, idx: number) => {
                                                                const info = getReceiptItemDeliveryInfo(record, item, idx);
                                                                return info.matrix.c2.order !== null && info.matrix.c2.order !== undefined && info.matrix.c2.order !== '' ? info.matrix.c2.order : '-';
                                                            } 
                                                        },
                                                        { 
                                                            title: 'Giao', 
                                                            width: 55, 
                                                            align: 'center', 
                                                            render: (_: any, item: any, idx: number) => {
                                                                const info = getReceiptItemDeliveryInfo(record, item, idx);
                                                                const val = info.matrix.c2.delivery;
                                                                return val !== null && val !== undefined && val !== '' ? <b style={{ color: '#52c41a' }}>{val}</b> : <span style={{ color: '#bfbfbf' }}>0</span>;
                                                            } 
                                                        }
                                                    ]
                                                },
                                                {
                                                    title: 'G1',
                                                    children: [
                                                        { 
                                                            title: 'Đặt', 
                                                            width: 50, 
                                                            align: 'center', 
                                                            render: (_: any, item: any, idx: number) => {
                                                                const info = getReceiptItemDeliveryInfo(record, item, idx);
                                                                return info.matrix.g1.order !== null && info.matrix.g1.order !== undefined && info.matrix.g1.order !== '' ? info.matrix.g1.order : '-';
                                                            } 
                                                        },
                                                        { 
                                                            title: 'Giao', 
                                                            width: 55, 
                                                            align: 'center', 
                                                            render: (_: any, item: any, idx: number) => {
                                                                const info = getReceiptItemDeliveryInfo(record, item, idx);
                                                                const val = info.matrix.g1.delivery;
                                                                return val !== null && val !== undefined && val !== '' ? <b style={{ color: '#52c41a' }}>{val}</b> : <span style={{ color: '#bfbfbf' }}>0</span>;
                                                            } 
                                                        }
                                                    ]
                                                },
                                                {
                                                    title: 'G2',
                                                    children: [
                                                        { 
                                                            title: 'Đặt', 
                                                            width: 50, 
                                                            align: 'center', 
                                                            render: (_: any, item: any, idx: number) => {
                                                                const info = getReceiptItemDeliveryInfo(record, item, idx);
                                                                return info.matrix.g2.order !== null && info.matrix.g2.order !== undefined && info.matrix.g2.order !== '' ? info.matrix.g2.order : '-';
                                                            } 
                                                        },
                                                        { 
                                                            title: 'Giao', 
                                                            width: 55, 
                                                            align: 'center', 
                                                            render: (_: any, item: any, idx: number) => {
                                                                const info = getReceiptItemDeliveryInfo(record, item, idx);
                                                                const val = info.matrix.g2.delivery;
                                                                return val !== null && val !== undefined && val !== '' ? <b style={{ color: '#52c41a' }}>{val}</b> : <span style={{ color: '#bfbfbf' }}>0</span>;
                                                            } 
                                                        }
                                                    ]
                                                },
                                                {
                                                    title: 'Kiện lẻ',
                                                    children: [
                                                        { 
                                                            title: 'Đặt', 
                                                            width: 50, 
                                                            align: 'center', 
                                                            render: (_: any, item: any, idx: number) => {
                                                                const info = getReceiptItemDeliveryInfo(record, item, idx);
                                                                return info.matrix.odd.order !== null && info.matrix.odd.order !== undefined && info.matrix.odd.order !== '' ? info.matrix.odd.order : '-';
                                                            } 
                                                        },
                                                        { 
                                                            title: 'Giao', 
                                                            width: 55, 
                                                            align: 'center', 
                                                            render: (_: any, item: any, idx: number) => {
                                                                const info = getReceiptItemDeliveryInfo(record, item, idx);
                                                                const val = info.matrix.odd.delivery;
                                                                return val !== null && val !== undefined && val !== '' ? <b style={{ color: '#52c41a' }}>{val}</b> : <span style={{ color: '#bfbfbf' }}>0</span>;
                                                            } 
                                                        }
                                                    ]
                                                },
                                                {
                                                    title: 'Kiện viền',
                                                    children: [
                                                        { 
                                                            title: 'Đặt', 
                                                            width: 50, 
                                                            align: 'center', 
                                                            render: (_: any, item: any, idx: number) => {
                                                                const info = getReceiptItemDeliveryInfo(record, item, idx);
                                                                return info.matrix.border.order !== null && info.matrix.border.order !== undefined && info.matrix.border.order !== '' ? info.matrix.border.order : '-';
                                                            } 
                                                        },
                                                        { 
                                                            title: 'Giao', 
                                                            width: 55, 
                                                            align: 'center', 
                                                            render: (_: any, item: any, idx: number) => {
                                                                const info = getReceiptItemDeliveryInfo(record, item, idx);
                                                                const val = info.matrix.border.delivery;
                                                                return val !== null && val !== undefined && val !== '' ? <b style={{ color: '#52c41a' }}>{val}</b> : <span style={{ color: '#bfbfbf' }}>0</span>;
                                                            } 
                                                        }
                                                    ]
                                                }
                                            ]}
                                        />
                                    </div>
                                )
                            }}
                            columns={[
                                { 
                                    title: 'Mã Phiếu', 
                                    dataIndex: 'code', 
                                    width: 170,
                                    render: (t: any) => <b style={{ color: '#1890ff' }}>{t}</b> 
                                },
                                { 
                                    title: 'PO Liên Quan & Đối Tác', 
                                    width: 280,
                                    render: (r: any) => {
                                        const custName = getReceiptCustomerName(r);
                                        const suppName = getReceiptSupplierName(r);
                                        const poCode = r.purchase_order?.po_code || (r.po_id ? `PO #${r.po_id}` : '-');
                                        return (
                                            <div>
                                                <div>
                                                    <Tag color="blue" style={{ fontWeight: 600 }}>{poCode}</Tag>
                                                    {suppName && <span style={{ color: '#555', fontSize: 12 }}>🏭 {suppName}</span>}
                                                </div>
                                                {custName && (
                                                    <div style={{ marginTop: 2, fontSize: 12, color: '#722ed1' }}>
                                                        👤 KH: <b>{custName}</b>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }
                                },
                                {
                                    title: 'Tổng SL Đặt (PO)',
                                    width: 130,
                                    align: 'right',
                                    render: (r: any) => {
                                        const totalOrder = (r.items || []).reduce((acc: number, item: any, idx: number) => {
                                            const info = getReceiptItemDeliveryInfo(r, item, idx);
                                            return acc + Number(info.orderQty || 0);
                                        }, 0);
                                        return <b style={{ color: '#1890ff' }}>{totalOrder > 0 ? totalOrder.toLocaleString() : '-'}</b>;
                                    }
                                },
                                {
                                    title: 'Tổng SL Giao (PNK)',
                                    width: 140,
                                    align: 'right',
                                    render: (r: any) => {
                                        const totalDelivery = (r.items || []).reduce((acc: number, item: any) => acc + Number(item.quantity || 0), 0);
                                        return <b style={{ color: '#52c41a', fontSize: 13 }}>{totalDelivery.toLocaleString()}</b>;
                                    }
                                },
                                { 
                                    title: 'Ngày tạo', 
                                    dataIndex: 'created_at', 
                                    width: 130,
                                    render: (t: any) => dayjs(t).format('DD/MM/YY HH:mm') 
                                },
                                { 
                                    title: 'Ghi chú', 
                                    dataIndex: 'note',
                                    render: (t: string) => t || '-'
                                },
                                {
                                    title: 'Thao tác', 
                                    width: 170,
                                    render: (r: any) => (
                                        <Space>
                                            <Button type="primary" size="small" icon={<CheckCircleOutlined />} onClick={() => openConfirmReceiptModal(r)}>Nhập Kho</Button>
                                            <Popconfirm title="Bạn có chắc chắn muốn hủy phiếu nhập này?" onConfirm={() => handleDeleteReceipt(r.id)}>
                                                <Button danger size="small" icon={<DeleteOutlined />}>Hủy</Button>
                                            </Popconfirm>
                                        </Space>
                                    )
                                }
                            ]}
                        />
                    </Tabs.TabPane>

                    {/* TAB ĐƠN VỊ VẬN CHUYỂN */}
                    <Tabs.TabPane tab={<span><CarOutlined /> Đơn vị vận chuyển</span>} key="CARRIERS">
                        <div style={{ marginBottom: 10 }}>
                            <Button type="primary" icon={<PlusOutlined />} onClick={() => openCarrierModal()}>Thêm ĐVVC</Button>
                        </div>
                        <Table
                            dataSource={shippingCarriers}
                            rowKey="id"
                            size="small"
                            columns={[
                                { title: 'Mã', dataIndex: 'code', width: 100, render: (t: any) => <b>{t}</b> },
                                { title: 'Tên đơn vị', dataIndex: 'name' },
                                { title: 'SĐT', dataIndex: 'phone', width: 120 },
                                { title: 'Website', dataIndex: 'website', render: (t: any) => t ? <a href={t} target="_blank" rel="noreferrer">{t}</a> : '-' },
                                { title: 'Trạng thái', dataIndex: 'is_active', width: 100, render: (v: boolean) => v ? <Tag color="green">Hoạt động</Tag> : <Tag color="red">Đã tắt</Tag> },
                                {
                                    title: '', width: 100, render: (_: any, r: any) => (
                                        <Space>
                                            <Button size="small" icon={<EditOutlined />} onClick={() => openCarrierModal(r)} />
                                            <Popconfirm title="Xóa đơn vị này?" onConfirm={() => handleDeleteCarrier(r.id)}>
                                                <Button size="small" danger icon={<DeleteOutlined />} />
                                            </Popconfirm>
                                        </Space>
                                    )
                                }
                            ]}
                        />
                    </Tabs.TabPane>
                </Tabs>
            </Card>

            {/* MODAL ĐIỀU CHỈNH */}
            <Modal title="Phiếu Điều Chỉnh Kho" open={isModalOpen} onCancel={() => setIsModalOpen(false)} onOk={() => form.submit()} okText="Xác nhận">
                <Form form={form} layout="vertical" onFinish={handleAdjust} initialValues={{ type: 'IMPORT', itemType: 'PRODUCT', warehouse: 'KHO_TP', quantity: 1 }}>

                    <Form.Item name="warehouse" label="Chọn Kho tác động" rules={[{ required: true }]}>
                        <Select>
                            {WAREHOUSES.map(w => <Option key={w.code} value={w.code}>{w.name}</Option>)}
                        </Select>
                    </Form.Item>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="type" label="Hành động">
                                <Radio.Group buttonStyle="solid">
                                    <Radio.Button value="IMPORT">NHẬP (+)</Radio.Button>
                                    <Radio.Button value="EXPORT">XUẤT (-)</Radio.Button>
                                </Radio.Group>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="itemType" label="Loại hàng">
                                <Select><Option value="PRODUCT">Sản phẩm</Option><Option value="MATERIAL">Nguyên liệu</Option></Select>
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item name="itemId" label="Mã hàng" rules={[{ required: true }]}>
                        <Select showSearch optionFilterProp="label" options={itemList} placeholder="Tìm kiếm..." />
                    </Form.Item>

                    <Row gutter={16}>
                        <Col span={12}><Form.Item name="quantity" label="Số lượng" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
                        <Col span={12}><Form.Item name="ref" label="Mã tham chiếu"><Input placeholder="VD: KK-01" /></Form.Item></Col>
                    </Row>
                    <Form.Item name="note" label="Ghi chú"><Input.TextArea rows={2} /></Form.Item>
                </Form>
            </Modal>

            {/* MODAL RESET ADMIN */}
            <Modal
                title={<span style={{ color: 'red' }}><AlertOutlined /> DANGER ZONE: Reset Inventory</span>}
                open={isResetModalOpen}
                onCancel={() => setIsResetModalOpen(false)}
                onOk={handleSystemReset}
                okText="Xác nhận XÓA HẾT"
                okButtonProps={{ danger: true }}
            >
                <div style={{ background: '#fff1f0', padding: 15, borderRadius: 8, border: '1px solid #ffccc7', marginBottom: 15 }}>
                    <p><b>Cảnh báo:</b> Hành động này sẽ:</p>
                    <ul>
                        <li>Xóa toàn bộ lịch sử giao dịch kho (History).</li>
                        <li>Xóa sạch số lượng tồn kho chi tiết trong các kho (Stocks).</li>
                        <li>Đưa số lượng tồn của TẤT CẢ Sản phẩm và Nguyên liệu về 0.</li>
                    </ul>
                    <p style={{ color: 'red', fontWeight: 'bold' }}>Dữ liệu không thể khôi phục!</p>
                </div>
                <Form layout="vertical">
                    <Form.Item label="Nhập chữ 'RESET' để xác nhận">
                        <Input value={resetCode} onChange={e => setResetCode(e.target.value)} placeholder="RESET" />
                    </Form.Item>
                </Form>
            </Modal>

            {/* MODAL CHUYỂN KHO (TRANSFER) */}
            <Modal
                title={transferTarget?.title}
                open={isTransferModalOpen}
                onCancel={() => setIsTransferModalOpen(false)}
                onOk={handleTransfer}
                okText="Xác nhận Chuyển"
            >
                <Form form={transferForm} layout="vertical">
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item label="Từ Kho">
                                <Input value={WAREHOUSES.find(w => w.code === transferTarget?.fromWh)?.name} disabled style={{ color: 'red', fontWeight: 'bold' }} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="Đến Kho">
                                <Input value={WAREHOUSES.find(w => w.code === transferTarget?.toWh)?.name} disabled style={{ color: 'green', fontWeight: 'bold' }} />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="quantity" label="Số lượng chuyển" rules={[{ required: true }]}>
                                <InputNumber style={{ width: '100%' }} min={1} />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item name="note" label="Ghi chú / Lý do">
                        <Input.TextArea rows={2} placeholder="VD: Hàng bị móp méo / Đã sửa xong..." />
                    </Form.Item>
                </Form>
            </Modal>

            {/* MODAL CHUYỂN ĐỔI BTP */}
            <Modal
                title={`Chuyển đổi BTP: ${convertBtpTarget?.name || ''}`}
                open={isConvertBtpModalOpen}
                onCancel={() => setIsConvertBtpModalOpen(false)}
                onOk={handleConvertBtp}
                okText="Xác nhận Chuyển đổi"
            >
                <div style={{ background: '#e6f7ff', padding: 12, borderRadius: 8, marginBottom: 16 }}>
                    <InfoCircleOutlined style={{ color: '#1890ff', marginRight: 8 }} />
                    Tính năng này cho phép chuyển đổi tồn kho BTP của biến thể này sang biến thể khác <b>cùng sản phẩm cha</b>.
                </div>
                <Form form={convertBtpForm} layout="vertical">
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="sourceSku" label="Mã BTP Nguồn (Bị trừ)" rules={[{ required: true }]}>
                                <Input disabled style={{ fontWeight: 'bold', color: 'red' }} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="quantity" label="Số lượng chuyển" rules={[{ required: true, message: 'Nhập số lượng' }]}>
                                <InputNumber style={{ width: '100%' }} min={1} max={convertBtpTarget ? getStockQty('PRODUCT', convertBtpTarget.id, 'KHO_BTP') : undefined} />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item name="targetSku" label="Chọn Mã BTP Đích (Được cộng)" rules={[{ required: true, message: 'Chọn mã đích' }]}>
                        <Select
                            showSearch
                            optionFilterProp="children"
                            placeholder="Chọn biến thể đích..."
                        >
                            {products
                                .filter(p => p.name === convertBtpTarget?.name && p.sku !== convertBtpTarget?.sku)
                                .map(p => (
                                    <Option key={p.sku} value={p.sku}>{p.sku} - {p.name}</Option>
                                ))
                            }
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>

            {/* MODAL ĐƠN VỊ VẬN CHUYỂN */}
            <Modal
                title={editingCarrier ? 'Cập nhật ĐVVC' : 'Thêm Đơn vị vận chuyển'}
                open={isCarrierModalOpen}
                onCancel={() => setIsCarrierModalOpen(false)}
                onOk={handleSaveCarrier}
                okText="Lưu"
            >
                <Form form={carrierForm} layout="vertical" initialValues={{ is_active: true }}>
                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item name="code" label="Mã" rules={[{ required: true }]}>
                                <Input placeholder="VD: GHTK" />
                            </Form.Item>
                        </Col>
                        <Col span={16}>
                            <Form.Item name="name" label="Tên đơn vị" rules={[{ required: true }]}>
                                <Input placeholder="VD: Giao Hàng Tiết Kiệm" />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="phone" label="Số điện thoại">
                                <Input placeholder="Hotline" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="website" label="Website">
                                <Input placeholder="https://..." />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item name="tracking_url" label="URL tra cứu vận đơn">
                        <Input placeholder="VD: https://ghtk.vn/tracking?code={code}" />
                    </Form.Item>
                    <Form.Item name="is_active" valuePropName="checked">
                        <Checkbox>Đang hoạt động</Checkbox>
                    </Form.Item>
                </Form>
            </Modal>

            {/* MODAL XÁC NHẬN NHẬP KHO */}
            <Modal
                title="Xác nhận nhận hàng & Nhập kho"
                open={isConfirmReceiptModalOpen}
                onCancel={() => setIsConfirmReceiptModalOpen(false)}
                onOk={handleConfirmReceipt}
                okText="Xác nhận Nhập Kho"
                width={800}
            >
                <Form form={confirmReceiptForm} layout="vertical">
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="actual_receive_date" label="Ngày nhận hàng thực tế" rules={[{ required: true }]}>
                                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="shipping_fee" label="Phí vận chuyển (VND)">
                                <InputNumber
                                    style={{ width: '100%' }}
                                    formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                    parser={value => value?.replace(/\$\s?|(,*)/g, '') as unknown as number}
                                    min={0}
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item name="delivery_note_url" label="Link / URL Phiếu giao hàng (Hoặc ghi chú file)">
                        <Input placeholder="Nhập đường dẫn lưu trữ file hoặc ghi chú..." />
                    </Form.Item>

                    <Divider orientation="left">Chi tiết hàng hóa thực nhận</Divider>
                    {selectedReceipt && (
                        <Table
                            dataSource={selectedReceipt.items}
                            rowKey="id"
                            size="small"
                            pagination={false}
                            columns={[
                                { 
                                    title: 'Vật tư / SP', 
                                    render: (r: any) => {
                                        const name = r.material?.name || r.product?.name || '-';
                                        const unit = r.material?.unit || r.product?.unit || '';
                                        return (
                                            <div>
                                                <b>{name}</b>
                                                {unit && <Tag style={{ marginLeft: 6, fontSize: 11 }}>{unit}</Tag>}
                                            </div>
                                        );
                                    } 
                                },
                                { title: 'Mã', render: (r: any) => r.material?.code || r.product?.sku || r.product?.code || '-' },
                                {
                                    title: 'Tổng SL Đặt',
                                    align: 'right',
                                    render: (_: any, r: any, idx: number) => {
                                        const info = getReceiptItemDeliveryInfo(selectedReceipt, r, idx);
                                        return <b style={{ color: '#1890ff' }}>{info.orderQty > 0 ? info.orderQty.toLocaleString() : '-'}</b>;
                                    }
                                },
                                { 
                                    title: 'SL Giao (PNK)', 
                                    dataIndex: 'quantity', 
                                    align: 'right', 
                                    render: (v: number) => <b style={{ color: '#52c41a' }}>{Number(v).toLocaleString()}</b> 
                                },
                                {
                                    title: 'Ma trận Giao hàng',
                                    render: (_: any, r: any, idx: number) => {
                                        const info = getReceiptItemDeliveryInfo(selectedReceipt, r, idx);
                                        const m = info.matrix;
                                        const parts: string[] = [];
                                        if (m.n1.delivery) parts.push(`N1: ${m.n1.delivery}`);
                                        if (m.n2.delivery) parts.push(`N2: ${m.n2.delivery}`);
                                        if (m.c1.delivery) parts.push(`C1: ${m.c1.delivery}`);
                                        if (m.c2.delivery) parts.push(`C2: ${m.c2.delivery}`);
                                        if (m.g1.delivery) parts.push(`G1: ${m.g1.delivery}`);
                                        if (m.g2.delivery) parts.push(`G2: ${m.g2.delivery}`);
                                        if (m.odd.delivery) parts.push(`Kiện lẻ: ${m.odd.delivery}`);
                                        if (m.border.delivery) parts.push(`Kiện viền: ${m.border.delivery}`);
                                        if (parts.length === 0) return <span style={{ color: '#bfbfbf' }}>-</span>;
                                        return <Tag color="green">{parts.join(', ')}</Tag>;
                                    }
                                },
                                {
                                    title: 'SỐ LƯỢNG THỰC NHẬN',
                                    align: 'center',
                                    render: (r: any) => (
                                        <Form.Item
                                            name={`quantity_${r.id}`}
                                            noStyle
                                            rules={[{ required: true, message: 'Nhập số lượng' }]}
                                        >
                                            <InputNumber min={0} style={{ width: 110, fontWeight: 600 }} />
                                        </Form.Item>
                                    )
                                }
                            ]}
                        />
                    )}
                </Form>
            </Modal>

            {/* MODAL XÁC NHẬN XUẤT NPL */}
            <Modal
                title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 32 }}>
                        <span>Xác nhận xuất kho NPL - {selectedGiForConfirm?.code || ''}</span>
                        {getGiCustomerName(selectedGiForConfirm) && (
                            <span style={{ fontSize: 14, fontWeight: 'normal', color: '#666' }}>
                                KH: <b style={{ color: '#1890ff' }}>{getGiCustomerName(selectedGiForConfirm)}</b>
                            </span>
                        )}
                    </div>
                }
                open={isConfirmGiModalOpen}
                onCancel={() => setIsConfirmGiModalOpen(false)}
                onOk={handleConfirmGiSubmit}
                width={900}
                okText="Xác nhận"
                cancelText="Hủy"
            >
                <div style={{ marginBottom: 16 }}>
                    <span style={{ marginRight: 8, fontWeight: 'bold' }}>Gán nhanh nhà gia công:</span>
                    <Select
                        style={{ width: 250 }}
                        placeholder="Chọn nhà gia công chung"
                        allowClear
                        showSearch
                        optionFilterProp="children"
                        value={bulkSupplierId}
                        onChange={(val) => {
                            setBulkSupplierId(val);
                            setConfirmGiItems(prev => prev.map(item => ({ ...item, supplier_id: val })));
                        }}
                    >
                        {suppliers.map(s => <Option key={s.id} value={s.id}>{s.name || s.supplier_name}</Option>)}
                    </Select>
                </div>
                <Table
                    dataSource={confirmGiItems}
                    rowKey="id"
                    size="small"
                    pagination={false}
                    columns={[
                        { title: 'Tên NPL', dataIndex: ['material', 'name'] },
                        { title: 'Mã NPL', dataIndex: ['material', 'code'] },
                        { title: 'SL Yêu cầu', dataIndex: 'original_quantity', render: (v: number) => <b>{Number(v).toLocaleString()}</b> },
                        {
                            title: 'Tồn kho',
                            render: (_: any, r: any) => {
                                const mat = materials.find(m => m.id === r.material_id);
                                return <b>{mat ? Number(mat.quantity_in_stock || 0).toLocaleString() : '-'}</b>;
                            }
                        },
                        {
                            title: 'Thực cấp',
                            width: 120,
                            render: (_: any, r: any, index: number) => (
                                <InputNumber
                                    min={0}
                                    value={r.quantity}
                                    onChange={(val) => {
                                        const newItems = [...confirmGiItems];
                                        newItems[index].quantity = val || 0;
                                        setConfirmGiItems(newItems);
                                    }}
                                />
                            )
                        },
                        {
                            title: 'Nhà gia công',
                            width: 250,
                            render: (_: any, r: any, index: number) => (
                                <Select
                                    style={{ width: '100%' }}
                                    placeholder="Chọn NGC"
                                    allowClear
                                    showSearch
                                    optionFilterProp="children"
                                    value={r.supplier_id}
                                    onChange={(val) => {
                                        const newItems = [...confirmGiItems];
                                        newItems[index].supplier_id = val;
                                        setConfirmGiItems(newItems);
                                    }}
                                >
                                    {suppliers.map(s => <Option key={s.id} value={s.id}>{s.name || s.supplier_name}</Option>)}
                                </Select>
                            )
                        }
                    ]}
                />
            </Modal>

            {/* MODAL SỬA PHIẾU XUẤT NPL */}
            <Modal
                title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 32 }}>
                        <span>Sửa phiếu xuất kho NPL - {selectedGiForEdit?.code || ''}</span>
                        {(() => {
                            const currentPfoId = editGiForm.getFieldValue('pfo_id');
                            const currentPoId = editGiForm.getFieldValue('po_id');
                            let custName = '';
                            if (currentPfoId) {
                                const pfo = productionPlans.find(p => p.id === currentPfoId);
                                custName = pfo?.sales_order?.customer?.name || pfo?.sales_order?.customer_name || '';
                            }
                            if (!custName && currentPoId) {
                                const po = purchaseOrders.find(p => p.id === currentPoId);
                                custName = po?.pfo?.sales_order?.customer?.name || po?.pfo?.sales_order?.customer_name || '';
                            }
                            if (!custName) custName = getGiCustomerName(selectedGiForEdit);
                            return custName ? (
                                <span style={{ fontSize: 14, fontWeight: 'normal', color: '#666' }}>
                                    KH: <b style={{ color: '#1890ff' }}>{custName}</b>
                                </span>
                            ) : null;
                        })()}
                    </div>
                }
                open={isEditGiModalOpen}
                onCancel={() => setIsEditGiModalOpen(false)}
                onOk={handleEditGiSubmit}
                width={900}
                okText="Lưu thay đổi"
                cancelText="Hủy"
            >
                <Form form={editGiForm} layout="vertical">
                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item name="pfo_id" label="Lệnh SX (PFO)">
                                <Select showSearch allowClear optionFilterProp="children" placeholder="Chọn Lệnh SX">
                                    {productionPlans.map(p => {
                                        const custName = p.sales_order?.customer?.name || p.sales_order?.customer_name || '';
                                        return <Option key={p.id} value={p.id}>{p.code}{custName ? ` - ${custName}` : ''}</Option>;
                                    })}
                                </Select>
                            </Form.Item>
                            {(() => {
                                const selectedPfoId = editGiForm.getFieldValue('pfo_id');
                                const selectedPfo = selectedPfoId ? productionPlans.find(p => p.id === selectedPfoId) : null;
                                const custName = selectedPfo?.sales_order?.customer?.name || selectedPfo?.sales_order?.customer_name;
                                return custName ? <div style={{ marginTop: -16, marginBottom: 8, fontSize: 12, color: '#1890ff' }}>KH: <b>{custName}</b></div> : null;
                            })()}
                        </Col>
                        <Col span={8}>
                            <Form.Item name="po_id" label="PO Gia công">
                                <Select 
                                    showSearch 
                                    allowClear 
                                    optionFilterProp="children" 
                                    placeholder="Chọn PO"
                                    onChange={(val) => {
                                        if (val) {
                                            const po = purchaseOrders.find(p => p.id === val);
                                            if (po && po.supplier_id) {
                                                editGiForm.setFieldsValue({ supplier_id: po.supplier_id });
                                            }
                                        }
                                    }}
                                >
                                    {purchaseOrders.map(p => {
                                        const custName = p.pfo?.sales_order?.customer?.name || p.pfo?.sales_order?.customer_name || '';
                                        return (
                                            <Option key={p.id} value={p.id}>
                                                {p.po_code} {p.supplier ? `- ${p.supplier.name || p.supplier.supplier_name}` : ''}{custName ? ` (${custName})` : ''}
                                            </Option>
                                        );
                                    })}
                                </Select>
                            </Form.Item>
                            {(() => {
                                const selectedPoId = editGiForm.getFieldValue('po_id');
                                const selectedPo = selectedPoId ? purchaseOrders.find(p => p.id === selectedPoId) : null;
                                const custName = selectedPo?.pfo?.sales_order?.customer?.name || selectedPo?.pfo?.sales_order?.customer_name;
                                return custName ? <div style={{ marginTop: -16, marginBottom: 8, fontSize: 12, color: '#1890ff' }}>KH: <b>{custName}</b></div> : null;
                            })()}
                        </Col>
                        <Col span={8}>
                            <Form.Item name="supplier_id" label="Nhà Gia công (Mặc định)">
                                <Select showSearch allowClear optionFilterProp="children" placeholder="Chọn NGC">
                                    {suppliers.map(s => <Option key={s.id} value={s.id}>{s.name || s.supplier_name}</Option>)}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="note" label="Ghi chú">
                                <Input.TextArea rows={2} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="vehicle" label="Phương tiện/Biển số">
                                <Input />
                            </Form.Item>
                        </Col>
                    </Row>
                </Form>
                
                {selectedGiForEdit?.status === 'DRAFT' ? (
                    <div style={{ marginBottom: 16 }}>
                        <Select
                            showSearch
                            style={{ width: 300, marginRight: 8 }}
                            placeholder="Thêm NPL vào phiếu..."
                            optionFilterProp="children"
                            onChange={(val) => {
                                const mat = materials.find(m => m.id === val);
                                if (mat) {
                                    setEditGiItems([...editGiItems, {
                                        key: `new_${Date.now()}`,
                                        material_id: mat.id,
                                        material: mat,
                                        quantity: 1,
                                        note: ''
                                    }]);
                                }
                            }}
                            value={null}
                        >
                            {materials.map(m => (
                                <Option key={m.id} value={m.id}>{m.code} - {m.name}</Option>
                            ))}
                        </Select>
                    </div>
                ) : (
                    <Alert type="warning" message="Phiếu đã chốt, không thể thay đổi danh sách vật tư và số lượng" style={{ marginBottom: 16 }} />
                )}
                <Table
                    dataSource={editGiItems}
                    rowKey="key"
                    size="small"
                    pagination={false}
                    columns={[
                        { title: 'Tên NPL', dataIndex: ['material', 'name'] },
                        { title: 'Mã NPL', dataIndex: ['material', 'code'] },
                        {
                            title: 'Số lượng xuất',
                            width: 150,
                            render: (_: any, r: any, index: number) => (
                                <InputNumber
                                    min={0.01}
                                    step={0.01}
                                    value={r.quantity}
                                    disabled={selectedGiForEdit?.status !== 'DRAFT'}
                                    onChange={(val) => {
                                        const newItems = [...editGiItems];
                                        newItems[index].quantity = val || 0;
                                        setEditGiItems(newItems);
                                    }}
                                />
                            )
                        },
                        {
                            title: '',
                            width: 60,
                            render: (_: any, r: any, index: number) => (
                                <Button
                                    danger
                                    size="small"
                                    icon={<DeleteOutlined />}
                                    disabled={selectedGiForEdit?.status !== 'DRAFT'}
                                    onClick={() => {
                                        const newItems = [...editGiItems];
                                        newItems.splice(index, 1);
                                        setEditGiItems(newItems);
                                    }}
                                />
                            )
                        }
                    ]}
                />
            </Modal>
        </div>
    );
};

export default InventoryPage;