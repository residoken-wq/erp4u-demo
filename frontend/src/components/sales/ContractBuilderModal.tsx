import React, { useEffect, useState, useMemo } from 'react';
import { Modal, Form, Select, Button, Checkbox, Row, Col, Input, Divider, Card, AutoComplete, message, Spin } from 'antd';
import { PrinterOutlined, ReloadOutlined, SaveOutlined, FileSyncOutlined, EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import AttachmentUpload from '../common/AttachmentUpload';
import api from '../../utils/api';
import { numberToWords } from '../../utils/numberToWords';

const formatImgUrl = (url?: string) => {
    if (!url) return '';
    try {
        if (url.startsWith('[') || url.startsWith('{')) {
            const parsed = JSON.parse(url);
            if (Array.isArray(parsed) && parsed.length > 0) {
                url = parsed[0];
            }
        }
    } catch(e) {}
    if (!url) return '';
    // Handle Google Drive URLs - use thumbnail endpoint (uc?export=view is deprecated/blocked)
    if (url.includes('drive.google.com')) {
        let id = '';
        // Format: /file/d/FILE_ID/...
        const fileMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (fileMatch && fileMatch[1]) {
            id = fileMatch[1];
        }
        // Format: ?id=FILE_ID
        if (!id) {
            const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
            if (idMatch && idMatch[1]) id = idMatch[1];
        }
        if (id) {
            return `https://drive.google.com/thumbnail?id=${id}&sz=w1000`;
        }
    }
    // Handle relative URLs (e.g. /uploads/...)
    if (url && !url.startsWith('http') && !url.startsWith('data:')) {
        return `${window.location.origin}${url}`;
    }
    return url || '';
};

interface Props {
    open: boolean;
    onCancel: () => void;
    onSuccess?: () => void; // Added for reload
    initialData: any; // Order Data
    templates: any[]; // Contract Templates
}

const SELLER_KEYS = [
    'seller_company_name', 'seller_address', 'seller_phone', 'seller_email', 'seller_website',
    'seller_tax_code', 'seller_representative',
    'seller_bank_name', 'seller_bank_account', 'seller_bank_holder'
];

const TEXT_CONTENT_KEYS = ['text_content_1', 'text_content_2', 'text_content_3', 'text_content_4', 'text_content_5'];

const BUILT_IN_VARS = [
    'customer_name', 'customer_address', 'customer_tax_code', 'customer_representative', 'customer_position',
    'customer_legal_name', 'legal_name',
    'customer_legal_address', 'legal_address',
    'customer_legal_representative', 'legal_representative',
    'customer_einvoice_email', 'einvoice_email',
    'order_code', 'contract_code', 'order_date', 'total_amount_text', 'sign_date', 'items_table',
    ...SELLER_KEYS,
    ...TEXT_CONTENT_KEYS
];

const ContractBuilderModal: React.FC<Props> = ({ open, onCancel, onSuccess, initialData, templates }) => {
    const [form] = Form.useForm();
    const [appendixImages, setAppendixImages] = useState<string[]>([]);
    const [previewHtml, setPreviewHtml] = useState('');
    const [customVariables, setCustomVariables] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const [autoFillValues, setAutoFillValues] = useState<boolean>(true);
    const [sellerInfo, setSellerInfo] = useState<Record<string, string>>({});
    const [sellerLoading, setSellerLoading] = useState(false);

    // Detect which text_content vars are used in current template
    const [activeTextContentVars, setActiveTextContentVars] = useState<string[]>([]);

    // Fetch seller info on mount
    useEffect(() => {
        if (open) {
            setSellerLoading(true);
            api.get('/system/seller-info')
                .then(res => {
                    const data = res.data || {};
                    setSellerInfo(data);
                    // Auto-fill seller fields in form
                    const sellerFormValues: any = {};
                    SELLER_KEYS.forEach(k => {
                        if (data[k]) sellerFormValues[k] = data[k];
                    });
                    form.setFieldsValue(sellerFormValues);
                })
                .catch(() => { /* ignore */ })
                .finally(() => setSellerLoading(false));
        }
    }, [open]);

    // Initial Setup
    useEffect(() => {
        if (open && initialData) {
            // Restore saved appendix images or from items
            let restoredImages: string[] = [];
            if (initialData.contract_variables?.appendixImages) {
                 restoredImages = initialData.contract_variables.appendixImages;
            } else {
                 const itemImages = initialData.items?.map((i: any) => i.image_url || i.product?.image_url).filter(Boolean) || [];
                 restoredImages = [...new Set(itemImages)] as string[];
            }
            setAppendixImages(restoredImages);

            const initialVars = initialData.contract_variables || {};
            
            form.setFieldsValue({
                template_id: initialData.contract_template_id || (templates.length > 0 ? templates[0].id : undefined),
                include_product_list: initialVars.include_product_list !== false,
                sign_date: initialVars.sign_date ? dayjs(initialVars.sign_date) : dayjs(),
                is_contract_visible: initialVars.is_contract_visible !== false,
                ...initialVars
            });
            setTimeout(handleGeneratePreview, 100); // Initial preview
        }
    }, [open, initialData, templates]);

    const suggestions = useMemo(() => {
        if (!initialData?.customer) return [];
        const c = initialData.customer;
        const opts: {value: string, label: string}[] = [];
        if (c.name) opts.push({ value: c.name, label: `Tên: ${c.name}` });
        if (c.legal_name) opts.push({ value: c.legal_name, label: `Pháp nhân: ${c.legal_name}` });
        if (c.phone) opts.push({ value: c.phone, label: `SĐT: ${c.phone}` });
        if (c.email) opts.push({ value: c.email, label: `Email: ${c.email}` });
        if (c.tax_code) opts.push({ value: c.tax_code, label: `MST: ${c.tax_code}` });
        if (c.address) opts.push({ value: c.address, label: `Địa chỉ: ${c.address}` });
        if (c.legal_address) opts.push({ value: c.legal_address, label: `ĐC Pháp nhân: ${c.legal_address}` });
        if (c.legal_representative) opts.push({ value: c.legal_representative, label: `Đại diện: ${c.legal_representative}` });
        
        // Add contacts
        c.contacts?.forEach((contact: any) => {
            if (contact.name) opts.push({ value: contact.name, label: `Liên hệ: ${contact.name}` });
            if (contact.phone) opts.push({ value: contact.phone, label: `SĐT LH: ${contact.phone}` });
            if (contact.email) opts.push({ value: contact.email, label: `Email LH: ${contact.email}` });
        });
        
        return opts;
    }, [initialData]);

    // Build seller suggestions from actual data
    const erp4uSuggestions = useMemo(() => {
        const opts: {value: string, label: string}[] = [];
        if (sellerInfo.seller_company_name) opts.push({ value: sellerInfo.seller_company_name, label: `Pháp nhân: ${sellerInfo.seller_company_name}` });
        if (sellerInfo.seller_tax_code) opts.push({ value: sellerInfo.seller_tax_code, label: `MST: ${sellerInfo.seller_tax_code}` });
        if (sellerInfo.seller_address) opts.push({ value: sellerInfo.seller_address, label: `Địa chỉ: ${sellerInfo.seller_address}` });
        if (sellerInfo.seller_phone) opts.push({ value: sellerInfo.seller_phone, label: `Hotline: ${sellerInfo.seller_phone}` });
        if (sellerInfo.seller_email) opts.push({ value: sellerInfo.seller_email, label: `Email: ${sellerInfo.seller_email}` });
        if (sellerInfo.seller_website) opts.push({ value: sellerInfo.seller_website, label: `Website: ${sellerInfo.seller_website}` });
        if (sellerInfo.seller_representative) opts.push({ value: sellerInfo.seller_representative, label: `Đại diện: ${sellerInfo.seller_representative}` });
        if (sellerInfo.seller_bank_name) opts.push({ value: sellerInfo.seller_bank_name, label: `Ngân hàng: ${sellerInfo.seller_bank_name}` });
        if (sellerInfo.seller_bank_account) opts.push({ value: sellerInfo.seller_bank_account, label: `STK: ${sellerInfo.seller_bank_account}` });
        if (sellerInfo.seller_bank_holder) opts.push({ value: sellerInfo.seller_bank_holder, label: `Chủ TK: ${sellerInfo.seller_bank_holder}` });
        return opts;
    }, [sellerInfo]);

    const customerVars = useMemo(() => customVariables.filter(v => ['buyer', 'customer', 'khach_hang', 'ben_mua', 'dai_dien', 'sdt', 'email', 'mst', 'address', 'dia_chi'].some(k => v.toLowerCase().includes(k))), [customVariables]);
    const erp4uVars = useMemo(() => customVariables.filter(v => ['seller', 'erp4u', 'ben_ban', 'nhan_vien'].some(k => v.toLowerCase().includes(k))), [customVariables]);
    const orderVars = useMemo(() => customVariables.filter(v => ['total', 'subtotal', 'vat', 'tien', 'gia_tri', 'word', 'discount', 'giam_gia', 'chi_phi'].some(k => v.toLowerCase().includes(k))), [customVariables]);
    const otherVars = useMemo(() => customVariables.filter(v => !customerVars.includes(v) && !erp4uVars.includes(v) && !orderVars.includes(v)), [customVariables, customerVars, erp4uVars, orderVars]);

    // Format auto values when toggle changes or when variables loaded
    useEffect(() => {
        if (autoFillValues && orderVars.length > 0) {
            let subtotal = 0;
            initialData.items?.forEach((item: any) => {
                 subtotal += Number(item.quantity || 0) * Number(item.unit_price || 0);
            });
            const discountValue = Number(initialData.discount_amount || 0) || (subtotal * Number(initialData.discount_rate || 0) / 100);
            const subtotalAfterDiscount = subtotal - discountValue;
            const vat = (subtotalAfterDiscount * Number(initialData.vat_rate || 0)) / 100;
            const total = subtotalAfterDiscount + vat + Number(initialData.shipping_fee || 0);
            
            const updates: any = {};
            orderVars.forEach(v => {
                const vl = v.toLowerCase();
                if (vl.includes('subtotal') || vl.includes('sub_total') || vl.includes('tien_hang')) updates[v] = subtotal.toLocaleString('vi-VN');
                else if (vl.includes('vat') || vl.includes('thue')) updates[v] = vat.toLocaleString('vi-VN');
                else if (vl.includes('word') || vl.includes('bang_chu') || vl.includes('chu')) updates[v] = numberToWords(total);
                else if (vl.includes('total') || vl.includes('tong_cong')) updates[v] = total.toLocaleString('vi-VN');
            });
            if (Object.keys(updates).length > 0) {
                form.setFieldsValue(updates);
                // Note: handleGeneratePreview is called debounced from Form onChange anyway but we can trigger it 
                setTimeout(handleGeneratePreview, 200);
            }
        }
    }, [autoFillValues, orderVars, initialData, form]);

    const handleGeneratePreview = async () => {
        const values = form.getFieldsValue();
        const template = templates.find(t => t.id === values.template_id);

        if (!template) {
            setPreviewHtml('<div style="padding:20px; text-align:center; color:#999">Vui lòng chọn mẫu hợp đồng</div>');
            setCustomVariables([]);
            setActiveTextContentVars([]);
            return;
        }

        let content = template.content;

        // Extract placeholders from template
        const matches = content.match(/\{\{([^\}]+)\}\}/g);
        let extractedVars: string[] = [];
        if (matches) {
            extractedVars = matches.map((m: string) => m.replace('{{', '').replace('}}', '').trim());
            extractedVars = [...new Set(extractedVars)]; // unique
            extractedVars = extractedVars.filter(v => !BUILT_IN_VARS.includes(v)); // Keep only custom
        }
        setCustomVariables(extractedVars);

        // Detect which text_content vars are in template
        const allVarsInTemplate = matches ? matches.map((m: string) => m.replace('{{', '').replace('}}', '').trim()) : [];
        setActiveTextContentVars(TEXT_CONTENT_KEYS.filter(k => allVarsInTemplate.includes(k)));

        const data: any = {
            customer_name: initialData.customer?.name || '...',
            customer_address: initialData.customer?.address || '...',
            customer_tax_code: initialData.customer?.tax_code || '...',
            customer_representative: initialData.customer?.representative_name || initialData.customer?.legal_representative || '...',
            customer_position: initialData.customer?.representative_position || 'Giám Đốc',

            // Customer Legal Entity Info
            customer_legal_name: initialData.customer?.legal_name || '...',
            legal_name: initialData.customer?.legal_name || '...',
            customer_legal_address: initialData.customer?.legal_address || '...',
            legal_address: initialData.customer?.legal_address || '...',
            customer_legal_representative: initialData.customer?.legal_representative || '...',
            legal_representative: initialData.customer?.legal_representative || '...',
            customer_einvoice_email: initialData.customer?.einvoice_email || '...',
            einvoice_email: initialData.customer?.einvoice_email || '...',

            order_code: initialData.order_code || '...',
            contract_code: `TLG/${dayjs().format('YYYY')}-${initialData.id || ''}`,
            order_date: dayjs(initialData.order_date).format('DD/MM/YYYY'),
            total_amount_text: (initialData.total_amount || 0).toLocaleString() + ' đ',

            // Seller info from settings
            ...sellerInfo,

            // Custom fields that might be in the form (placeholder)
            ...values,
            sign_date: values.sign_date ? dayjs(values.sign_date).format('DD/MM/YYYY') : '...'
        };

        // Convert text_content newlines to <br/> for HTML rendering
        TEXT_CONTENT_KEYS.forEach(key => {
            if (data[key] && typeof data[key] === 'string') {
                data[key] = data[key].replace(/\n/g, '<br/>');
            }
        });

        // 2. Replace Placeholders
        Object.keys(data).forEach(key => {
            if (data[key] !== undefined && data[key] !== null) {
                // Ensure strictly global replace
                const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
                content = content.replace(regex, (data as any)[key]);
            }
        });
        
        // Ensure unknown variables are not completely hidden or left as {{code}}, maybe leave them so user sees they are missing?
        // We leave them so the user knows they need to fill them, or we can replace them with a red span.
        extractedVars.forEach(key => {
             if (!data[key]) {
                  const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
                  content = content.replace(regex, `<span style="color:red; background: #ffe6e6; border-bottom: 1px dotted red;"> [Điền: ${key}] </span>`);
             }
        });

        // Also mark unfilled text_content vars
        TEXT_CONTENT_KEYS.forEach(key => {
            if (!values[key]) {
                const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
                content = content.replace(regex, `<span style="color:purple; background: #f3e8ff; border-bottom: 1px dotted purple;"> [Soạn: ${key}] </span>`);
            }
        });

        // 3. Generate Appendix
        let appendixHtml = '';

        // Product List
        if (values.include_product_list) {
            let subtotal = 0;
            initialData.items?.forEach((item: any) => {
                 subtotal += Number(item.quantity || 0) * Number(item.unit_price || 0);
            });
            const discountValue = Number(initialData.discount_amount || 0) || (subtotal * Number(initialData.discount_rate || 0) / 100);
            const subtotalAfterDiscount = subtotal - discountValue;
            const vat = (subtotalAfterDiscount * Number(initialData.vat_rate || 0)) / 100;
            const shippingFee = Number(initialData.shipping_fee || 0);

            let tfootHtml = `
                             <tr>
                                <td colspan="5" style="text-align:right; padding: 8px;">Cộng tiền hàng:</td>
                                <td style="text-align:right; padding: 8px;">${subtotal.toLocaleString('vi-VN')}</td>
                            </tr>
            `;
            if (discountValue > 0) {
                tfootHtml += `
                             <tr>
                                <td colspan="5" style="text-align:right; padding: 8px;">Chiết khấu:</td>
                                <td style="text-align:right; padding: 8px;">-${discountValue.toLocaleString('vi-VN')}</td>
                            </tr>
                `;
            }
            if (vat > 0) {
                tfootHtml += `
                             <tr>
                                <td colspan="5" style="text-align:right; padding: 8px;">Thuế GTGT (${initialData.vat_rate || 0}%):</td>
                                <td style="text-align:right; padding: 8px;">${vat.toLocaleString('vi-VN')}</td>
                            </tr>
                `;
            }
            if (shippingFee > 0) {
                tfootHtml += `
                             <tr>
                                <td colspan="5" style="text-align:right; padding: 8px;">Phí vận chuyển:</td>
                                <td style="text-align:right; padding: 8px;">${shippingFee.toLocaleString('vi-VN')}</td>
                            </tr>
                `;
            }
            tfootHtml += `
                             <tr>
                                <td colspan="5" style="text-align:right; padding: 8px; font-weight:bold">Tổng cộng:</td>
                                <td style="text-align:right; padding: 8px; font-weight:bold">${Number(initialData.total_amount || 0).toLocaleString('vi-VN')}</td>
                            </tr>
            `;

            appendixHtml += `
                <div style="page-break-before: always;">
                    <h3 style="text-align: center; text-transform: uppercase; margin-top: 30px;">Phụ Lục 01: Danh Sách Sản Phẩm</h3>
                    <table border="1" style="width:100%; border-collapse:collapse; margin-top: 20px;">
                        <thead>
                            <tr style="background:#f5f5f5">
                                <th style="padding: 8px;">STT</th>
                                <th style="padding: 8px;">Hình ảnh</th>
                                <th style="padding: 8px;">Tên sản phẩm / SKU</th>
                                <th style="padding: 8px;">Số lượng</th>
                                <th style="padding: 8px;">Đơn giá</th>
                                <th style="padding: 8px;">Thành tiền</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${initialData.items?.map((item: any, index: number) => `
                                <tr>
                                    <td style="text-align:center; padding: 8px;">${index + 1}</td>
                                    <td style="text-align:center; padding: 8px;">
                                        ${(item.image_url || item.product?.image_url) ? `<img src="${formatImgUrl(item.image_url || item.product?.image_url)}" style="width: 50px; height: 50px; object-fit: cover;" />` : ''}
                                    </td>
                                    <td style="padding: 8px;">
                                        <div><b>${item.sku || 'SP'}</b></div>
                                        <div style="font-size: 12px; color: #666;">${item.product?.name || ''}</div>
                                    </td>
                                    <td style="text-align:center; padding: 8px;">${item.quantity}</td>
                                    <td style="text-align:right; padding: 8px;">${Number(item.unit_price || 0).toLocaleString('vi-VN')}</td>
                                    <td style="text-align:right; padding: 8px;">${(Number(item.quantity || 0) * Number(item.unit_price || 0)).toLocaleString('vi-VN')}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            ${tfootHtml}
                        </tfoot>
                    </table>
                </div>
            `;
        }

        // Images Appendix
        if (appendixImages.length > 0) {
            appendixHtml += `
                <div style="page-break-before: always;">
                    <h3 style="text-align: center; text-transform: uppercase; margin-top: 30px;">Phụ Lục 02: Hình Ảnh Tham Khảo</h3>
                    <div style="display: flex; flex-wrap: wrap; gap: 20px; justify-content: center; margin-top: 20px;">
                        ${appendixImages.map(img => {
                            const matchingItems = initialData.items?.filter((i: any) => (i.image_url || i.product?.image_url) === img) || [];
                            let captionHtml = '';
                            if (matchingItems.length > 0) {
                                // Find first item that has vat_content or name to avoid duplication if same image is used
                                const item = matchingItems[0];
                                const vatContent = item.vat_content || item.product?.vat_content || '';
                                const productName = item.product?.name || item.sku || '';
                                
                                let captionText = '';
                                if (vatContent && productName) {
                                    captionText = `${vatContent} - ${productName}`;
                                } else if (vatContent) {
                                    captionText = vatContent;
                                } else if (productName) {
                                    captionText = productName;
                                }
                                
                                if (captionText) {
                                    captionHtml = `<div style="margin-top: 8px; font-size: 14px; font-weight: 500; color: #333;">${captionText}</div>`;
                                }
                            }
                            
                            return `
                                <div style="text-align: center; border: 1px solid #ddd; padding: 10px; border-radius: 8px; max-width: 320px;">
                                    <img src="${formatImgUrl(img)}" style="max-width: 300px; max-height: 300px; object-fit: contain;" />
                                    ${captionHtml}
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }

        // Replace {{items_table}} if it exists in main content (legacy support), otherwise append to end
        if (content.includes('{{items_table}}')) {
            content = content.replace('{{items_table}}', ''); // Clear placeholder to avoid dupes if we append
        }

        // Append Appendix
        content += appendixHtml;

        setPreviewHtml(content);
    };

    const handleSave = async (createVersion: boolean = false) => {
        try {
            setSaving(true);
            const values = form.getFieldsValue();
            
            // Clean content to not include the red spans when saving (just re-evaluate without replacing empties with red spans)
            // Actually it is better to generate the clean HTML to save.
            const template = templates.find(t => t.id === values.template_id);
            if (!template) {
                 message.error("Vui lòng chọn mẫu hợp đồng");
                 return;
            }
            
            let cleanContent = template.content;
            const dataToSave = {
                customer_name: initialData.customer?.name || '',
                customer_address: initialData.customer?.address || '',
                customer_tax_code: initialData.customer?.tax_code || '',
                customer_representative: initialData.customer?.representative_name || initialData.customer?.legal_representative || '',
                customer_position: initialData.customer?.representative_position || '',

                // Customer Legal Entity Info
                customer_legal_name: initialData.customer?.legal_name || '',
                legal_name: initialData.customer?.legal_name || '',
                customer_legal_address: initialData.customer?.legal_address || '',
                legal_address: initialData.customer?.legal_address || '',
                customer_legal_representative: initialData.customer?.legal_representative || '',
                legal_representative: initialData.customer?.legal_representative || '',
                customer_einvoice_email: initialData.customer?.einvoice_email || '',
                einvoice_email: initialData.customer?.einvoice_email || '',

                order_code: initialData.order_code || '',
                order_date: dayjs(initialData.order_date).format('DD/MM/YYYY'),
                total_amount_text: (initialData.total_amount || 0).toLocaleString() + ' đ',
                ...sellerInfo,
                ...values,
                sign_date: values.sign_date ? dayjs(values.sign_date).format('DD/MM/YYYY') : '',
                appendixImages // Include images in variables
            };

            // Convert text_content newlines to <br/> for saved HTML
            TEXT_CONTENT_KEYS.forEach(key => {
                if (dataToSave[key] && typeof dataToSave[key] === 'string') {
                    dataToSave[key] = dataToSave[key].replace(/\n/g, '<br/>');
                }
            });
            
            Object.keys(dataToSave).forEach(key => {
                if (dataToSave[key] !== undefined && dataToSave[key] !== null) {
                    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
                    cleanContent = cleanContent.replace(regex, (dataToSave as any)[key]);
                }
            });
            // (Note: Optional: We don't append the product table directly into the saved HTML string if we want it strictly dynamic, 
            // but for a true snapshot, the previewHtml should be what is saved).
            // Let's just save the `previewHtml` as it represents what the user saw, but we replace the red spans with empty string or keep them.
            // Actually, `previewHtml` is fine.
            let finalHtmlToSave = previewHtml.replace(/<span style="color:red; background: #ffe6e6; border-bottom: 1px dotted red;"> \[Điền: [^\]]+\] <\/span>/g, '...');
            finalHtmlToSave = finalHtmlToSave.replace(/<span style="color:purple; background: #f3e8ff; border-bottom: 1px dotted purple;"> \[Soạn: [^\]]+\] <\/span>/g, '...');
            
            await api.put(`/sales/${initialData.id}`, {
                contract_template_id: values.template_id,
                contract_html: finalHtmlToSave,
                contract_variables: { ...values, appendixImages },
                contract_status: createVersion ? 'OFFICIAL' : 'DRAFT'
            });
            
            if (createVersion) {
                await api.post(`/sales/${initialData.id}/revision`);
                message.success("Đã lưu hợp đồng và tạo Version mới!");
            } else {
                message.success("Đã lưu bản nháp hợp đồng thành công!");
            }
            
            if (onSuccess) onSuccess();
        } catch(e) {
            message.error("Lỗi khi lưu hợp đồng");
        } finally {
            setSaving(false);
        }
    };

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                    <head>
                        <title>In Hợp Đồng - ${initialData.order_code}</title>
                        <style>
                            body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; padding: 40px; }
                            table { border-collapse: collapse; width: 100%; }
                            th, td { border: 1px solid #000; padding: 5px; }
                            @media print {
                                @page { margin: 2cm; }
                                .no-print { display: none; }
                            }
                        </style>
                    </head>
                    <body>${previewHtml}</body>
                </html>
            `);
            printWindow.document.close();
            // Wait for images to load?
            setTimeout(() => {
                printWindow.print();
            }, 1000);
        }
    };

    const handleResetImages = () => {
        const itemImages = initialData.items?.filter((i: any) => i.image_url).map((i: any) => i.image_url) || [];
        setAppendixImages([...new Set(itemImages)] as string[]);
        setTimeout(handleGeneratePreview, 200);
    }

    return (
        <Modal
            title={<span style={{ fontWeight: 'bold' }}>📄 Soạn Thảo Hợp Đồng</span>}
            open={open}
            onCancel={onCancel}
            width={1200}
            style={{ top: 20 }}
            footer={[
                 <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }} key="footer-group">
                    <div>
                        <Button key="save_draft" type="default" icon={<SaveOutlined />} onClick={() => handleSave(false)} loading={saving}>
                            Lưu Bản Nháp
                        </Button>
                        <Button key="save_version" type="dashed" icon={<FileSyncOutlined />} onClick={() => handleSave(true)} loading={saving} style={{ marginLeft: 8 }}>
                            Lưu & Tạo Version
                        </Button>
                    </div>
                    <div>
                        <Button key="cancel" onClick={onCancel}>Đóng</Button>
                        <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={handlePrint} size="middle" style={{ marginLeft: 8 }}>
                            In Hợp Đồng
                        </Button>
                    </div>
                 </div>
            ]}
        >
            <Row gutter={24} style={{ height: '70vh' }}>
                <Col span={7} style={{ borderRight: '1px solid #f0f0f0', height: '100%', overflowY: 'auto', paddingRight: 10 }}>
                    <Form form={form} layout="vertical" onValuesChange={() => setTimeout(handleGeneratePreview, 200)}>
                        <Card title="1. Thông Tin Chung" size="small" bordered={false}>
                            <Form.Item name="template_id" label="Mẫu Hợp Đồng">
                                <Select options={templates.map(t => ({ label: t.name, value: t.id }))} />
                            </Form.Item>
                            <Form.Item name="sign_date" label="Ngày Ký (Hiển thị)">
                                <Input type="date" />
                            </Form.Item>
                            <Form.Item name="is_contract_visible" valuePropName="checked" style={{ marginBottom: 0 }}>
                                <Checkbox>Hiển thị hợp đồng trên Portal Báo Giá / Khách Hàng</Checkbox>
                            </Form.Item>
                        </Card>

                        {/* Text Content Section - only show if template uses text_content vars */}
                        {activeTextContentVars.length > 0 && (
                            <>
                                <Divider style={{ margin: '12px 0' }} />
                                <Card title="📝 Nội Dung Tự Soạn" size="small" bordered={true} style={{ marginBottom: 10, borderColor: '#d3adf7' }} headStyle={{ background: '#f9f0ff', fontSize: 13 }}>
                                    <div style={{ marginBottom: 8, fontSize: 12, color: '#888' }}>
                                        <i>Nhập nội dung văn bản dài. Hỗ trợ xuống dòng.</i>
                                    </div>
                                    {activeTextContentVars.map((v, idx) => (
                                        <Form.Item key={v} name={v} label={<span style={{ fontWeight: 500, fontFamily: 'monospace', fontSize: 12 }}>{`{{${v}}}`} — <span style={{ fontFamily: 'inherit', color: '#666' }}>Nội dung {idx + 1}</span></span>} style={{ marginBottom: 12 }}>
                                            <Input.TextArea rows={3} placeholder={`Nhập nội dung tự soạn ${idx + 1}...`} />
                                        </Form.Item>
                                    ))}
                                </Card>
                            </>
                        )}

                        {customVariables.length > 0 && (
                            <>
                                <Divider style={{ margin: '12px 0' }} />
                                <div style={{ fontWeight: 'bold', color: '#1890ff', marginBottom: 10, fontSize: 15 }}>2. Thông Tin Điền Thêm</div>
                                <div style={{ marginBottom: 12, fontSize: 13, color: '#666' }}>
                                    <i>Các biến tùy chỉnh từ mẫu ({customVariables.length} biến):</i>
                                </div>
                                
                                {customerVars.length > 0 && (
                                    <Card title="🔹 Thông Tin Khách Hàng (Bên Mua)" size="small" bordered={true} style={{ marginBottom: 10, borderColor: '#d9d9d9' }} headStyle={{ background: '#fafafa', fontSize: 13 }}>
                                        {customerVars.map(v => (
                                            <Form.Item key={v} name={v} label={<span style={{ fontWeight: 500, fontFamily: 'monospace', fontSize: 12 }}>{`{${v}}`}</span>} style={{ marginBottom: 12 }}>
                                                <AutoComplete
                                                    options={suggestions}
                                                    placeholder={`Tìm thông tin KH...`}
                                                    filterOption={(inputValue: string, option: any) =>
                                                        String(option!.label).toUpperCase().indexOf(inputValue.toUpperCase()) !== -1 ||
                                                        String(option!.value).toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                                                    }
                                                    allowClear
                                                />
                                            </Form.Item>
                                        ))}
                                    </Card>
                                )}

                                {erp4uVars.length > 0 && (
                                    <Card title="🔸 Thông Tin ERP4U (Bên Bán)" size="small" bordered={true} style={{ marginBottom: 10, borderColor: '#d9d9d9' }} headStyle={{ background: '#fafafa', fontSize: 13 }}>
                                        {erp4uVars.map(v => (
                                            <Form.Item key={v} name={v} label={<span style={{ fontWeight: 500, fontFamily: 'monospace', fontSize: 12 }}>{`{${v}}`}</span>} style={{ marginBottom: 12 }}>
                                                <AutoComplete
                                                    options={erp4uSuggestions}
                                                    placeholder={`Tìm thông tin ERP4U...`}
                                                    filterOption={(inputValue: string, option: any) =>
                                                        String(option!.label).toUpperCase().indexOf(inputValue.toUpperCase()) !== -1 ||
                                                        String(option!.value).toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                                                    }
                                                    allowClear
                                                />
                                            </Form.Item>
                                        ))}
                                    </Card>
                                )}

                                {orderVars.length > 0 && (
                                    <Card title={<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>💎 Giá Trị Đơn Hàng</span>
                                    </div>} size="small" bordered={true} style={{ marginBottom: 10, borderColor: '#d9d9d9' }} headStyle={{ background: '#fafafa', fontSize: 13 }}>
                                        <div style={{ marginBottom: 10 }}>
                                            <Checkbox checked={autoFillValues} onChange={(e) => setAutoFillValues(e.target.checked)}>
                                                Tự động lấy tiền từ hệ thống (SO)
                                            </Checkbox>
                                        </div>
                                        {orderVars.map(v => (
                                            <Form.Item key={v} name={v} label={<span style={{ fontWeight: 500, fontFamily: 'monospace', fontSize: 12 }}>{`{${v}}`}</span>} style={{ marginBottom: 12 }}>
                                                <Input disabled={autoFillValues && ['subtotal', 'sub_total', 'vat', 'total', 'word'].some(k => v.toLowerCase().includes(k))} placeholder={`Tự nhập giá trị...`} />
                                            </Form.Item>
                                        ))}
                                    </Card>
                                )}

                                {otherVars.length > 0 && (
                                    <Card title="📌 Thông Tin Khác" size="small" bordered={true} style={{ marginBottom: 10, borderColor: '#d9d9d9' }} headStyle={{ background: '#fafafa', fontSize: 13 }}>
                                        {otherVars.map(v => (
                                            <Form.Item key={v} name={v} label={<span style={{ fontWeight: 500, fontFamily: 'monospace', fontSize: 12 }}>{`{${v}}`}</span>} style={{ marginBottom: 12 }}>
                                                 <Input placeholder={`Nhập nội dung cho {${v}}`} />
                                            </Form.Item>
                                        ))}
                                    </Card>
                                )}
                            </>
                        )}

                        <Divider style={{ margin: '12px 0' }} />

                        <Card title={`${customVariables.length > 0 ? '3' : '2'}. Nội Dung Phụ Lục`} size="small" bordered={false}>
                            <Form.Item name="include_product_list" valuePropName="checked">
                                <Checkbox>Bao gồm Danh Sách Sản Phẩm</Checkbox>
                            </Form.Item>

                            <Divider style={{ margin: '12px 0' }} />

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                <span style={{ fontWeight: 500 }}>Hình Ảnh Phụ Lục:</span>
                                <Button size="small" icon={<ReloadOutlined />} onClick={handleResetImages}>Reset</Button>
                            </div>

                            <AttachmentUpload
                                value={appendixImages}
                                onChange={(newUrls) => {
                                    setAppendixImages(newUrls);
                                    setTimeout(handleGeneratePreview, 200);
                                }}
                                maxFiles={20}
                                title=""
                                allowUpload={true}
                                allowDelete={true}
                            />

                            <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
                                (Hệ thống sẽ tự động ghép các hình ảnh vào cuối hợp đồng)
                            </div>
                        </Card>
                    </Form>
                </Col>
                <Col span={17} style={{ height: '100%', overflowY: 'auto', background: '#e8e8e8', padding: '20px 40px' }}>
                    {(saving || sellerLoading) && <Spin spinning style={{position: 'absolute', top: '50%', left: '50%', zIndex: 10}}/>}
                    <div
                        style={{
                            background: 'white',
                            padding: '40px 60px',
                            minHeight: '100%',
                            boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
                            opacity: saving ? 0.6 : 1
                        }}
                        dangerouslySetInnerHTML={{ __html: previewHtml }}
                    />
                </Col>
            </Row>
        </Modal>
    );
};

export default ContractBuilderModal;
