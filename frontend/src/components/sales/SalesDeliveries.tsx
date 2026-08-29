import React, { useEffect, useState } from 'react';
import { Table, Button, Input, Modal, message, InputNumber, Tooltip, Select, DatePicker, Tag } from 'antd';
import { CarOutlined, CheckCircleOutlined, PrinterOutlined, MailOutlined, EditOutlined, UploadOutlined, DeleteOutlined, AppstoreOutlined } from '@ant-design/icons';
import api from '../../utils/api';
import dayjs from 'dayjs';
import AttachmentUpload from '../common/AttachmentUpload';

interface Props {
    order: any;
    products: any[];
    customers?: any[];
    onSuccess: () => void;
}

const SalesDeliveries: React.FC<Props> = ({ order, products, customers = [], onSuccess }) => {
    const [history, setHistory] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [shipNote, setShipNote] = useState('');
    const [shipItems, setShipItems] = useState<any[]>([]);
    const [editingDeliveryId, setEditingDeliveryId] = useState<number | null>(null);
    const [shipStatus, setShipStatus] = useState<string>('PENDING_EXPORT');
    const [isDraft, setIsDraft] = useState<boolean>(false);

    // Additional Ship Info state
    const [shipDate, setShipDate] = useState<any>(dayjs());
    const [shipAddress, setShipAddress] = useState<string>('');
    const [shipContactName, setShipContactName] = useState<string>('');
    const [shipContactPhone, setShipContactPhone] = useState<string>('');
    const [companyConfig, setCompanyConfig] = useState<any>(null);
    const [attachments, setAttachments] = useState<string[]>([]);

    // Quick Upload State
    const [uploadModalOpen, setUploadModalOpen] = useState(false);
    const [uploadDeliveryId, setUploadDeliveryId] = useState<number | null>(null);
    const [uploadAttachments, setUploadAttachments] = useState<string[]>([]);

    // Shipping Carrier State
    const [shippingCarrier, setShippingCarrier] = useState<string>('');
    const [trackingCode, setTrackingCode] = useState<string>('');
    const [shippingCost, setShippingCost] = useState<number>(0);
    const [carriers, setCarriers] = useState<any[]>([]);

    // RESOLVE FULL CUSTOMER (to get contacts)
    const fullCustomer = customers.find(c => c.id === order?.customer?.id || c.id === order?.customer_id) || order?.customer || {};
    const contactList = fullCustomer?.contacts || [];

    const fetchHistory = async () => {
        try {
            const res = await api.get(`/sales/${order.id}/deliveries`);
            setHistory(Array.isArray(res.data) ? res.data : []);
        } catch (e) { }
    };

    const fetchCarriers = async () => {
        try {
            // Lấy danh sách nhà cung cấp vận chuyển (type = LOGISTICS)
            const res = await api.get(`/suppliers`);
            setCarriers(res.data?.filter((c: any) => c.type === 'LOGISTICS') || []);
        } catch (e) { }
    };

    const handleDeleteDelivery = async (deliveryId: number) => {
        Modal.confirm({
            title: 'Xóa Phiếu Xuất Kho?',
            content: 'Bạn có chắc muốn xóa phiếu này? Nếu đã xuất kho, tồn kho sẽ được hoàn lại.',
            okText: 'Xóa',
            cancelText: 'Hủy',
            okButtonProps: { danger: true },
            onOk: async () => {
                try {
                    await api.delete(`/sales/delivery/${deliveryId}`);
                    message.success('Đã xóa phiếu xuất kho');
                    fetchHistory();
                    onSuccess();
                } catch (e: any) {
                    message.error(e.response?.data?.message || 'Không thể xóa phiếu');
                }
            }
        });
    };

    // State: Combo components cache (sku -> components[])
    const [comboComponentsMap, setComboComponentsMap] = useState<Record<string, any[]>>({});

    useEffect(() => {
        if (order?.id) fetchHistory();
        fetchCarriers();
        api.get(`/system/company`).then(res => setCompanyConfig(res.data)).catch(() => { });
    }, [order]);

    // Fetch combo components for COMBO products
    useEffect(() => {
        const comboItems = (order.items || []).filter((item: any) => {
            const productInfo = products.find((p: any) => p.value === item.sku);
            return productInfo?.type === 'COMBO';
        });
        if (comboItems.length === 0) return;

        const fetchComboComponents = async () => {
            const map: Record<string, any[]> = {};
            for (const item of comboItems) {
                try {
                    const res = await api.get(`/products/combo/${item.sku}`);
                    map[item.sku] = Array.isArray(res.data) ? res.data : [];
                } catch { map[item.sku] = []; }
            }
            setComboComponentsMap(map);
        };
        fetchComboComponents();
    }, [order?.items, products]);

    // Use order.items for ordered quantities
    const summaryData = (order.items || []).map((item: any) => {
        const ordered = Number(item.quantity) || 0;
        const price = Number(item.unit_price) || 0;

        let delivered = 0;
        let pending = 0;
        history.forEach((d: any) => {
            if (d.status === 'DRAFT') return; // Bỏ qua phiếu nháp
            const found = d.items?.find((di: any) => di.sku === item.sku);
            if (found) {
                if (d.status === 'SHIPPED' || d.status === 'COMPLETED') {
                    delivered += Number(found.quantity);
                } else { // PENDING_EXPORT or others
                    pending += Number(found.quantity);
                }
            }
        });

        const remaining = Math.max(0, ordered - delivered - pending);

        // Lookup stock from products list
        const productInfo = products.find((p: any) => p.value === item.sku);
        const isCombo = productInfo?.type === 'COMBO';
        const totalStock = productInfo ? Number(productInfo.quantity_in_stock || 0) : 0;
        const bookingStock = productInfo ? Number(productInfo.approved_booking_stock || 0) : 0;
        let stock = Math.max(0, totalStock - bookingStock);

        // Build combo children with individual stock info
        let comboChildren: any[] = [];
        if (isCombo && comboComponentsMap[item.sku]) {
            let minAvailableCombo = Infinity;
            comboChildren = comboComponentsMap[item.sku].map((comp: any) => {
                const childProduct = products.find((p: any) => p.value === comp.child_product?.sku);
                const childTotalStock = childProduct ? Number(childProduct.quantity_in_stock || 0) : 0;
                const childBookingStock = childProduct ? Number(childProduct.approved_booking_stock || 0) : 0;
                const childAvailable = Math.max(0, childTotalStock - childBookingStock);
                const qtyPerCombo = Number(comp.quantity) || 1;
                const totalNeeded = remaining * qtyPerCombo;
                
                const possibleCombo = Math.floor(childAvailable / qtyPerCombo);
                if (possibleCombo < minAvailableCombo) minAvailableCombo = possibleCombo;

                return {
                    sku: comp.child_product?.sku || '',
                    name: comp.child_product?.name || '',
                    quantity_per_combo: qtyPerCombo,
                    total_needed: totalNeeded,
                    available: childAvailable,
                    sufficient: childAvailable >= totalNeeded
                };
            });
            
            if (minAvailableCombo !== Infinity) {
                stock = minAvailableCombo;
            } else {
                stock = 0;
            }
        }


        return {
            id: item.id,
            sku: item.sku,
            stock,
            ordered,
            delivered,
            pending,
            remaining,
            totalVal: ordered * price,
            deliveredVal: delivered * price,
            pendingVal: pending * price,
            remainingVal: remaining * price,
            bookingStatus: item.booking_status || 'NONE',
            bookedQuantity: item.booked_quantity || 0,
            isCombo,
            comboChildren
        };
    });

    const [bookingLoadingId, setBookingLoadingId] = useState<number | null>(null);

    const handleBookSingleItem = async (item: any) => {
        if (!order?.id) return;
        try {
            setBookingLoadingId(item.id);
            const res = await api.post(`/sales/${order.id}/book-items`, {
                items: [{ itemId: item.id, quantity: item.remaining }]
            });
            if (res.data?.success === false) {
                message.error(res.data.errors?.join(', ') || 'Không thể giữ kho');
            } else {
                message.success(res.data?.message || 'Đã giữ kho thành công');
                onSuccess();
            }
        } catch (e: any) {
            message.error(e.response?.data?.message || 'Lỗi khi giữ kho');
        } finally {
            setBookingLoadingId(null);
        }
    };

    const openCreateModal = () => {
        setEditingDeliveryId(null);
        setIsDraft(false);
        setShipStatus('PENDING_EXPORT');
        setShipItems(summaryData.map((d: any) => {
            const canShip = d.bookingStatus === 'CONFIRMED' && d.remaining > 0;
            return {
                sku: d.sku, 
                max: d.remaining, 
                quantity: canShip ? d.remaining : 0,
                bookingStatus: d.bookingStatus
            };
        }));
        setShipNote('');

        // Auto-fill defaults
        setShipDate(dayjs());
        setShipAddress(order.shipping_address || fullCustomer?.address || '');
        setShipContactName(order.receiver_name || contactList[0]?.full_name || fullCustomer?.name || '');
        setShipContactPhone(order.receiver_phone || contactList[0]?.phone || fullCustomer?.phone || '');
        setAttachments([]);

        // Reset shipping carrier fields
        setShippingCarrier(order.shipping_carrier || '');
        setTrackingCode('');
        setShippingCost(0);

        setIsModalOpen(true);
    };

    const openEditModal = (delivery: any) => {
        setEditingDeliveryId(delivery.id);
        setIsDraft(delivery.status === 'DRAFT');
        setShipStatus(delivery.status || 'PENDING_EXPORT');
        setShipDate(dayjs(delivery.delivery_date));
        setShipAddress(delivery.delivery_address || '');
        setShipContactName(delivery.contact_name || '');
        setShipContactPhone(delivery.contact_phone || '');
        setShipNote(delivery.note || '');
        setAttachments(delivery.attachments || []);

        // Load shipping carrier fields
        setShippingCarrier(delivery.shipping_carrier || '');
        setTrackingCode(delivery.tracking_code || '');
        setShippingCost(Number(delivery.shipping_cost) || 0);

        // Calculate Ship Items
        // Merge Order Items (summaryData) with Delivery Items
        const mergedItems = summaryData.map((d: any) => {
            const deliveredItem = delivery.items?.find((i: any) => i.sku === d.sku);
            const currentQtyInDelivery = deliveredItem ? Number(deliveredItem.quantity) : 0;
            const max = d.remaining + currentQtyInDelivery;

            return {
                sku: d.sku,
                max: max,
                quantity: currentQtyInDelivery,
                bookingStatus: d.bookingStatus
            };
        });
        setShipItems(mergedItems);
        setIsModalOpen(true);
    };

    const openUploadModal = (delivery: any) => {
        setUploadDeliveryId(delivery.id);
        setUploadAttachments(delivery.attachments || []);
        setUploadModalOpen(true);
    };

    const handleUploadSave = async () => {
        if (!uploadDeliveryId) return;
        try {
            await api.put(`/sales/delivery/${uploadDeliveryId}`, {
                attachments: uploadAttachments
            });
            message.success('Đã cập nhật chứng từ');
            setUploadModalOpen(false);
            fetchHistory();
        } catch (e) {
            message.error('Lỗi cập nhật');
        }
    };

    const handleShip = async () => {
        try {
            const payload = {
                code: editingDeliveryId ? undefined : `PXK-${dayjs(shipDate).format('DDMMYY')}-${Math.floor(1000 + Math.random() * 9000)}`,
                date: shipDate ? shipDate.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
                note: shipNote,
                delivery_address: shipAddress,
                contact_name: shipContactName,
                contact_phone: shipContactPhone,
                items: shipItems.filter(i => i.quantity > 0),
                attachments: attachments,
                shipping_carrier: shippingCarrier,
                tracking_code: trackingCode,
                shipping_cost: shippingCost,
                status: isDraft ? 'DRAFT' : (editingDeliveryId ? shipStatus : 'PENDING_EXPORT')
            };

            if (editingDeliveryId) {
                await api.put(`/sales/delivery/${editingDeliveryId}`, payload);
                message.success('Đã cập nhật phiếu xuất kho');
            } else {
                await api.post(`/sales/${order.id}/delivery`, payload);
                message.success('Đã xuất kho');
            }

            setIsModalOpen(false); fetchHistory(); onSuccess();
        } catch (e: any) { message.error(e.response?.data?.message || 'Lỗi lưu phiếu xuất kho'); }
    };

    const handlePrint = (delivery: any) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        // Map Items for Print
        const printItems = (delivery.items || []).map((di: any, idx: number) => {
            const product = products.find(p => p.value === di.sku);
            // Fallback for color/variant if stored in order items
            const orderItem = order?.items?.find((oi: any) => oi.sku === di.sku);

            const defaultName = product ? (product.name || product.label?.split(' - ')[1] || product.label) : di.sku;
            return {
                index: idx + 1,
                name: orderItem?.vat_content || orderItem?.vat_description || defaultName,
                sku: di.sku,
                unit: product?.unit || 'Cái',
                qty: di.quantity,
                note: orderItem?.variant_color || di.note || '' // Try to show variant color/note
            };
        });

        // Resolve Info
        const dAddr = delivery.delivery_address || (order.shipping_address || order.customer?.address || '-');

        // IMPORTANT: Must use delivery specific contact first, usually saved in delivery.contact_name
        const dContactName = delivery.contact_name || (order.receiver_name || order.customer?.name || '-');
        const dContactPhone = delivery.contact_phone || (order.receiver_phone || order.customer?.phone || '');

        // Format: Name - Phone
        const fullContact = dContactPhone ? `${dContactName} - ${dContactPhone}` : dContactName;

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>In Phiếu Xuất Kho - ${delivery.code}</title>
                <style>
                    body { font-family: 'Times New Roman', Times, serif; padding: 20px; font-size: 14px; }
                    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #0050b3; padding-bottom: 10px; }
                    .company-info { width: 60%; }
                    .company-info h1 { margin: 0; color: #0050b3; font-size: 24px; text-transform: uppercase; }
                    .company-info p { margin: 2px 0; font-size: 13px; }
                    .header-logo { width: 60%; text-align: left; }
                    .title-section { text-align: center; width: 40%; }
                    .title-section h2 { margin: 0 0 5px; font-size: 24px; text-transform: uppercase; }
                    .info-grid { margin-bottom: 20px; }
                    .info-row { display: flex; margin-bottom: 8px; }
                    .info-label { width: 130px; font-weight: bold; }
                    .info-val { flex: 1; }

                    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                    th, td { border: 1px solid #000; padding: 8px; text-align: center; }
                    th { background-color: #fce4d6; font-weight: bold; }

                    .footer { display: flex; justify-content: space-between; text-align: center; margin-top: 50px; }
                    .footer-col { width: 30%; }
                    .footer-col .role { font-weight: bold; margin-bottom: 80px; }
                    .note-bottom { font-style: italic; font-size: 12px; margin-top: 40px; border-top: 1px solid #eee; padding-top: 10px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="header-logo">
                        <img src="${window.location.origin}/company_header.png" alt="Company Header" style="max-height: 80px; max-width: 100%;" />
                    </div>
                    <div class="title-section">
                        <h2>PHIẾU XUẤT KHO</h2>
                        <div style="font-style:italic; font-size: 14px;">Ngày ${dayjs(delivery.delivery_date).format('DD')} tháng ${dayjs(delivery.delivery_date).format('MM')} năm ${dayjs(delivery.delivery_date).format('YYYY')}</div>
                        <div style="margin-top:5px; font-size:12px; font-style:italic;">Số PXK: <b>${delivery.code}</b></div>
                    </div>
                </div>

                <div class="info-grid">
                    <div class="info-row">
                        <div class="info-label">Khách hàng:</div>
                        <div class="info-val" style="text-transform:uppercase; font-weight:bold;">${order.customer_name || order.customer?.name}</div>
                        <div style="font-size:12px;">Số BG: <b>${order.order_code}</b></div>
                    </div>
                    <div class="info-row">
                        <div class="info-label">Địa chỉ giao hàng:</div>
                        <div class="info-val">${dAddr}</div>
                    </div>
                    <div class="info-row">
                        <div class="info-label">Liên hệ:</div>
                        <div class="info-val">${fullContact}</div>
                    </div>
                    <div class="info-row">
                        <div class="info-label">Xuất tại kho:</div>
                        <div class="info-val">Kho Thành Phẩm (Trung tâm)</div>
                    </div>
                    ${delivery.note ? `<div class="info-row"><div class="info-label">Ghi chú phiếu:</div><div class="info-val">${delivery.note}</div></div>` : ''}
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width: 50px;">STT</th>
                            <th>Tên Sản phẩm</th>
                            <th style="width: 80px;">ĐVT</th>
                            <th style="width: 80px;">Số lượng</th>
                            <th style="width: 150px;">Ghi chú</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${printItems.map((item: any) => `
                        <tr>
                            <td>${item.index}</td>
                            <td style="text-align:left;">
                                <div style="font-weight:bold;">${item.name}</div>
                                <div style="font-size:12px; font-style:italic; color:#555;">${item.sku}</div>
                            </td>
                            <td>${item.unit}</td>
                            <td>${item.qty}</td>
                            <td style="text-align:left;">${item.note}</td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="footer">
                    <div class="footer-col">
                        <div class="role">Người nhận hàng</div>
                        <div>(Ký và ghi rõ họ tên)</div>
                    </div>
                    <div class="footer-col">
                        <div class="role">Người lập phiếu</div>
                        <div style="margin-top:70px; font-weight:bold;">${order.assigned_to?.full_name || 'Admin'}</div>
                    </div>
                    <div class="footer-col">
                        <div class="role">Thủ kho</div>
                        <div>(Ký xác nhận)</div>
                    </div>
                </div>

                <div class="note-bottom" style="text-align: center; font-weight: bold;">
                    Quý khách vui lòng ký nhận vào PXK này gửi lại cho NV giao hàng (TP. HCM) hoặc scan/chụp gửi xác nhận cho ERP4U (Ngoài TP.HCM).<br/>
                    Đây là cơ sở để xác nhận KH đã nhận đủ số lượng và ERP4U tiếp nhận giải quyết các vấn đề về hàng hóa.
                </div>

                <script>
                    window.onload = function() { window.print(); }
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
    };

    return (
        <div>
            <div style={{ marginBottom: 20, background: '#f0f5ff', padding: 10, borderRadius: 6, border: '1px solid #adc6ff' }}>
                <div style={{ fontWeight: 'bold', marginBottom: 5, color: '#1d39c4' }}>Tiến độ giao hàng:</div>
                <Table dataSource={summaryData} rowKey="sku" pagination={false} size="small" bordered
                    expandable={{
                        expandedRowRender: (record: any) => {
                            if (!record.isCombo || !record.comboChildren?.length) return null;
                            return (
                                <div style={{ padding: '4px 0 4px 20px', background: '#fafafa' }}>
                                    <div style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 6, color: '#722ed1' }}>
                                        <AppstoreOutlined /> Thành phần Combo ({record.comboChildren.length} sản phẩm con):
                                    </div>
                                    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ background: '#f0f0f0' }}>
                                                <th style={{ padding: '4px 8px', textAlign: 'left', border: '1px solid #e8e8e8' }}>SKU Con</th>
                                                <th style={{ padding: '4px 8px', textAlign: 'left', border: '1px solid #e8e8e8' }}>Tên sản phẩm</th>
                                                <th style={{ padding: '4px 8px', textAlign: 'center', border: '1px solid #e8e8e8' }}>SL/Combo</th>
                                                <th style={{ padding: '4px 8px', textAlign: 'center', border: '1px solid #e8e8e8' }}>Cần</th>
                                                <th style={{ padding: '4px 8px', textAlign: 'center', border: '1px solid #e8e8e8' }}>TK khả dụng</th>
                                                <th style={{ padding: '4px 8px', textAlign: 'center', border: '1px solid #e8e8e8' }}>Trạng thái</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {record.comboChildren.map((child: any, idx: number) => (
                                                <tr key={idx}>
                                                    <td style={{ padding: '4px 8px', border: '1px solid #e8e8e8', fontWeight: 500 }}>{child.sku}</td>
                                                    <td style={{ padding: '4px 8px', border: '1px solid #e8e8e8' }}>{child.name}</td>
                                                    <td style={{ padding: '4px 8px', textAlign: 'center', border: '1px solid #e8e8e8' }}>x{child.quantity_per_combo}</td>
                                                    <td style={{ padding: '4px 8px', textAlign: 'center', border: '1px solid #e8e8e8', fontWeight: 'bold' }}>{child.total_needed}</td>
                                                    <td style={{ padding: '4px 8px', textAlign: 'center', border: '1px solid #e8e8e8', fontWeight: 'bold', color: child.sufficient ? '#52c41a' : '#f5222d' }}>{child.available}</td>
                                                    <td style={{ padding: '4px 8px', textAlign: 'center', border: '1px solid #e8e8e8' }}>
                                                        {child.sufficient
                                                            ? <Tag color="green" style={{ margin: 0, fontSize: 11 }}>Đủ</Tag>
                                                            : <Tag color="red" style={{ margin: 0, fontSize: 11 }}>Thiếu {child.total_needed - child.available}</Tag>
                                                        }
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            );
                        },
                        rowExpandable: (record: any) => record.isCombo && record.comboChildren?.length > 0,
                    }}
                    columns={[
                        { title: 'SKU', dataIndex: 'sku', render: (v: string, r: any) => (
                            <span>
                                {r.isCombo && <AppstoreOutlined style={{ color: '#722ed1', marginRight: 4 }} />}
                                {v}
                                {r.isCombo && <Tag color="purple" style={{ margin: '0 0 0 6px', fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>COMBO</Tag>}
                            </span>
                        )},
                        { title: 'Trạng thái', width: 100, align: 'center', render: (r: any) => {
                            if (r.remaining <= 0) return <Tag color="blue" style={{ margin: 0 }}>Đã giao đủ</Tag>;
                            if (r.bookingStatus === 'CONFIRMED') return <Tag color="green" style={{ margin: 0 }}>Sẵn sàng</Tag>;
                            if (r.bookingStatus === 'TEMPORARY') return <Tag color="orange" style={{ margin: 0 }}>Chưa duyệt</Tag>;
                            
                            return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                                    <Tag style={{ margin: 0 }}>Chưa giữ kho</Tag>
                                    {r.remaining > 0 && (
                                        <Button 
                                            size="small" 
                                            type="primary" 
                                            ghost 
                                            loading={bookingLoadingId === r.id}
                                            onClick={() => handleBookSingleItem(r)}
                                            style={{ fontSize: 10, padding: '0 8px', height: 22 }}
                                        >
                                            Book kho
                                        </Button>
                                    )}
                                </div>
                            );
                        }},
                        { title: 'TK khả dụng', dataIndex: 'stock', align: 'center', width: 90, render: (v: any, r: any) => (
                            <span style={{ color: v > 0 ? '#52c41a' : '#f5222d', fontWeight: 'bold' }}>
                                {v}
                                {r.isCombo && <Tooltip title="Expand để xem tồn kho từng SP con"><AppstoreOutlined style={{ marginLeft: 4, color: '#722ed1', fontSize: 11 }} /></Tooltip>}
                            </span>
                        )},
                        { title: 'SL Đặt', dataIndex: 'ordered', align: 'center', width: 70 },
                        { title: 'Chờ xuất', dataIndex: 'pending', align: 'center', width: 70, render: (v: any) => v > 0 ? <b style={{ color: '#faad14' }}>{v}</b> : <span style={{ color: '#ccc' }}>0</span> },
                        { title: 'Đã giao', dataIndex: 'delivered', align: 'center', width: 70, render: (v: any) => <b style={{ color: 'green' }}>{v}</b> },
                        { title: 'Còn lại', dataIndex: 'remaining', align: 'center', width: 70, render: (v: any) => v > 0 ? <b style={{ color: 'red' }}>{v}</b> : <CheckCircleOutlined style={{ color: 'green' }} /> },

                        { title: 'Tổng tiền hàng', dataIndex: 'totalVal', align: 'right', render: (v: number) => v.toLocaleString() },
                        { title: 'Đã giao (đ)', dataIndex: 'deliveredVal', align: 'right', render: (v: number) => <span style={{ color: 'green' }}>{v.toLocaleString()}</span> },
                        { title: 'Còn lại (đ)', dataIndex: 'remainingVal', align: 'right', render: (v: number) => <span style={{ color: 'red', fontWeight: 'bold' }}>{v.toLocaleString()}</span> },
                    ]}
                    summary={(pageData: readonly any[]) => {
                        let totalAmount = 0;
                        let totalDelivered = 0;
                        let totalPending = 0;
                        let totalRemaining = 0;

                        pageData.forEach((item) => {
                            totalAmount += (item.totalVal || 0);
                            totalDelivered += (item.deliveredVal || 0);
                            totalPending += (item.pendingVal || 0);
                            totalRemaining += (item.remainingVal || 0);
                        });

                        return (
                            <Table.Summary.Row style={{ background: '#fafafa', fontWeight: 'bold' }}>
                                <Table.Summary.Cell index={0} colSpan={6} align="right">Tổng cộng:</Table.Summary.Cell>
                                <Table.Summary.Cell index={1} align="right">{totalAmount.toLocaleString()}</Table.Summary.Cell>
                                <Table.Summary.Cell index={2} align="right"><span style={{ color: 'green' }}>{totalDelivered.toLocaleString()}</span></Table.Summary.Cell>
                                <Table.Summary.Cell index={3} align="right"><span style={{ color: 'red' }}>{totalRemaining.toLocaleString()}</span></Table.Summary.Cell>
                            </Table.Summary.Row>
                        );
                    }}
                />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <b>Lịch sử phiếu giao:</b>
                {order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
                    <Button type="primary" size="small" icon={<CarOutlined />} onClick={openCreateModal}>Tạo Phiếu Xuất Kho</Button>
                )}
            </div>
            <Table dataSource={history} rowKey="id" pagination={false} size="small" bordered columns={[
                { title: 'Mã phiếu', dataIndex: 'code', render: (t: any) => <b>{t}</b> },
                { title: 'Ngày giao', render: (r: any) => dayjs(r.delivery_date).format('DD/MM/YYYY') },
                {
                    title: 'Trạng thái', align: 'center', render: (r: any) => (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <Tag color={r.status === 'SHIPPED' ? 'green' : r.status === 'DRAFT' ? 'default' : 'orange'}>
                                {r.status === 'SHIPPED' ? 'Đã báo khách' : r.status === 'DRAFT' ? 'Phiếu nháp' : 'Đang giao'}
                            </Tag>
                            {r.email_sent && <span style={{ fontSize: 10, color: 'green' }}><CheckCircleOutlined /> Email: Sent</span>}
                        </div>
                    )
                },
                { title: 'Người công trình', render: (r) => (r.contact_name ? <span>{r.contact_name} <br /><small>{r.contact_phone}</small></span> : '-') },
                {
                    title: 'Chi tiết', width: '35%', render: (r: any) => (
                        <div>
                            <div>{r.items?.map((i: any) => `${i.sku} (x${i.quantity})`).join(', ')}</div>
                            {(r.shipping_carrier || r.tracking_code || Number(r.shipping_cost) > 0) && (
                                <div style={{ marginTop: 4, fontSize: 12, color: '#1d39c4', background: '#f0f5ff', padding: '3px 6px', borderRadius: 4 }}>
                                    <CarOutlined style={{ marginRight: 4 }} />
                                    {r.shipping_carrier && <span>{r.shipping_carrier}</span>}
                                    {r.tracking_code && <span> • <b>{r.tracking_code}</b></span>}
                                    {Number(r.shipping_cost) > 0 && <span> • {Number(r.shipping_cost).toLocaleString()}đ</span>}
                                </div>
                            )}
                            {r.note && (
                                <div style={{ marginTop: 3, fontSize: 12, color: '#595959', fontStyle: 'italic' }}>
                                    📝 {r.note}
                                </div>
                            )}
                        </div>
                    )
                },
                {
                    title: 'Chứng từ',
                    width: 200,
                    render: (r) => (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ flex: 1 }}>
                                {r.attachments?.length > 0 ? <AttachmentUpload value={r.attachments} maxFiles={0} /> : <span style={{ color: '#999', fontSize: 12 }}>Chưa có</span>}
                            </div>
                            <Tooltip title="Tải lên chứng từ (phiếu đã ký...)">
                                <Button size="small" type="text" icon={<UploadOutlined style={{ color: '#1890ff' }} />} onClick={() => openUploadModal(r)} />
                            </Tooltip>
                        </div>
                    )
                },
                {
                    title: '', width: 120, align: 'center', render: (_: any, r: any) => (
                        <div style={{ display: 'flex', gap: 5, justifyContent: 'center', flexWrap: 'wrap' }}>
                            {r.status === 'DRAFT' && (
                                <Tooltip title="Chuyển thành phiếu chính thức (Chờ xuất kho)">
                                    <Button size="small" type="primary" style={{ background: '#52c41a', borderColor: '#52c41a' }} onClick={async () => {
                                        try {
                                            await api.put(`/sales/delivery/${r.id}`, { status: 'PENDING_EXPORT' });
                                            message.success('Đã chuyển thành phiếu chính thức');
                                            fetchHistory();
                                        } catch (e: any) {
                                            message.error(e.response?.data?.message || 'Không thể cập nhật trạng thái');
                                        }
                                    }}>Duyệt phiếu</Button>
                                </Tooltip>
                            )}
                            <Tooltip title="In Phiếu Xuất Kho">
                                <Button size="small" icon={<PrinterOutlined />} onClick={() => handlePrint(r)} />
                            </Tooltip>
                            {order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
                                <>
                                    <Tooltip title="Sửa phiếu">
                                        <Button size="small" icon={<EditOutlined />} onClick={() => openEditModal(r)} />
                                    </Tooltip>
                                    <Tooltip title="Xóa phiếu">
                                        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteDelivery(r.id)} />
                                    </Tooltip>
                                </>
                            )}
                            <Tooltip title="Gửi Email thông báo khách hàng">
                                <Button size="small" icon={<MailOutlined />} onClick={async () => {
                                    try {
                                        Modal.confirm({
                                            title: 'Gửi Email thông báo?',
                                            content: 'Hệ thống sẽ gửi email thông báo giao hàng cho khách hàng theo mẫu.',
                                            onOk: async () => {
                                                await api.post(`/sales/delivery/${r.id}/email`);
                                                message.success('Đã gửi email thành công');
                                                fetchHistory();
                                            }
                                        });
                                    } catch (e) { message.error('Lỗi gửi email: Cần cấu hình SMTP'); }
                                }} />
                            </Tooltip>
                        </div>
                    )
                }
            ]} />

            <Modal title={editingDeliveryId ? "Cập nhật Phiếu Xuất Kho" : "Tạo Phiếu Xuất Kho"} open={isModalOpen} onCancel={() => setIsModalOpen(false)} onOk={handleShip} width={600}>
                {/* DATE SELECTION */}
                <div style={{ display: 'flex', gap: 15, marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500 }}>Loại phiếu:</div>
                        <Select
                            style={{ width: '100%' }}
                            value={isDraft}
                            onChange={(draft) => {
                                setIsDraft(draft);
                                if (!editingDeliveryId) {
                                    setShipItems(summaryData.map((d: any) => {
                                        const canShip = draft || (d.bookingStatus === 'CONFIRMED' && d.remaining > 0);
                                        return {
                                            sku: d.sku, 
                                            max: d.remaining, 
                                            quantity: canShip ? d.remaining : 0,
                                            bookingStatus: d.bookingStatus
                                        };
                                    }));
                                }
                            }}
                            options={[
                                { value: false, label: 'Chính thức (Xuất kho)' },
                                { value: true, label: 'Bản nháp (Chỉ in/gửi khách)' }
                            ]}
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500 }}>Ngày xuất kho:</div>
                        <DatePicker format="DD/MM/YYYY" value={shipDate} onChange={setShipDate} style={{ width: '100%' }} />
                    </div>
                </div>

                {/* ADDRESS SELECTION */}
                <div style={{ marginBottom: 10 }}>
                    <div style={{ fontWeight: 500 }}>Chọn Chi Nhánh / Địa chỉ giao hàng:</div>
                    <Select
                        style={{ width: '100%' }}
                        value={shipAddress}
                        onChange={setShipAddress}
                        placeholder="Chọn địa chỉ giao hàng"
                        options={[
                            { value: fullCustomer?.address || '', label: `Mặc định: ${fullCustomer?.address || 'Chưa cập nhật'}` },
                            ...(fullCustomer?.delivery_addresses || []).map((addr: any) => ({
                                value: addr.address, label: `${addr.name || 'CN'} - ${addr.address}`
                            }))
                        ]}
                    />
                    <Input
                        style={{ marginTop: 5 }}
                        placeholder="Hoặc nhập địa chỉ khác..."
                        value={shipAddress}
                        onChange={e => setShipAddress(e.target.value)}
                    />
                </div>

                {/* CONTACT SELECTION */}
                <div style={{ marginBottom: 10 }}>
                    <div style={{ fontWeight: 500 }}>Người liên hệ nhận hàng:</div>
                    <Select
                        style={{ width: '100%' }}
                        placeholder="Chọn người liên hệ"
                        value={shipContactName}
                        onChange={(val) => {
                            // Find contact to auto-fill Phone
                            const contact = contactList.find((c: any) => c.full_name === val);
                            setShipContactName(val);
                            if (contact) setShipContactPhone(contact.phone);
                        }}
                        options={[
                            ...(contactList).map((c: any) => ({
                                value: c.full_name, label: `${c.full_name} - ${c.position || ''} (${c.phone})`
                            }))
                        ]}
                    />
                    <div style={{ display: 'flex', gap: 10, marginTop: 5 }}>
                        <Input placeholder="Tên người nhận" value={shipContactName} onChange={e => setShipContactName(e.target.value)} />
                        <Input placeholder="SĐT Liên hệ" value={shipContactPhone} onChange={e => setShipContactPhone(e.target.value)} />
                    </div>
                </div>

                {editingDeliveryId && (
                    <div style={{ marginBottom: 10 }}>
                        <div style={{ fontWeight: 500 }}>Trạng thái phiếu:</div>
                        <Select
                            style={{ width: '100%' }}
                            value={shipStatus}
                            onChange={setShipStatus}
                            options={[
                                { value: 'PENDING_EXPORT', label: 'Chờ xuất / Đang giao' },
                                { value: 'SHIPPED', label: 'Đã giao hàng / Đã báo khách' },
                            ]}
                        />
                    </div>
                )}

                {/* SHIPPING CARRIER FIELDS */}
                <div style={{ marginBottom: 10, padding: 10, background: '#f0f5ff', borderRadius: 6, border: '1px solid #adc6ff' }}>
                    <div style={{ fontWeight: 500, marginBottom: 8, color: '#1d39c4' }}>Thông tin vận chuyển:</div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <div style={{ flex: 2 }}>
                            <div style={{ fontSize: 12, marginBottom: 4 }}>Đơn vị vận chuyển</div>
                            <Select
                                style={{ width: '100%' }}
                                placeholder="Chọn ĐVVC"
                                value={shippingCarrier || undefined}
                                onChange={setShippingCarrier}
                                allowClear
                                options={carriers.map((c: any) => ({ value: c.code, label: c.name }))}
                            />
                        </div>
                        <div style={{ flex: 2 }}>
                            <div style={{ fontSize: 12, marginBottom: 4 }}>Mã vận đơn</div>
                            <Input placeholder="VD: GHN123456" value={trackingCode} onChange={e => setTrackingCode(e.target.value)} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, marginBottom: 4 }}>Chi phí VC</div>
                            <InputNumber
                                style={{ width: '100%' }}
                                placeholder="0"
                                value={shippingCost}
                                onChange={(v: any) => setShippingCost(v || 0)}
                                formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                            />
                        </div>
                    </div>
                </div>

                <Input.TextArea rows={2} placeholder="Ghi chú giao hàng..." value={shipNote} onChange={e => setShipNote(e.target.value)} style={{ marginBottom: 10 }} />

                <div style={{ marginBottom: 10 }}>
                    <AttachmentUpload value={attachments} onChange={setAttachments} />
                </div>

                <div style={{ fontWeight: 'bold', marginTop: 15, marginBottom: 5 }}>Danh sách xuất:</div>
                {!isDraft && <div style={{ fontSize: 12, color: 'red', marginBottom: 10, fontStyle: 'italic' }}>* Lưu ý: Chỉ được phép xuất kho các sản phẩm đã được duyệt giữ kho (Trạng thái: Sẵn sàng).</div>}
                {isDraft && <div style={{ fontSize: 12, color: '#1890ff', marginBottom: 10, fontStyle: 'italic' }}>* Đang tạo Phiếu Nháp: Có thể điền số lượng tự do không cần giữ kho. Tồn kho sẽ KHÔNG bị trừ.</div>}
                <Table dataSource={shipItems} rowKey="sku" pagination={false} size="small" columns={[
                    { title: 'SKU', dataIndex: 'sku' },
                    { title: 'Trạng thái', width: 90, align: 'center', render: (r: any) => {
                        if (r.bookingStatus === 'CONFIRMED') return <Tag color="green" style={{ margin: 0 }}>Sẵn sàng</Tag>;
                        if (r.bookingStatus === 'TEMPORARY') return <Tag color="orange" style={{ margin: 0 }}>Chưa duyệt</Tag>;
                        return <Tag style={{ margin: 0 }}>Chưa giữ kho</Tag>;
                    }},
                    { title: 'SL Cần giao', dataIndex: 'max' },
                    { title: 'Giao lần này', render: (_: any, r: any, idx: number) => (
                        <InputNumber 
                            max={r.max} 
                            min={0} 
                            value={r.quantity} 
                            disabled={!isDraft && r.bookingStatus !== 'CONFIRMED'} 
                            onChange={(v: any) => { const newItems = [...shipItems]; newItems[idx].quantity = v || 0; setShipItems(newItems); }} 
                        />
                    )}
                ]} />
            </Modal>

            {/* Quick Upload Modal */}
            <Modal title="Cập nhật chứng từ giao hàng" open={uploadModalOpen} onCancel={() => setUploadModalOpen(false)} onOk={handleUploadSave} width={500}>
                <div style={{ marginBottom: 15 }}>Tải lên hình ảnh chứng thực giao hàng (Phiếu xuất kho có ký nhận, hình ảnh hàng hóa tại công trình...)</div>
                <AttachmentUpload value={uploadAttachments} onChange={setUploadAttachments} />
            </Modal>
        </div>
    );
}
export default SalesDeliveries;