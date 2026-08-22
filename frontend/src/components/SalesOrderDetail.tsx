import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, DatePicker, Button, Tabs, Row, Col, InputNumber, Divider, message, Tag, Popconfirm, Tooltip, Checkbox, Table, Switch, Dropdown, MenuProps } from 'antd';
import { Drawer } from 'antd';
import { PlusOutlined, SaveOutlined, CheckCircleOutlined, InfoCircleOutlined, MoreOutlined, HistoryOutlined, CopyOutlined, DeleteOutlined, LinkOutlined, PrinterOutlined, FileTextOutlined, AppstoreAddOutlined, LockOutlined, MenuOutlined, FileExcelOutlined } from '@ant-design/icons';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import api from '../utils/api';
import dayjs from 'dayjs';
import SalesPayments from './sales/SalesPayments';
import SalesDeliveries from './sales/SalesDeliveries';
import SalesComments from './sales/SalesComments';
import SalesChecklistPanel from './SalesChecklistPanel';
import SalesOrderItemsTable from './sales/SalesOrderItemsTable';
import CancelOrderModal from './sales/CancelOrderModal';
import RevisionHistoryModal from './sales/RevisionHistoryModal';
import QuotationHistoryTab from './sales/QuotationHistoryTab';
import SampleImagesTab from './sales/SampleImagesTab';
import ContractBuilderModal from './sales/ContractBuilderModal';
import SalesActivityLogsTab from './sales/SalesActivityLogsTab';
import useMobile from '../hooks/useMobile';

const { Option } = Select;

interface Props {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialData?: any;
    customers: any[];
    products: any[];
    users?: any[];
    isQuotation?: boolean;
    defaultCommentTab?: string;  // For deep linking from notifications
    highlightCommentId?: string; // Comment to highlight/scroll to
}

const SalesOrderDetail: React.FC<Props> = ({ open, onClose, onSuccess, initialData, customers, products, users = [], isQuotation = false, defaultCommentTab, highlightCommentId }) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('1');
    const [orderItems, setOrderItems] = useState<any[]>([]);
    const [totalAmount, setTotalAmount] = useState(0);
    const isMobile = useMobile();

    // Cancel Modal State
    const [cancelModalOpen, setCancelModalOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState('');

    // Revisions State
    const [revisions, setRevisions] = useState<any[]>([]);
    const [revisionModalOpen, setRevisionModalOpen] = useState(false);

    // Copy Quotation State
    const [customerQuotations, setCustomerQuotations] = useState<any[]>([]);
    const [copyQuotationModalOpen, setCopyQuotationModalOpen] = useState(false);

    // Contract State
    const [contractTemplates, setContractTemplates] = useState<any[]>([]);
    const [contractBuilderOpen, setContractBuilderOpen] = useState(false);

    // Quote Terms State
    const [quoteTermsList, setQuoteTermsList] = useState<any[]>([]);

    const [exportingExcel, setExportingExcel] = useState(false);

    const handleExportExcel = async () => {
        try {
            setExportingExcel(true);
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet(isQuotation ? 'Bao_Gia' : 'Don_Hang');

            sheet.columns = [
                { header: '', key: 'stt', width: 6 },
                { header: '', key: 'hinh', width: 12 },
                { header: '', key: 'ten', width: 25 },
                { header: '', key: 'mota', width: 35 },
                { header: '', key: 'dvt', width: 8 },
                { header: '', key: 'sl', width: 8 },
                { header: '', key: 'dongia', width: 15 },
                { header: '', key: 'thanhtien', width: 15 },
            ];

            // Row 1: Logo & Title
            const r1 = sheet.addRow(['NỆM MẦM NON ERP4U', '', '', '', isQuotation ? 'BẢNG BÁO GIÁ' : 'ĐƠN ĐẶT HÀNG']);
            sheet.mergeCells('A1:D1');
            sheet.mergeCells('E1:H1');
            r1.getCell(1).font = { bold: true, size: 16, color: { argb: 'FF0070C0' } };
            r1.getCell(5).font = { bold: true, size: 18, color: { argb: 'FF0070C0' } };
            r1.getCell(5).alignment = { horizontal: 'center' };

            // Row 2: Company & Quote Number
            const r2 = sheet.addRow(['CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ TƯỜNG LINH', '', '', '', `Số: ${initialData?.order_code || 'New'}`]);
            sheet.mergeCells('A2:D2');
            sheet.mergeCells('E2:H2');
            r2.getCell(1).font = { bold: true, color: { argb: 'FF555555' } };
            r2.getCell(5).alignment = { horizontal: 'center' };

            // Row 3: Date
            const dateStrDay = dayjs(form.getFieldValue('order_date')).format('DD');
            const dateStrMonth = dayjs(form.getFieldValue('order_date')).format('MM');
            const dateStrYear = dayjs(form.getFieldValue('order_date')).format('YYYY');
            const r3 = sheet.addRow(['', '', '', '', `Ngày ${dateStrDay} tháng ${dateStrMonth} năm ${dateStrYear}`]);
            sheet.mergeCells('A3:D3');
            sheet.mergeCells('E3:H3');
            r3.getCell(5).alignment = { horizontal: 'center' };
            r3.getCell(5).font = { italic: true };

            sheet.addRow([]);

            // Row 5: Ben Ban / Ben Mua Titles
            const r5 = sheet.addRow(['BÊN BÁN:', '', '', '', 'BÊN MUA:']);
            sheet.mergeCells('A5:D5');
            sheet.mergeCells('E5:H5');
            r5.getCell(1).font = { bold: true, color: { argb: 'FF0070C0' } };
            r5.getCell(5).font = { bold: true, color: { argb: 'FFD2691E' } };

            // Row 6: Address
            const r6 = sheet.addRow(['74/21/24 Nguyễn Khuyến, Phường 12, Bình Thạnh, HCM', '', '', '', form.getFieldValue('vat_company_name') || initialData?.customer?.legal_name || initialData?.customer?.name || '']);
            sheet.mergeCells('A6:D6');
            sheet.mergeCells('E6:H6');
            r6.getCell(5).font = { bold: true };

            // Row 7: Phone / Address
            const r7 = sheet.addRow(['SĐT: 0983.882210 - 0983.796654', '', '', '', 'Địa chỉ: ' + (form.getFieldValue('vat_address') || initialData?.customer?.legal_address || initialData?.customer?.address || '')]);
            sheet.mergeCells('A7:D7');
            sheet.mergeCells('E7:H7');
            r7.getCell(5).alignment = { wrapText: true };

            // Row 8: MST / Phone
            const r8 = sheet.addRow(['MST: 0311.874.522', '', '', '', 'SĐT: ' + (form.getFieldValue('contact_phone') || initialData?.customer?.phone || '')]);
            sheet.mergeCells('A8:D8');
            sheet.mergeCells('E8:H8');

            // Row 9: Email / MST
            const r9 = sheet.addRow(['Email: erp4uerp4u@gmail.com', '', '', '', 'MST: ' + (form.getFieldValue('vat_tax_code') || initialData?.customer?.tax_code || '')]);
            sheet.mergeCells('A9:D9');
            sheet.mergeCells('E9:H9');

            // Row 10: Sale Agent
            const r10 = sheet.addRow(['Sale Agent: ' + (initialData?.assigned_to?.full_name || 'ERP4U')]);
            sheet.mergeCells('A10:D10');
            
            sheet.addRow([]);

            const th = sheet.addRow(['STT', 'HÌNH', 'TÊN SẢN PHẨM', 'MÔ TẢ SẢN PHẨM', 'ĐVT', 'SL', 'ĐƠN GIÁ', 'THÀNH TIỀN']);
            th.eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF004E98' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            });

            const getDirectLink = (url: string) => {
                if (!url) return '';
                if (url.includes('drive.google.com')) {
                    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
                    if (match && match[1]) return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w500`;
                }
                return url;
            };

            const downloadImage = async (url: string) => {
                try {
                    const res = await api.get(`/proxy-image?url=${encodeURIComponent(url)}`, { responseType: 'arraybuffer' });
                    return res.data;
                } catch (e) {
                    return null;
                }
            };

            let rowIdx = sheet.rowCount + 1;
            for (let i = 0; i < orderItems.length; i++) {
                const item = orderItems[i];
                const tr = sheet.addRow([
                    i + 1,
                    '',
                    item.product_name_real || item.product?.name || item.sku,
                    (item.product?.customer_description || '').replace(/\r\n/g, '\n').replace(/<[^>]*>?/gm, ''), // strip html if any
                    item.product?.unit || 'Cái',
                    item.quantity,
                    item.unit_price,
                    item.total_price
                ]);
                tr.height = 60;
                
                tr.getCell(3).alignment = { wrapText: true, vertical: 'top' };
                tr.getCell(4).alignment = { wrapText: true, vertical: 'top' };
                tr.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
                tr.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };
                tr.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };
                tr.getCell(7).numFmt = '#,##0';
                tr.getCell(8).alignment = { vertical: 'middle', horizontal: 'right' };
                tr.getCell(8).numFmt = '#,##0';

                tr.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                    if (colNumber <= 8) {
                        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                    }
                });

                const imgUrl = getDirectLink(item.product?.image_url);
                if (imgUrl) {
                    const buffer = await downloadImage(imgUrl);
                    if (buffer) {
                        try {
                            const imageId = workbook.addImage({
                                buffer: buffer,
                                extension: imgUrl.toLowerCase().includes('png') ? 'png' : 'jpeg',
                            });
                            sheet.addImage(imageId, {
                                tl: { col: 1.1, row: rowIdx - 1 + 0.1 },
                                ext: { width: 65, height: 65 },
                            });
                        } catch (e) { console.error('Image add error', e); }
                    }
                }
                rowIdx++;
            }

            const totalRow = sheet.addRow(['', '', '', '', '', '', 'Tổng cộng:', totalAmount]);
            totalRow.getCell(7).font = { bold: true };
            totalRow.getCell(8).font = { bold: true };
            totalRow.getCell(8).numFmt = '#,##0';

            const discount = form.getFieldValue('discount_amount') || 0;
            if (discount > 0) {
                const dr = sheet.addRow(['', '', '', '', '', '', 'Chiết khấu:', -discount]);
                dr.getCell(8).numFmt = '#,##0';
            }
            
            const shipping = form.getFieldValue('shipping_fee') || 0;
            if (shipping > 0) {
                const sr = sheet.addRow(['', '', '', '', '', '', 'Phí vận chuyển:', shipping]);
                sr.getCell(8).numFmt = '#,##0';
            }

            const deposit = form.getFieldValue('deposit_amount') || 0;
            if (deposit > 0) {
                const dpr = sheet.addRow(['', '', '', '', '', '', 'Đã cọc:', deposit]);
                dpr.getCell(8).numFmt = '#,##0';
            }
            
            const finalTotal = totalAmount - discount + shipping;
            const remaining = finalTotal - deposit;

            const finalRow = sheet.addRow(['', '', '', '', '', '', 'Thanh toán:', finalTotal]);
            finalRow.getCell(7).font = { bold: true, color: { argb: 'FFFF0000' } };
            finalRow.getCell(8).font = { bold: true, color: { argb: 'FFFF0000' } };
            finalRow.getCell(8).numFmt = '#,##0';
            
            if (deposit > 0) {
                const remRow = sheet.addRow(['', '', '', '', '', '', 'Còn lại:', remaining]);
                remRow.getCell(7).font = { bold: true };
                remRow.getCell(8).font = { bold: true };
                remRow.getCell(8).numFmt = '#,##0';
            }

            // --- FOOTER START ---
            sheet.addRow([]);
            const termsContent = initialData?.terms_content || form.getFieldValue('terms_content') || '';
            if (termsContent) {
                const termTitleRow = sheet.addRow(['Điều khoản & Quy định']);
                termTitleRow.getCell(1).font = { bold: true, italic: true };
                
                const tr = sheet.addRow([termsContent.replace(/<[^>]*>?/gm, '')]); // strip HTML just in case
                sheet.mergeCells(`A${tr.number}:H${tr.number}`);
                tr.height = (termsContent.split('\n').length + 1) * 15;
                tr.getCell(1).alignment = { wrapText: true, vertical: 'top' };
                sheet.addRow([]);
            }

            const sigRow = sheet.addRow(['ĐẠI DIỆN BÊN MUA', '', '', '', '', 'ĐẠI DIỆN BÊN BÁN']);
            sheet.mergeCells(`A${sigRow.number}:C${sigRow.number}`);
            sheet.mergeCells(`F${sigRow.number}:H${sigRow.number}`);
            sigRow.getCell(1).font = { bold: true };
            sigRow.getCell(1).alignment = { horizontal: 'center' };
            sigRow.getCell(6).font = { bold: true };
            sigRow.getCell(6).alignment = { horizontal: 'center' };
            
            const sigTitle = sheet.addRow(['(Ký và ghi rõ họ tên)', '', '', '', '', '(Ký và ghi rõ họ tên)']);
            sheet.mergeCells(`A${sigTitle.number}:C${sigTitle.number}`);
            sheet.mergeCells(`F${sigTitle.number}:H${sigTitle.number}`);
            sigTitle.getCell(1).font = { italic: true };
            sigTitle.getCell(1).alignment = { horizontal: 'center' };
            sigTitle.getCell(6).font = { italic: true };
            sigTitle.getCell(6).alignment = { horizontal: 'center' };
            
            sheet.addRow([]);
            sheet.addRow([]);

            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `${isQuotation ? 'Bao_Gia' : 'Don_Hang'}_${initialData?.order_code || 'New'}.xlsx`);
            message.success('Xuất Excel thành công!');
        } catch (error) {
            console.error('Export Excel Error:', error);
            message.error('Lỗi khi xuất Excel');
        } finally {
            setExportingExcel(false);
        }
    };

    const fetchContractTemplates = async () => {
        try {
            const res = await api.get('/system/templates');
            setContractTemplates(res.data);
        } catch (e) { console.error('Failed to load templates'); }
    };

    useEffect(() => { fetchContractTemplates(); }, []);

    const fetchRevisions = async (id: number) => {
        try {
            const res = await api.get(`/sales/${id}/revisions`);
            setRevisions(res.data);
        } catch (e) { console.error('Failed to load revisions'); }
    }

    useEffect(() => {
        if (open) {
            if (initialData?.id || initialData?.isClone) {
                // --- EDIT OR CLONE MODE ---
                form.setFieldsValue({
                    ...initialData,
                    customer_id: initialData.customer?.id,
                    assigned_to_id: initialData.assigned_to?.id, // Map assigned user
                    order_date: initialData.order_date ? dayjs(initialData.order_date) : dayjs(),
                    delivery_date: initialData.delivery_date ? dayjs(initialData.delivery_date) : null,
                    discount_rate: initialData.discount_rate || 0,
                    discount_amount: initialData.discount_amount || 0,
                    vat_rate: initialData.vat_rate || 0,
                    is_production_sample_approved: initialData.is_production_sample_approved || false,

                    shipping_fee: initialData.shipping_fee || 0,
                    deposit_percent: initialData.deposit_percent || 0,
                    deposit_amount: initialData.deposit_amount || 0,
                    vat_company_name: initialData.vat_company_name || initialData.customer?.legal_name || initialData.customer?.name || '',
                    vat_tax_code: initialData.vat_tax_code || initialData.customer?.tax_code || '',
                    vat_address: initialData.vat_address || initialData.customer?.legal_address || initialData.customer?.address || '',
                    vat_invoice_link: initialData.vat_invoice_link || '',
                    vat_email: initialData.vat_email || initialData.customer?.einvoice_email || '',
                    require_invoice: initialData.require_invoice !== undefined ? initialData.require_invoice : true,

                    contact_name: initialData.contact_name,
                    contact_phone: initialData.contact_phone,
                    ...(initialData?.isClone ? { order_code: '' } : {}) // Reset code if clone
                });

                // FIX LỖI: Map dữ liệu từ Backend (subtotal) sang Frontend (total_price)
                const items = initialData.items?.map((i: any) => {
                    const qty = Number(i.quantity) || 0;
                    const price = Number(i.unit_price) || 0;

                    // Ưu tiên tính toán lại: SL * Đơn giá. Nếu không thì lấy subtotal từ DB.
                    const calculatedTotal = qty * price;

                    return {
                        ...i,
                        key: i.id || `temp-${Date.now()}-${Math.random()}`, // Ensure KEY exists for DragDrop
                        sku: i.product?.sku || i.sku,
                        unit_price: price,
                        quantity: qty,
                        total_price: calculatedTotal > 0 ? calculatedTotal : (Number(i.subtotal) || 0),
                        ...(initialData?.isClone ? { id: undefined, order_id: undefined } : {}) // Reset item IDs if clone
                    };
                }) || [];

                setOrderItems(items);
                calculateTotal(items);

                // Fetch Revisions only if not clone
                if (!initialData?.isClone && initialData?.id) {
                    fetchRevisions(initialData.id);
                }

                const termPrefix = isQuotation ? 'QUOTE' : 'ORDER';
                api.get(`/system/config/${termPrefix}_TERMS_LIST`).catch(() => ({ data: null })).then((listRes) => {
                     if (listRes.data?.value) {
                        try { setQuoteTermsList(JSON.parse(listRes.data.value)); } catch(e) {}
                     }
                });
            } else {
                // --- CREATE MODE ---
                form.resetFields();

                const isInternal = (initialData as any)?.isInternal;

                form.setFieldsValue({
                    order_code: '', // Let backend generate
                    order_date: dayjs(),
                    delivery_date: dayjs().add(25, 'day'), // Default: +25 days from order date
                    status: isQuotation ? 'QUOTATION' : 'SO_PENDING',
                    discount_rate: 0,
                    discount_amount: 0,
                    vat_rate: 0,
                    shipping_fee: 0,
                    // --- AUTO FILL FOR INTERNAL ---
                    customer_id: isInternal ? -1 : undefined, // Use -1 or handle effectively
                    note: isInternal ? 'Đơn nhập kho (Make to Stock)' : '',
                    require_invoice: true
                });

                // Load default terms & note from system config
                const termPrefix = isQuotation ? 'QUOTE' : 'ORDER';
                if (!isInternal) {
                    Promise.all([
                        api.get(`/system/config/${termPrefix}_TERMS_LIST`).catch(() => ({ data: null })),
                        api.get(`/system/config/${termPrefix}_DEFAULT_TERMS`).catch(() => ({ data: null })),
                        api.get(`/system/config/${termPrefix}_DEFAULT_NOTE`).catch(() => ({ data: null })),
                    ]).then(([listRes, termsRes, noteRes]) => {
                        const updates: any = {};
                        let list: any[] = [];
                        if (listRes.data?.value) {
                            try { list = JSON.parse(listRes.data.value); } catch(e) {}
                        }
                        if (list.length === 0 && termsRes.data?.value) {
                            list = [{ id: 'default', name: 'Điều khoản mặc định', content: termsRes.data.value, isDefault: true }];
                        }
                        setQuoteTermsList(list);

                        const defaultTerm = list.find(t => t.isDefault);
                        if (defaultTerm) {
                            updates.terms_content = defaultTerm.content;
                        } else if (termsRes.data?.value) {
                            updates.terms_content = termsRes.data.value;
                        }

                        if (noteRes.data?.value) updates.note = noteRes.data.value;
                        if (Object.keys(updates).length > 0) form.setFieldsValue(updates);
                    });
                } else {
                    // For internal orders, we still want to load terms list so users can change it
                    api.get(`/system/config/${termPrefix}_TERMS_LIST`).catch(() => ({ data: null })).then((listRes) => {
                         if (listRes.data?.value) {
                            try { setQuoteTermsList(JSON.parse(listRes.data.value)); } catch(e) {}
                         }
                    });
                }

                if (isInternal) {
                    // Mock Internal Customer if not exists in list, or just display "Nội Bộ"
                    // Better: Handle in rendering
                }

                setOrderItems([]);
                setTotalAmount(0);
            }
            setActiveTab('1');
        }
    }, [open, initialData, isQuotation]);

    const calculateTotal = (items: any[]) => {
        const subtotal = items.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0);

        const discountAmt = Number(form.getFieldValue('discount_amount')) || 0;
        const vatRate = Number(form.getFieldValue('vat_rate')) || 0;
        const shipping = Number(form.getFieldValue('shipping_fee')) || 0;

        const taxable = Math.max(0, subtotal - discountAmt);
        const total = Math.round(taxable * (1 + vatRate / 100) + shipping);

        setTotalAmount(total);

        // Auto-recalculate deposit amount based on percentage
        const depositPercent = Number(form.getFieldValue('deposit_percent')) || 0;
        if (depositPercent > 0) {
            const autoDepositAmt = Math.round((total * depositPercent) / 100);
            form.setFieldsValue({ deposit_amount: autoDepositAmt });
        }
    };

    const handleAddItem = () => {
        setOrderItems([...orderItems, { key: Date.now(), sku: undefined, quantity: 1, unit_price: 0, total_price: 0 }]);
    };

    const handleFormValuesChange = (changedValues: any) => {
        if (changedValues.customer_id) {
            handleCustomerChange(changedValues.customer_id);
        }
    };

    const currentCustomerId = Form.useWatch('customer_id', form);
    const currentContactName = Form.useWatch('contact_name', form);
    const currentContactPhone = Form.useWatch('contact_phone', form);
    const currentShippingAddress = Form.useWatch('shipping_address', form);
    const selectedCustomer = customers.find(c => c.id === currentCustomerId);
    const customerContacts = selectedCustomer?.contacts || [];

    const handleCustomerChange = async (customerId: number) => {
        const customer = customers.find((c: any) => c.id === customerId);
        if (customer) {
            form.setFieldsValue({
                vat_company_name: customer.legal_name || customer.name || '',
                vat_tax_code: customer.tax_code || '',
                vat_address: customer.legal_address || customer.address || '',
                vat_email: customer.einvoice_email || customer.email || ''
            });
        }
        // Fetch customer's old quotations/orders
        if (isQuotation && customerId && customerId !== -1) {
            try {
                const res = await api.get('/sales');
                const quotes = (res.data || []).filter((o: any) =>
                    o.customer?.id === customerId && o.id !== initialData?.id
                );
                setCustomerQuotations(quotes);
            } catch (e) { setCustomerQuotations([]); }
        } else {
            setCustomerQuotations([]);
        }
    };

    const handleCopyQuotation = async (quotation: any) => {
        try {
            const res = await api.get(`/sales/${quotation.id}`);
            const fullQuotation = res.data;
            const items = (fullQuotation.items || []).map((i: any, idx: number) => ({
                key: Date.now() + idx,
                sku: i.product?.sku || i.sku,
                quantity: Number(i.quantity) || 1,
                unit_price: Number(i.unit_price) || 0,
                total_price: (Number(i.quantity) || 1) * (Number(i.unit_price) || 0),
                note: i.note || '',
                vat_content: i.vat_content || '',
                sample_image: i.sample_image,
                image_url: i.image_url,
                price_ranges: i.price_ranges,
                customer_note: i.customer_note,
                internal_note: i.internal_note
            }));
            setOrderItems(items);
            calculateTotal(items);
            form.setFieldsValue({
                delivery_date: fullQuotation.delivery_date ? dayjs(fullQuotation.delivery_date) : null,
                note: fullQuotation.note || ''
            });
            setCopyQuotationModalOpen(false);
            message.success(`Đã copy ${items.length} sản phẩm từ ${fullQuotation.order_code}`);
        } catch (e) {
            message.error('Lỗi khi tải chi tiết báo giá để copy');
        }
    };

    const handleItemChange = (index: number, field: string, value: any) => {
        const newItems = [...orderItems];
        const item = { ...newItems[index], [field]: value };

        if (field === 'sku') {
            const prod = products.find(p => p.value === value);
            if (prod) {
                item.unit_price = prod.price;
                item.unit = prod.unit;
                item._description = prod.description;
                item._type = prod.type;
                item.image_url = undefined; // Clear custom image to fallback to product default
                
                // Auto-update of vat_content has been removed per user request
            }
        }

        // Tính lại thành tiền ngay khi thay đổi số lượng hoặc đơn giá
        if (field === 'quantity' || field === 'unit_price' || field === 'sku') {
            const qty = Number(item.quantity) || 0;
            const price = Number(item.unit_price) || 0;
            item.total_price = qty * price;
        }

        newItems[index] = item;
        setOrderItems(newItems);
        calculateTotal(newItems);
    };

    const handleRemoveItem = (index: number) => {
        const newItems = orderItems.filter((_: any, i: number) => i !== index);
        setOrderItems(newItems);
        calculateTotal(newItems);
    };

    const handleReorderItems = (newItems: any[]) => {
        setOrderItems(newItems);
    };

    const handleSave = async () => {
        try {
            const values = form.getFieldsValue(true);

            // --- VALIDATION: Check Production Sample Approval ---
            if (values.status === 'IN_PRODUCTION' && !values.is_production_sample_approved) { // Checkbox value
                message.error('Cần duyệt mẫu sản xuất trước khi chuyển sang Đang Sản Xuất!');
                return;
            }

            setLoading(true);
            const payload = {
                ...values,
                order_date: values.order_date ? values.order_date.format('YYYY-MM-DD') : null,
                delivery_date: values.delivery_date ? values.delivery_date.format('YYYY-MM-DD') : null,
                total_amount: totalAmount,
                items: orderItems.map(i => ({
                    sku: i.sku,
                    quantity: i.quantity,
                    unit_price: i.unit_price,
                    vat_content: i.vat_content,
                    sample_image: i.sample_image,
                    image_url: i.image_url, // <--- Add this!
                    total_price: i.total_price, // Frontend gửi total_price, Backend sẽ map vào subtotal
                    price_ranges: i.price_ranges,
                    customer_note: i.customer_note,
                    internal_note: i.internal_note
                }))
            };

            if (initialData?.id) {
                await api.put(`/sales/${initialData.id}`, payload);
                message.success('Cập nhật thành công');
            } else {
                await api.post('/sales', { ...payload, is_quotation: isQuotation });
                message.success(isQuotation ? 'Tạo báo giá thành công' : 'Tạo đơn hàng thành công');
            }
            onSuccess();
            onClose();
        } catch (e) { message.error('Lỗi lưu đơn hàng'); }
        finally { setLoading(false); }
    };

    const handleCompleteOrder = async () => {
        if (!initialData?.id) return;
        try {
            await api.put(`/sales/${initialData.id}`, { status: 'COMPLETED' });
            message.success('Đã hoàn tất đơn hàng'); onSuccess(); onClose();
        } catch (e) { message.error('Lỗi'); }
    };

    const handleApproveSamples = async () => {
        if (!initialData?.id) return;
        try {
            await api.post(`/sales/${initialData.id}/approve-samples`);
            message.success('Đã duyệt mẫu thành công');
            onSuccess();
            onClose();
        } catch (e) {
            message.error('Lỗi khi duyệt mẫu');
        }
    };

    const handleCancelOrder = async () => {
        if (!initialData?.id || !cancelReason) return;
        try {
            await api.post(`/sales/${initialData.id}/cancel`, { reason: cancelReason });
            message.success('Đã hủy đơn hàng');
            setCancelModalOpen(false);
            setCancelReason('');
            onSuccess();
            onClose();
        } catch (e) {
            message.error('Lỗi khi hủy đơn');
        }
    };

    const handleCreateRevision = async () => {
        if (!initialData?.id) return;
        try {
            await api.post(`/sales/${initialData.id}/revision`, {}); // User info handled by interceptor/token
            message.success('Đã tạo phiên bản mới');
            // Reload data
            onSuccess();
            onClose();
        } catch (e) {
            message.error('Lỗi tạo revision');
        }
    };

    const handleCreateProject = async () => {
        if (!initialData?.id) return;
        try {
            setLoading(true);
            await api.post(`/projects/from-so/${initialData.id}`);
            message.success('Đã tạo/cập nhật dự án thành công');
            onSuccess();
        } catch (e: any) {
            message.error(e.response?.data?.message || 'Có lỗi khi tạo dự án');
        } finally {
            setLoading(false);
        }
    };

    const handleBookItems = async () => {
        if (!initialData?.id) return;
        try {
            setLoading(true);
            const res = await api.post(`/sales/${initialData.id}/book-items`);
            if (res.data?.success === false) {
                message.error(res.data.errors?.join(', ') || 'Không thể giữ kho');
            } else {
                message.success(res.data?.message || 'Đã giữ kho (Booking) thành công cho các sản phẩm');
                onSuccess(); // Nạp lại dữ liệu đơn hàng
            }
        } catch (e: any) {
            message.error(e.response?.data?.message || 'Lỗi khi giữ kho (có thể do hết tồn kho khả dụng)');
        } finally {
            setLoading(false);
        }
    };


    const confirmDelete = (type: 'quote' | 'order', id: number) => {
        Modal.confirm({
            title: 'Xác nhận xóa',
            content: `Bạn có chắc chắn muốn xóa ${type === 'quote' ? 'báo giá' : 'đơn hàng'} này?`,
            okText: 'Xóa',
            cancelText: 'Hủy',
            okButtonProps: { danger: true },
            onOk: async () => {
                try {
                    await api.delete(`/sales/${type === 'quote' ? 'quote/' : ''}${id}`);
                    message.success('Đã xóa thành công');
                    onSuccess();
                    onClose();
                } catch (e: any) {
                    message.error(e?.response?.data?.message || 'Lỗi khi xóa');
                }
            }
        });
    };

    return (
        <Drawer
            title={
                <span style={{ fontSize: isMobile ? 14 : 16 }}>
                    {isQuotation ? 'Báo Giá' : 'Đơn Hàng'} #{initialData?.order_code}
                    {initialData?.version > 1 && <Tag color="orange" style={{ marginLeft: 5 }}>v{initialData?.version}</Tag>}
                    {initialData?.status === 'COMPLETED' && <Tag color="green" style={{ marginLeft: 5 }}>Hoàn tất</Tag>}
                </span>
            }
            open={open}
            onClose={onClose}
            width={isMobile ? '100%' : 1100}
            placement="right"
            styles={{ 
                body: { padding: isMobile ? 8 : 24, background: 'rgba(255, 255, 255, 0.4)' },
                header: { background: 'rgba(255, 255, 255, 0.6)', backdropFilter: 'blur(10px)' },
                mask: { backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.2)' }
            }}
            footer={
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' }}>
                    <Button size={isMobile ? 'small' : 'middle'} onClick={onClose}>Đóng</Button>
                    <Button size={isMobile ? 'small' : 'middle'} type="primary" icon={<SaveOutlined />} loading={loading} onClick={handleSave}>
                        {isMobile ? 'Lưu' : 'Lưu Thông Tin'}
                    </Button>
                    {isMobile ? (
                        initialData && (
                            <Dropdown
                                menu={{
                                    items: [
                                        ...(isQuotation ? [
                                            { key: 'rev', label: 'Tạo Version Mới', icon: <CopyOutlined />, onClick: handleCreateRevision },
                                            { key: 'hist', label: 'Lịch sử', icon: <HistoryOutlined />, onClick: () => setRevisionModalOpen(true) },
                                            { key: 'del_q', label: <span style={{color: 'red'}}>Xóa Báo Giá</span>, icon: <DeleteOutlined style={{color: 'red'}}/>, onClick: () => confirmDelete('quote', initialData.id) }
                                        ] : []),
                                        ...(!isQuotation && initialData.status !== 'CANCELLED' && initialData.status !== 'COMPLETED' ? [
                                            { key: 'cancel', label: <span style={{color: 'red'}}>Hủy Đơn</span>, icon: <DeleteOutlined style={{color: 'red'}}/>, onClick: () => setCancelModalOpen(true) }
                                        ] : []),
                                        ...(!isQuotation && initialData.status !== 'CANCELLED' ? [
                                            { key: 'proj', label: 'Tạo Dự án', icon: <AppstoreAddOutlined />, onClick: handleCreateProject }
                                        ] : []),
                                        ...(!isQuotation && initialData.status !== 'CANCELLED' && initialData.status !== 'COMPLETED' ? [
                                            { key: 'book', label: 'Giữ Kho (Book)', icon: <LockOutlined />, onClick: handleBookItems }
                                        ] : []),
                                        ...(!isQuotation && initialData.status === 'SO_PENDING' ? [
                                            { key: 'del_o', label: <span style={{color: 'red'}}>Xóa đơn hàng</span>, icon: <DeleteOutlined style={{color: 'red'}}/>, onClick: () => confirmDelete('order', initialData.id) }
                                        ] : []),
                                        ...(!isQuotation && initialData.status !== 'CANCELLED' ? [
                                            { key: 'comp', label: <span style={{color: '#52c41a'}}>Hoàn tất</span>, icon: <CheckCircleOutlined style={{color: '#52c41a'}}/>, onClick: handleCompleteOrder }
                                        ] : [])
                                    ]
                                }}
                                trigger={['click']}
                                placement="bottomRight"
                            >
                                <Button size="small" icon={<MoreOutlined />}>Thêm</Button>
                            </Dropdown>
                        )
                    ) : (
                        <>
                            {isQuotation && initialData && (
                                <Button size="middle" icon={<CopyOutlined />} onClick={handleCreateRevision}>Tạo Version Mới</Button>
                            )}
                            {isQuotation && initialData && (
                                <Button size="middle" danger icon={<DeleteOutlined />} onClick={() => confirmDelete('quote', initialData.id)}>Xóa Báo Giá</Button>
                            )}
                            {isQuotation && initialData && (
                                <Button size="middle" icon={<HistoryOutlined />} onClick={() => setRevisionModalOpen(true)}>Lịch sử</Button>
                            )}

                            {(!isQuotation && initialData && initialData.status !== 'CANCELLED' && initialData.status !== 'COMPLETED') && (
                                <Button size="middle" danger icon={<DeleteOutlined />} onClick={() => setCancelModalOpen(true)}>Hủy Đơn</Button>
                            )}
                            {(!isQuotation && initialData && initialData.status !== 'CANCELLED') && (
                                <Button size="middle" icon={<AppstoreAddOutlined />} onClick={handleCreateProject}>Tạo Dự án</Button>
                            )}
                            {(!isQuotation && initialData && initialData.status !== 'CANCELLED' && initialData.status !== 'COMPLETED') && (
                                <Button size="middle" icon={<LockOutlined />} onClick={handleBookItems} style={{ borderColor: '#fa8c16', color: '#fa8c16' }}>Giữ Kho (Book)</Button>
                            )}
                            {(!isQuotation && initialData && initialData.status === 'SO_PENDING') && (
                                <Button size="middle" danger type="dashed" icon={<DeleteOutlined />} onClick={() => confirmDelete('order', initialData.id)}>Xóa đơn hàng</Button>
                            )}
                            {(!isQuotation && initialData && initialData.status !== 'CANCELLED') && (
                                <Button size="middle" type="primary" danger icon={<CheckCircleOutlined />} onClick={handleCompleteOrder}>Hoàn tất đơn hàng</Button>
                            )}
                        </>
                    )}
                </div>
            }
        >
            <Tabs activeKey={activeTab} onChange={setActiveTab} size={isMobile ? 'small' : 'middle'}>
                <Tabs.TabPane tab={isMobile ? '1. SP' : '1. Thông tin & Sản phẩm'} key="1">
                    <Form form={form} layout="vertical" onValuesChange={handleFormValuesChange}>
                        <Row gutter={[16, isMobile ? 0 : 16]}>
                            <Col xs={24} sm={8}><Form.Item name="order_code" label="Mã đơn"><Input disabled placeholder="Tự động" /></Form.Item></Col>
                            <Col xs={24} sm={8}>
                                <Form.Item name="customer_id" label="Khách hàng" rules={[{ required: true }]}>
                                    <Select
                                        showSearch
                                        placeholder="Chọn KH"
                                        optionFilterProp="label"
                                        options={[
                                            ...(initialData?.isInternal ? [{ label: '🏢 NỘI BỘ', value: -1 }] : []),
                                            ...customers.map((c: any) => ({ label: `${c.name} - ${c.phone}`, value: c.id }))
                                        ]}
                                        disabled={initialData?.isInternal}
                                    />
                                </Form.Item>
                                {isQuotation && customerQuotations.length > 0 && (
                                    <Button
                                        size="small"
                                        icon={<CopyOutlined />}
                                        onClick={() => setCopyQuotationModalOpen(true)}
                                        style={{ marginTop: -10, marginBottom: 10 }}
                                    >
                                        Copy từ {customerQuotations.length} đơn/BG cũ
                                    </Button>
                                )}
                            </Col>
                            <Col xs={24} sm={8}><Form.Item name="order_date" label="Ngày đặt" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" /></Form.Item></Col>
                        </Row>
                        <Row gutter={[16, isMobile ? 0 : 16]}>
                            <Col xs={24} sm={8}>
                                <Form.Item name="status" label="Trạng thái">
                                    <Select>
                                        {isQuotation ? (
                                            <Option value="QUOTATION">Báo Giá</Option>
                                        ) : (
                                            <>
                                                <Option value="SO_PENDING">Xác nhận đơn hàng</Option>
                                                <Option value="DEPOSITED">Đã đặt cọc</Option>
                                                <Option value="SAMPLE_APPROVED">Đã duyệt mẫu SX</Option>
                                                <Option value="IN_PRODUCTION">Đang sản xuất</Option>
                                                <Option value="PARTIAL_DELIVERY">Giao 1 phần</Option>
                                                <Option value="DELIVERED">Đã giao hàng</Option>
                                                <Option value="COMPLETED">Hoàn tất</Option>
                                            </>
                                        )}
                                        <Option value="CANCELLED">Đã Hủy</Option>
                                    </Select>
                                </Form.Item>
                            </Col>
                            <Col xs={24} sm={8}><Form.Item name="delivery_date" label={isMobile ? 'Ngày giao' : 'Ngày giao dự kiến'}><DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" /></Form.Item></Col>
                            <Col xs={24} sm={8}>
                                <Form.Item name="assigned_to_id" label={isMobile ? 'Phụ trách' : 'Nhân sự phụ trách'}>
                                    <Select allowClear showSearch optionFilterProp="label" options={users.map(u => ({ label: u.full_name || u.username, value: u.id }))} placeholder="Chọn NV" />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Row gutter={16}>
                            <Col xs={12} sm={8}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 5 }}>
                                    <Form.Item name="require_invoice" valuePropName="checked" noStyle>
                                        <Switch checkedChildren="Có" unCheckedChildren="Không" />
                                    </Form.Item>
                                    <span style={{ fontWeight: 500, color: '#1890ff' }}>Lấy hóa đơn</span>
                                </div>
                            </Col>
                            <Col xs={12} sm={16}>
                                <Form.Item name="is_production_sample_approved" valuePropName="checked">
                                    <Checkbox style={{ fontWeight: 600, color: '#1890ff' }}>
                                        {isMobile ? 'Đã duyệt mẫu SX' : 'Đã duyệt mẫu tiêu chuẩn - Production Sample Approved'}
                                    </Checkbox>
                                </Form.Item>
                            </Col>
                        </Row>
                        <Row>
                            <Col span={24}>
                                <Form.Item name="note" label="Ghi chú nội bộ (Hiển thị trên Portal)">
                                    <Input.TextArea rows={2} placeholder="Nhập ghi chú cho khách hàng..." />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Row>
                            <Col span={24}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
                                    <span style={{ fontWeight: 500 }}>Điều khoản & Quy định (Hiển thị trên Portal & Bản in)</span>
                                    {quoteTermsList.length > 0 && (
                                        <Select 
                                            size="small" 
                                            placeholder="Chọn mẫu điều khoản..." 
                                            style={{ width: 250 }}
                                            onChange={(val) => {
                                                const term = quoteTermsList.find(t => t.id === val);
                                                if (term) {
                                                    form.setFieldsValue({ terms_content: term.content });
                                                }
                                            }}
                                        >
                                            {quoteTermsList.map(t => <Option key={t.id} value={t.id}>{t.name} {t.isDefault ? '(Mặc định)' : ''}</Option>)}
                                        </Select>
                                    )}
                                </div>
                                <Form.Item name="terms_content" style={{ marginBottom: 16 }}>
                                    <Input.TextArea rows={4} placeholder="VD: 1. Thời gian giao hàng: 15-20 ngày..." />
                                </Form.Item>
                            </Col>
                        </Row>

                        {/* HIDDEN FIELDS TO REGISTER VALUES */}
                        <Form.Item name="discount_rate" hidden><InputNumber /></Form.Item>
                        <Form.Item name="discount_amount" hidden><InputNumber /></Form.Item>
                        <Form.Item name="vat_rate" hidden><InputNumber /></Form.Item>
                        <Form.Item name="shipping_fee" hidden><InputNumber /></Form.Item>
                        <Form.Item name="deposit_percent" hidden><InputNumber /></Form.Item>
                        <Form.Item name="deposit_amount" hidden><InputNumber /></Form.Item>

                        <Divider orientation="left">Danh sách sản phẩm</Divider>
                        <SalesOrderItemsTable
                            items={orderItems}
                            products={products}
                            isMobile={isMobile ?? false}
                            onItemChange={handleItemChange}
                            onRemoveItem={handleRemoveItem}
                            onReorder={handleReorderItems}
                        />
                        <Button type="dashed" onClick={handleAddItem} block icon={<PlusOutlined />} style={{ marginTop: 10 }}>Thêm sản phẩm</Button>

                        {/* NEW TOTALS SECTION */}
                        <Row justify="end" style={{ marginTop: 24 }}>
                            <Col xs={24} md={10}>
                                <div style={{ background: '#fafafa', padding: 16, borderRadius: 8 }}>
                                    <Form.Item shouldUpdate noStyle>
                                        {({ getFieldValue }) => {
                                            const subtotal = orderItems.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0);
                                            const discountAmt = Number(getFieldValue('discount_amount')) || 0;
                                            const vatRate = Number(getFieldValue('vat_rate')) || 0;
                                            const shipping = Number(getFieldValue('shipping_fee')) || 0;

                                            const taxable = Math.max(0, subtotal - discountAmt);
                                            const total = taxable * (1 + vatRate / 100) + shipping;

                                            // Common styles
                                            const labelStyle: React.CSSProperties = { color: '#666', fontSize: 13 };
                                            const valStyle: React.CSSProperties = { fontWeight: 500, fontSize: 13, textAlign: 'right' as const };
                                            const rowStyle: React.CSSProperties = { marginBottom: 12, alignItems: 'center' };

                                            return (
                                                <>
                                                    <Row style={rowStyle}>
                                                        <Col span={10} style={labelStyle}>Tổng tiền hàng:</Col>
                                                        <Col span={14} style={valStyle}>{subtotal.toLocaleString()} ₫</Col>
                                                    </Row>

                                                    <Row style={rowStyle}>
                                                        <Col span={10} style={labelStyle}>Giảm giá:</Col>
                                                        <Col span={14} style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                                            <InputNumber
                                                                size="small"
                                                                min={0} max={100}
                                                                formatter={v => `${v}%`}
                                                                parser={v => v!.replace('%', '')}
                                                                placeholder="%"
                                                                style={{ width: 60 }}
                                                                value={getFieldValue('discount_rate')}
                                                                onChange={(val) => {
                                                                    const rate = Number(val);
                                                                    const amt = Math.floor(subtotal * rate / 100);
                                                                    form.setFieldsValue({ discount_rate: rate, discount_amount: amt });
                                                                    calculateTotal(orderItems);
                                                                }}
                                                            />
                                                            <InputNumber
                                                                size="small"
                                                                style={{ width: 110 }}
                                                                value={getFieldValue('discount_amount')}
                                                                formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                                                parser={v => v!.replace(/\$\s?|(,*)/g, '')}
                                                                onChange={(val) => {
                                                                    const amt = Number(val);
                                                                    const rate = subtotal > 0 ? Number((amt / subtotal * 100).toFixed(2)) : 0;
                                                                    form.setFieldsValue({ discount_amount: amt, discount_rate: rate });
                                                                    calculateTotal(orderItems);
                                                                }}
                                                            />
                                                        </Col>
                                                    </Row>

                                                    <Row style={rowStyle}>
                                                        <Col span={10} style={labelStyle}>VAT ({vatRate}%):</Col>
                                                        <Col span={14} style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center' }}>
                                                            <div style={{ color: '#888', marginRight: 4 }}>
                                                                {vatRate > 0 ? (taxable * vatRate / 100).toLocaleString() : '0'} ₫
                                                            </div>
                                                            <InputNumber
                                                                size="small"
                                                                min={0} max={100}
                                                                formatter={v => `${v}%`}
                                                                parser={v => v!.replace('%', '')}
                                                                style={{ width: 60 }}
                                                                value={getFieldValue('vat_rate')}
                                                                onChange={(v) => { form.setFieldsValue({ vat_rate: v }); calculateTotal(orderItems); }}
                                                            />
                                                        </Col>
                                                    </Row>

                                                    <Row style={rowStyle}>
                                                        <Col span={10} style={labelStyle}>Phí vận chuyển:</Col>
                                                        <Col span={14} style={{ textAlign: 'right' }}>
                                                            <InputNumber
                                                                size="small"
                                                                min={0}
                                                                style={{ width: 110 }}
                                                                value={getFieldValue('shipping_fee')}
                                                                formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                                                parser={v => v!.replace(/\$\s?|(,*)/g, '')}
                                                                onChange={(v) => { form.setFieldsValue({ shipping_fee: v }); calculateTotal(orderItems); }}
                                                            />
                                                        </Col>
                                                    </Row>

                                                    <Divider style={{ margin: '12px 0' }} />

                                                    <Row style={{ alignItems: 'center' }}>
                                                        <Col span={10} style={{ fontSize: 15, fontWeight: 700, color: '#333' }}>TỔNG CỘNG:</Col>
                                                        <Col span={14} style={{ textAlign: 'right', fontSize: 18, fontWeight: 700, color: '#f5222d' }}>
                                                            {total.toLocaleString()} ₫
                                                        </Col>
                                                    </Row>

                                                    {/* DEPOSIT SECTION */}
                                                    <Divider style={{ margin: '12px 0' }} dashed />
                                                    <Row style={rowStyle}>
                                                        <Col span={10} style={{ ...labelStyle, fontWeight: 500, color: '#722ed1' }}>Đặt cọc:</Col>
                                                        <Col span={14} style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                                            <InputNumber
                                                                size="small"
                                                                min={0} max={100}
                                                                formatter={v => `${v}%`}
                                                                parser={v => v!.replace('%', '')}
                                                                placeholder="%"
                                                                style={{ width: 70 }}
                                                                value={getFieldValue('deposit_percent')}
                                                                onChange={(val) => {
                                                                    const rate = Number(val) || 0;
                                                                    const amt = Math.floor(total * rate / 100);
                                                                    form.setFieldsValue({ deposit_percent: rate, deposit_amount: amt });
                                                                }}
                                                            />
                                                            <InputNumber
                                                                size="small"
                                                                style={{ width: 120 }}
                                                                value={getFieldValue('deposit_amount')}
                                                                formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                                                parser={v => v!.replace(/\$\s?|(,*)/g, '')}
                                                                onChange={(val) => {
                                                                    const amt = Number(val) || 0;
                                                                    const rate = total > 0 ? Number((amt / total * 100).toFixed(0)) : 0;
                                                                    form.setFieldsValue({ deposit_amount: amt, deposit_percent: rate });
                                                                }}
                                                            />
                                                        </Col>
                                                    </Row>
                                                    {getFieldValue('deposit_amount') > 0 && (
                                                        <Row style={{ marginTop: 4 }}>
                                                            <Col span={24} style={{ textAlign: 'right', fontSize: 12, color: '#722ed1', fontStyle: 'italic' }}>
                                                                💰 Yêu cầu đặt cọc: {Number(getFieldValue('deposit_amount') || 0).toLocaleString()} ₫
                                                            </Col>
                                                        </Row>
                                                    )}
                                                </>);
                                        }}
                                    </Form.Item>
                                </div>
                            </Col>
                        </Row>
                    </Form>
                </Tabs.TabPane>
                <Tabs.TabPane tab={isMobile ? '2. HĐ' : '2. Hợp đồng & Hóa đơn'} key="invoice">
                    <Form form={form} layout="vertical">
                        <div style={{ padding: 10, background: '#fff', border: '1px solid #d9d9d9', borderRadius: 4, marginBottom: 15 }}>
                            <div style={{ fontWeight: 600, marginBottom: 10, color: '#1890ff' }}><FileTextOutlined /> TẠO HỢP ĐỒNG</div>
                            <Row gutter={16} align="middle">
                                <Col flex="auto">
                                    <i>Soạn thảo hợp đồng, tự động điền biến và thêm phụ lục hình ảnh.</i>
                                    {initialData?.contract_html && (
                                        <div style={{ color: '#52c41a', marginTop: 5, fontSize: 13 }}>
                                            <CheckCircleOutlined /> Đã có {initialData.contract_status !== 'DRAFT' ? 'hợp đồng chính thức' : 'bản nháp hợp đồng'} lưu trên hệ thống
                                        </div>
                                    )}
                                </Col>
                                <Col>
                                    <Button type={initialData?.contract_html ? "default" : "primary"} icon={<PrinterOutlined />} onClick={() => setContractBuilderOpen(true)}>
                                        {initialData?.contract_html ? 'Mở Hợp Đồng Đã Lưu' : 'Soạn Thảo & In Hợp Đồng'}
                                    </Button>
                                </Col>
                                <Col>
                                    <Button type="default" style={{ borderColor: '#52c41a', color: '#52c41a' }} icon={<FileExcelOutlined />} onClick={handleExportExcel} loading={exportingExcel}>
                                        Xuất Excel
                                    </Button>
                                </Col>
                            </Row>
                        </div>

                        <div style={{ padding: isMobile ? 6 : 10, background: '#f5f5f5', borderRadius: 4, marginBottom: 15 }}>
                            {!isMobile && (
                                <div style={{ fontStyle: 'italic', color: '#666', marginBottom: 10, fontSize: 12 }}>
                                    <InfoCircleOutlined /> Lấy từ "Pháp Nhân" của KH
                                </div>
                            )}
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="vat_company_name" label="Tên đơn vị (Xuất HĐ)">
                                        <Input placeholder="Công ty TNHH..." />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="vat_tax_code" label="Mã số thuế">
                                        <Input placeholder="VD: 031..." />
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Row gutter={16}>
                                <Col span={24}>
                                    <Form.Item name="vat_address" label="Địa chỉ xuất HĐ">
                                        <Input placeholder="Địa chỉ theo ĐKKD" />
                                    </Form.Item>
                                </Col>
                            </Row>

                            {/* NGUỜI LIÊN HỆ */}
                            <Row gutter={16}>
                                <Col span={24}>
                                    <Form.Item label="Người liên hệ (Sẽ in lên Báo giá/Hợp đồng)">
                                        <Select
                                            placeholder="Chọn người liên hệ..."
                                            allowClear
                                            value={currentContactName ? `${currentContactPhone || ''} - ${currentContactName || ''}` : undefined}
                                            onChange={(val) => {
                                                if (!val) {
                                                    form.setFieldsValue({ contact_name: null, contact_phone: null });
                                                } else {
                                                    const parts = val.split(' - ');
                                                    form.setFieldsValue({ contact_phone: parts[0], contact_name: parts[1] });
                                                }
                                            }}
                                        >
                                            {customerContacts.map((c: any) => (
                                                <Option key={c.id} value={`${c.phone || ''} - ${c.full_name}`}>{c.full_name} {c.phone ? `(${c.phone})` : ''} {c.job_title ? `- ${c.job_title}` : ''}</Option>
                                            ))}
                                        </Select>
                                        {/* Hidden fields to store real data */}
                                        <Form.Item name="contact_name" hidden><Input /></Form.Item>
                                        <Form.Item name="contact_phone" hidden><Input /></Form.Item>
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="vat_email" label="Email Nhận Hóa Đơn">
                                        <Input placeholder="email@company.com" />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="vat_invoice_link" label="Link Hóa Đơn (PDF/Drive)">
                                        <Input placeholder="https://..." prefix={<LinkOutlined />} />
                                    </Form.Item>
                                </Col>
                            </Row>
                        </div>
                    </Form>
                </Tabs.TabPane>
                {initialData?.id && !isQuotation && (
                    <>
                        <Tabs.TabPane tab={isMobile ? '3. TT' : '3. Thanh toán'} key="2">
                            <SalesPayments
                                orderId={initialData.id}
                                orderCode={initialData.order_code}
                                totalAmount={totalAmount}
                                paidAmount={initialData.paid_amount || 0}
                                customerName={initialData?.customer?.name || initialData?.customer_name}
                                orderStatus={initialData.status}
                                onSuccess={onSuccess}
                            />
                        </Tabs.TabPane>
                        <Tabs.TabPane tab={isMobile ? '4. GH' : '4. Giao hàng'} key="3">
                            <div style={{ padding: isMobile ? 6 : 10, background: '#f5f5f5', borderRadius: 4, marginBottom: 15 }}>
                                <div style={{ fontStyle: 'italic', color: '#666', marginBottom: 10, fontSize: 12 }}>
                                    <InfoCircleOutlined /> Lấy từ "Danh sách chi nhánh" của Khách hàng
                                </div>
                                <Form form={form} layout="vertical">
                                    <Form.Item label="Địa chỉ / Chi nhánh giao hàng (In trên báo giá/Đơn hàng)">
                                        <Select
                                            mode="multiple"
                                            placeholder="Chọn chi nhánh/địa chỉ giao hàng..."
                                            allowClear
                                            value={currentShippingAddress ? currentShippingAddress.split('\n').filter((x: string) => x) : []}
                                            onChange={(val: string[]) => {
                                                form.setFieldsValue({ shipping_address: val.join('\n') });
                                            }}
                                            options={(selectedCustomer?.delivery_addresses || []).map((addr: any) => ({
                                                label: `${addr.name ? addr.name + ' - ' : ''}${addr.address}`,
                                                value: `${addr.name ? addr.name + ' - ' : ''}${addr.address}`
                                            }))}
                                        />
                                        <Form.Item name="shipping_address" hidden><Input /></Form.Item>
                                    </Form.Item>
                                </Form>
                            </div>
                            <SalesDeliveries order={initialData} products={products} customers={customers} onSuccess={onSuccess} />
                        </Tabs.TabPane>
                        <Tabs.TabPane tab={isMobile ? '5. Chat' : '5. Trao đổi'} key="4">
                            <SalesComments
                                orderId={initialData.id}
                                defaultTab={defaultCommentTab}
                                highlightCommentId={highlightCommentId}
                            />
                        </Tabs.TabPane>
                        <Tabs.TabPane tab={isMobile ? '6. CL' : '6. Checklist'} key="5">
                            <SalesChecklistPanel orderId={initialData.id} orderStatus={initialData.status} onRefresh={onSuccess} />
                        </Tabs.TabPane>
                        <Tabs.TabPane tab={isMobile ? '7. Mẫu' : '7. Mẫu SX'} key="sample_images">
                            <SampleImagesTab
                                orderId={initialData.id}
                                initialImages={initialData.approved_sample_images || []}
                                isApproved={initialData.is_production_sample_approved}
                                onApprove={handleApproveSamples}
                                onSave={(images) => { initialData.approved_sample_images = images; }}
                                isQuotation={isQuotation}
                            />
                        </Tabs.TabPane>
                        <Tabs.TabPane tab={isMobile ? '8. BG' : '8. Lịch sử Báo giá'} key="quotation_history">
                            <QuotationHistoryTab revisions={revisions} products={products} customers={customers} />
                        </Tabs.TabPane>
                        <Tabs.TabPane tab={isMobile ? '9. LS' : '9. Lịch sử hoạt động'} key="activity_logs">
                            <SalesActivityLogsTab orderId={initialData.id} />
                        </Tabs.TabPane>
                    </>
                )}
            </Tabs>

            {/* CANCEL REASON MODAL */}
            <CancelOrderModal
                open={cancelModalOpen}
                cancelReason={cancelReason}
                onReasonChange={setCancelReason}
                onConfirm={handleCancelOrder}
                onCancel={() => setCancelModalOpen(false)}
            />

            {/* REVISION HISTORY MODAL */}
            <RevisionHistoryModal
                open={revisionModalOpen}
                onClose={() => setRevisionModalOpen(false)}
                revisions={revisions}
                products={products}
                customers={customers}
            />

            {/* CONTRACT BUILDER MODAL */}
            <ContractBuilderModal
                open={contractBuilderOpen}
                onCancel={() => setContractBuilderOpen(false)}
                onSuccess={onSuccess}
                initialData={initialData}
                templates={contractTemplates}
            />

            {/* COPY QUOTATION MODAL */}
            <Modal
                title="Copy từ Báo giá cũ"
                open={copyQuotationModalOpen}
                onCancel={() => setCopyQuotationModalOpen(false)}
                footer={null}
                width={700}
            >
                <div style={{ marginBottom: 10, color: '#666' }}>Chọn báo giá để copy sản phẩm:</div>
                <Table
                    dataSource={customerQuotations}
                    rowKey="id"
                    size="small"
                    pagination={false}
                    onRow={(record: any) => ({
                        onClick: () => handleCopyQuotation(record),
                        style: { cursor: 'pointer' }
                    })}
                    columns={[
                        { title: 'Mã BG', dataIndex: 'order_code', render: (v: string) => <Tag color="blue">{v}</Tag> },
                        { title: 'Ngày', dataIndex: 'order_date', render: (d: string) => dayjs(d).format('DD/MM/YYYY') },
                        { title: 'Trạng thái', dataIndex: 'status', render: (v: string) => <Tag color={v === 'QUOTATION' ? 'orange' : 'green'}>{v}</Tag> },
                        { title: 'Tổng tiền', dataIndex: 'total_amount', align: 'right' as const, render: (v: number) => <b style={{ color: 'red' }}>{Number(v || 0).toLocaleString()} ₫</b> }
                    ]}
                />
            </Modal>
        </Drawer>
    );
};

export default SalesOrderDetail;