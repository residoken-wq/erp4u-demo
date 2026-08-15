import React, { useState, useEffect } from 'react';
import { Layout, Typography, Card, Table, Button, Tabs, Space, Modal, Form, InputNumber, Input, Select, message, Tag, Popconfirm, Row, Col, Tooltip } from 'antd';
import { PlusOutlined, HistoryOutlined, CheckCircleOutlined, AppstoreOutlined, DeleteOutlined, EditOutlined, FileImageOutlined } from '@ant-design/icons';
import api from '../../utils/api';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Option } = Select;

const getGoogleDriveImageUrl = (link: string) => {
    if (!link) return null;
    try {
        if (link.includes('drive.google.com')) {
            const idMatch = link.match(/\/d\/(.*?)\//) || link.match(/id=(.*?)(&|$)/);
            if (idMatch && idMatch[1]) return `https://drive.google.com/uc?id=${idMatch[1]}`;
        }
        return link;
    } catch { return link; }
};

const SampleInventoryPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState('stocks');
    const [stocks, setStocks] = useState<any[]>([]);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [salesOrders, setSalesOrders] = useState<any[]>([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
    const [searchText, setSearchText] = useState('');
    
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState<'IMPORT' | 'EXPORT'>('IMPORT');
    const [editingTxId, setEditingTxId] = useState<number | null>(null);
    
    const [form] = Form.useForm();
    const [selectedItems, setSelectedItems] = useState<{product_id: number, quantity: number, note: string}[]>([]);

    useEffect(() => {
        fetchProducts();
        fetchSalesAndCustomers();
        if (activeTab === 'stocks') fetchStocks();
        if (activeTab === 'transactions') fetchTransactions();
    }, [activeTab]);

    const fetchSalesAndCustomers = async () => {
        try {
            const [custRes, soRes] = await Promise.all([
                api.get('/customers'),
                api.get('/sales')
            ]);
            setCustomers(Array.isArray(custRes.data) ? custRes.data : []);
            setSalesOrders(Array.isArray(soRes.data) ? soRes.data : []);
        } catch (e) {
            console.error('Error fetching customers or SOs');
        }
    };

    const fetchProducts = async () => {
        try {
            const res = await api.get('/products');
            setProducts(res.data);
        } catch (e) {
            console.error(e);
        }
    }

    const fetchStocks = async () => {
        setLoading(true);
        try {
            const res = await api.get('/inventory/samples/stocks');
            setStocks(res.data);
        } catch (e) {
            message.error('Lỗi tải tồn kho mẫu');
        } finally {
            setLoading(false);
        }
    };

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            const res = await api.get('/inventory/samples/transactions');
            setTransactions(res.data);
        } catch (e) {
            message.error('Lỗi tải lịch sử');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTransaction = async (values: any) => {
        if (selectedItems.length === 0) {
            message.warning('Vui lòng thêm ít nhất 1 sản phẩm');
            return;
        }

        try {
            const payload = {
                type: modalType,
                reference_type: values.reference_type,
                reference_id: values.reference_id, 
                customer_id: selectedCustomerId,
                deposit_amount: values.deposit_amount,
                note: values.note,
                receiver_name: values.receiver_name,
                receiver_phone: values.receiver_phone,
                receiver_address: values.receiver_address,
                items: selectedItems
            };

            if (editingTxId) {
                await api.put(`/inventory/samples/transactions/${editingTxId}`, payload);
                message.success('Cập nhật phiếu thành công!');
            } else {
                await api.post('/inventory/samples/transactions', payload);
                message.success('Tạo phiếu thành công! Vui lòng [Duyệt] phiếu để cập nhật tồn kho.');
            }
            
            setIsModalOpen(false);
            if (activeTab === 'transactions') fetchTransactions();
            else setActiveTab('transactions');
        } catch (e: any) {
            message.error(e.response?.data?.message || 'Có lỗi xảy ra');
        }
    };

    const handleEditTransaction = (tx: any) => {
        setEditingTxId(tx.id);
        setModalType(tx.type);
        setSelectedCustomerId(tx.customer_id);
        
        form.setFieldsValue({
            customer_id: tx.customer_id,
            reference_type: tx.reference_type,
            reference_id: tx.reference_id,
            deposit_amount: tx.deposit_amount,
            note: tx.note,
            receiver_name: tx.receiver_name,
            receiver_phone: tx.receiver_phone,
            receiver_address: tx.receiver_address,
        });
        
        setSelectedItems((tx.items || []).map((i: any) => ({
            product_id: i.product_id,
            quantity: i.quantity,
            note: i.note || ''
        })));
        
        setIsModalOpen(true);
    };

    const handleConfirmTransaction = async (id: number) => {
        try {
            await api.post(`/inventory/samples/transactions/${id}/confirm`);
            message.success('Đã xác nhận phiếu!');
            fetchTransactions();
        } catch (e: any) {
            message.error(e.response?.data?.message || 'Có lỗi xảy ra');
        }
    };

    const handleDeleteTransaction = async (id: number) => {
        try {
            await api.delete(`/inventory/samples/transactions/${id}`);
            message.success('Đã xóa phiếu!');
            fetchTransactions();
        } catch (e: any) {
            message.error(e.response?.data?.message || 'Không thể xóa phiếu');
        }
    };

    const handlePrintExport = (tx: any) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return message.error('Vui lòng cho phép popup để in');

        const customerName = tx.receiver_name || tx.customer?.name || '..............................................';
        const customerAddress = tx.receiver_address || tx.customer?.address || '..............................................';
        const customerPhone = tx.receiver_phone || tx.customer?.phone || '......................';
        const deposit = tx.deposit_amount ? Number(tx.deposit_amount).toLocaleString('vi-VN') + ' VNĐ' : '0 VNĐ';
        const refOrder = tx.reference_type ? `${tx.reference_type} #${tx.reference_id || ''}` : '';

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>In Phiếu Xuất Kho Hàng Mẫu - ${tx.code}</title>
                <style>
                    body { font-family: 'Times New Roman', Times, serif; padding: 20px; font-size: 14px; }
                    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #0050b3; padding-bottom: 10px; }
                    .company-info { width: 60%; }
                    .company-info h1 { margin: 0; color: #0050b3; font-size: 24px; text-transform: uppercase; }
                    .company-info p { margin: 2px 0; font-size: 13px; }
                    .header-logo { width: 60%; text-align: left; }
                    .title-section { text-align: center; width: 40%; }
                    .title-section h2 { margin: 0 0 5px; font-size: 22px; text-transform: uppercase; }
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
                        <h2>PHIẾU XUẤT KHO<br>HÀNG MẪU</h2>
                        <div style="font-style:italic; font-size: 14px;">Ngày ${dayjs(tx.created_at).format('DD')} tháng ${dayjs(tx.created_at).format('MM')} năm ${dayjs(tx.created_at).format('YYYY')}</div>
                        <div style="margin-top:5px; font-size:12px; font-style:italic;">Số PXK: <b>${tx.code}</b></div>
                    </div>
                </div>

                <div class="info-grid">
                    <div class="info-row">
                        <div class="info-label">Khách hàng nhận:</div>
                        <div class="info-val" style="text-transform:uppercase; font-weight:bold;">${customerName}</div>
                        ${refOrder ? `<div style="font-size:12px;">Kèm đơn: <b>${refOrder}</b></div>` : ''}
                    </div>
                    <div class="info-row">
                        <div class="info-label">Địa chỉ:</div>
                        <div class="info-val">${customerAddress}</div>
                    </div>
                    <div class="info-row">
                        <div class="info-label">Điện thoại:</div>
                        <div class="info-val">${customerPhone}</div>
                    </div>
                    ${tx.deposit_amount ? `
                    <div class="info-row">
                        <div class="info-label">Tiền cọc mẫu:</div>
                        <div class="info-val" style="font-weight:bold; color:red;">${deposit}</div>
                    </div>
                    ` : ''}
                    ${tx.note ? `<div class="info-row"><div class="info-label">Ghi chú phiếu:</div><div class="info-val">${tx.note}</div></div>` : ''}
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width: 50px;">STT</th>
                            <th>Tên Sản Phẩm Mẫu</th>
                            <th style="width: 80px;">ĐVT</th>
                            <th style="width: 80px;">Số lượng</th>
                            <th style="width: 150px;">Ghi chú</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(tx.items || []).map((item: any, idx: number) => `
                        <tr>
                            <td>${idx + 1}</td>
                            <td style="text-align:left;">
                                <div style="font-weight:bold;">${item.product?.name || ''}</div>
                                <div style="font-size:12px; font-style:italic; color:#555;">${item.product?.sku || ''}</div>
                            </td>
                            <td>${item.product?.unit || 'Cái'}</td>
                            <td>${item.quantity}</td>
                            <td style="text-align:left;">${item.note || ''}</td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="footer">
                    <div class="footer-col">
                        <div class="role">Người nhận mẫu</div>
                        <div>(Ký và ghi rõ họ tên)</div>
                    </div>
                    <div class="footer-col">
                        <div class="role">Người lập phiếu</div>
                        <div style="margin-top:70px; font-weight:bold;">.........................</div>
                    </div>
                    <div class="footer-col">
                        <div class="role">Quản lý duyệt</div>
                        <div>(Ký xác nhận)</div>
                    </div>
                </div>

                <div class="note-bottom" style="text-align: center; font-weight: bold;">
                    Quý khách vui lòng bảo quản hàng mẫu cẩn thận. Nếu mất hoặc hư hỏng sẽ bị trừ vào tiền cọc (nếu có).
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

    const stockColumns = [
        { 
            title: 'Ảnh', 
            key: 'image', 
            width: 80,
            align: 'center' as const,
            render: (_: any, r: any) => {
                const p = products.find(x => x.id === r.item_id);
                const src = getGoogleDriveImageUrl(p?.image_url);
                return src ? <img src={src} style={{width: 48, height: 48, objectFit: 'cover', borderRadius: 4, border: '1px solid #e8e8e8'}} alt="" /> : <FileImageOutlined style={{ fontSize: 24, color: '#d9d9d9' }} />;
            }
        },
        { 
            title: 'Mã (SKU)', 
            key: 'sku',
            width: 160,
            render: (_: any, r: any) => {
                const p = products.find(x => x.id === r.item_id);
                return p ? <b>{p.sku}</b> : `ID ${r.item_id}`;
            },
            sorter: (a: any, b: any) => {
                const pa = products.find(x => x.id === a.item_id);
                const pb = products.find(x => x.id === b.item_id);
                return (pa?.sku || '').localeCompare(pb?.sku || '');
            }
        },
        { 
            title: 'Tên Sản Phẩm', 
            key: 'name',
            render: (_: any, r: any) => {
                const p = products.find(x => x.id === r.item_id);
                return p ? <span style={{ fontWeight: 500, color: '#262626' }}>{p.name}</span> : '-';
            },
            sorter: (a: any, b: any) => {
                const pa = products.find(x => x.id === a.item_id);
                const pb = products.find(x => x.id === b.item_id);
                return (pa?.name || '').localeCompare(pb?.name || '');
            }
        },
        {
            title: 'Giá bán',
            key: 'price',
            width: 120,
            align: 'right' as const,
            render: (_: any, r: any) => {
                const p = products.find(x => x.id === r.item_id);
                return p?.base_price ? <span style={{ fontWeight: 'bold', color: 'green' }}>{Number(p.base_price).toLocaleString()}</span> : '-';
            }
        },
        { 
            title: 'Tồn Hàng Mẫu', 
            dataIndex: 'quantity', 
            width: 140, 
            align: 'right' as const, 
            render: (v:any)=> <span style={{ fontWeight: 'bold', color: '#1890ff', fontSize: 16 }}>{Number(v).toLocaleString()}</span>,
            sorter: (a: any, b: any) => Number(a.quantity) - Number(b.quantity)
        },
    ];

    const txColumns = [
        { title: 'Mã Phiếu', dataIndex: 'code', width: 140, render: (t:any)=> <b>{t}</b> },
        { 
            title: 'Loại', dataIndex: 'type', width: 100, 
            render: (t:any) => <Tag color={t === 'IMPORT' ? 'blue' : 'orange'}>{t === 'IMPORT' ? 'NHẬP MAIN' : 'XUẤT MẪU'}</Tag>
        },
        { 
            title: 'Trạng thái', dataIndex: 'status', width: 120,
            render: (s:any) => <Tag color={s === 'COMPLETED' ? 'green' : 'default'}>{s}</Tag>
        },
        { title: 'Nguồn/Đích', dataIndex: 'reference_type', render: (_:any, r:any) => r.reference_type ? `${r.reference_type} #${r.reference_id||''}` : 'Nội bộ' },
        { title: 'Chi tiết SP', key: 'items', render: (_:any, r:any) => (
            <ul style={{ margin:0, paddingLeft: 16 }}>
                {(r.items || []).map((i:any) => (
                    <li key={i.id}>{i.product?.name || `Product#${i.product_id}`} (SL: {i.quantity}) {i.note ? `- ${i.note}`:''}</li>
                ))}
            </ul>
        )},
        { title: 'Ngày tạo', dataIndex: 'created_at', render: (d:any) => dayjs(d).format('DD/MM/YY HH:mm') },
        {
            title: 'Hành động',
            key: 'action',
            render: (_:any, r:any) => (
                <Space>
                    {r.status === 'DRAFT' && (
                        <>
                            <Popconfirm title="Xác nhận phiếu này xuất/nhập kho?" onConfirm={() => handleConfirmTransaction(r.id)}>
                                <Button size="small" type="primary" icon={<CheckCircleOutlined />}>Duyệt</Button>
                            </Popconfirm>
                            <Tooltip title="Sửa">
                                <Button size="small" onClick={() => handleEditTransaction(r)} icon={<EditOutlined />} />
                            </Tooltip>
                            <Popconfirm title="Xóa phiếu nháp này?" onConfirm={() => handleDeleteTransaction(r.id)}>
                                <Button size="small" danger icon={<DeleteOutlined />} />
                            </Popconfirm>
                        </>
                    )}
                    {r.status === 'COMPLETED' && r.type === 'EXPORT' && (
                        <Button size="small" onClick={() => handlePrintExport(r)}>In Phiếu</Button>
                    )}
                </Space>
            )
        }
    ];

    const openModal = (type: 'IMPORT' | 'EXPORT') => {
        setModalType(type);
        setEditingTxId(null);
        setSelectedCustomerId(null);
        setSelectedItems([]);
        form.resetFields();
        setIsModalOpen(true);
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <Title level={2} style={{ margin: 0 }}>Quản lý Kho Hàng Mẫu</Title>
                <Space>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal('IMPORT')}>Tạo Phiếu Nhập Mẫu</Button>
                    <Button type="primary" danger icon={<PlusOutlined />} onClick={() => openModal('EXPORT')}>Tạo Phiếu Xuất Mẫu</Button>
                </Space>
            </div>

            <Card bodyStyle={{ padding: 0 }}>
                <Tabs 
                    activeKey={activeTab} 
                    onChange={setActiveTab}
                    items={[
                        {
                            key: 'stocks',
                            label: <span><AppstoreOutlined /> Tồn Kho Hàng Mẫu</span>,
                            children: (
                                <div style={{ padding: 24 }}>
                                    <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
                                        <Input.Search 
                                            placeholder="Tìm kiếm SKU/Tên SP..." 
                                            allowClear 
                                            style={{ width: 300 }}
                                            onChange={(e) => setSearchText(e.target.value)}
                                        />
                                    </div>
                                    <Table 
                                        loading={loading}
                                        columns={stockColumns}
                                        dataSource={stocks.filter(st => {
                                            if (!searchText) return true;
                                            const p = products.find(x => x.id === st.item_id);
                                            if (!p) return false;
                                            const lower = searchText.toLowerCase();
                                            return (p.name && p.name.toLowerCase().includes(lower)) || (p.sku && p.sku.toLowerCase().includes(lower));
                                        })}
                                        rowKey="id"
                                        pagination={{ pageSize: 20 }}
                                    />
                                </div>
                            )
                        },
                        {
                            key: 'transactions',
                            label: <span><HistoryOutlined /> Lịch sử Nhập/Xuất Mẫu</span>,
                            children: (
                                <div style={{ padding: 24 }}>
                                    <Table 
                                        loading={loading}
                                        columns={txColumns}
                                        dataSource={transactions}
                                        rowKey="id"
                                    />
                                </div>
                            )
                        }
                    ]} 
                />
            </Card>

            <Modal
                title={modalType === 'IMPORT' ? "Tạo Phiếu Nhập Hàng Mẫu" : "Tạo Phiếu Xuất Hàng Mẫu"}
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                onOk={() => form.submit()}
                width={1000}
                destroyOnClose
            >
                <Form form={form} layout="vertical" onFinish={handleCreateTransaction}>
                    {modalType === 'EXPORT' && (
                        <Row gutter={16}>
                            <Col span={8}>
                                <Form.Item name="customer_id" label="Khách hàng">
                                    <Select showSearch filterOption={(inpt, opt:any) => (opt?.children as string).toLowerCase().includes(inpt.toLowerCase())} placeholder="Chọn khách hàng" onChange={val => {
                                        setSelectedCustomerId(val);
                                        const c = customers.find(x => x.id === val);
                                        form.setFieldsValue({ 
                                            ref_order: undefined, 
                                            reference_type: undefined, 
                                            reference_id: undefined,
                                            receiver_name: c?.name || '',
                                            receiver_phone: c?.phone || '',
                                            receiver_address: c?.address || ''
                                        });
                                    }}>
                                        {customers.map(c => <Option key={c.id} value={c.id}>{c.name}</Option>)}
                                    </Select>
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item name="ref_order" label="Chọn Báo giá / SO">
                                    <Select placeholder="Chọn đơn hàng tham chiếu" allowClear
                                        onChange={(val, opt:any) => {
                                            if (val) {
                                                const order = salesOrders.find(o => o.order_code === val);
                                                if (order) {
                                                    form.setFieldsValue({
                                                        reference_type: order.status === 'QUOTATION' ? 'QUOTE' : 'SO',
                                                        reference_id: order.id
                                                    });
                                                }
                                            } else {
                                                form.setFieldsValue({ reference_type: undefined, reference_id: undefined });
                                            }
                                        }}
                                    >
                                        {salesOrders.filter(o => o.customer_id === selectedCustomerId).map(o => (
                                            <Option key={o.order_code} value={o.order_code}>
                                                {o.order_code} ({o.status === 'QUOTATION' ? 'Báo giá' : 'SO'})
                                            </Option>
                                        ))}
                                    </Select>
                                    <Form.Item name="reference_type" hidden style={{ margin: 0 }}><Input /></Form.Item>
                                    <Form.Item name="reference_id" hidden style={{ margin: 0 }}><Input /></Form.Item>
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item name="deposit_amount" label="Phí đặt cọc (VND)">
                                    <InputNumber style={{width:'100%'}} formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={(val: any) => val!.replace(/\$\s?|(,*)/g, '')} placeholder="Vd: 50,000" />
                                </Form.Item>
                            </Col>
                        </Row>
                    )}
                    
                    {modalType === 'EXPORT' && (
                        <>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="receiver_name" label="Người nhận (Tên)">
                                        <Input placeholder="Tên người nhận mẫu" />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="receiver_phone" label="SĐT Người nhận">
                                        <Input placeholder="Số điện thoại" />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Row gutter={16}>
                                <Col span={24}>
                                    <Form.Item name="receiver_address" label="Địa chỉ giao mẫu">
                                        <Input placeholder="Địa chỉ" />
                                    </Form.Item>
                                </Col>
                            </Row>
                        </>
                    )}
                    
                    <Form.Item name="note" label="Ghi chú chung">
                        <Input.TextArea rows={2} placeholder="Vd: Chuyển hàng mẫu từ kho chính sang kho mẫu..." />
                    </Form.Item>

                    <Card size="small" title="Danh sách sản phẩm" style={{ marginTop: 10 }}>
                        <div style={{ display: 'flex', gap: 10, marginBottom: 15, alignItems: 'flex-start' }}>
                            <div style={{ width: '45%' }}>
                                <Select 
                                    showSearch 
                                    style={{ width: '100%' }}
                                    value={form.getFieldValue('prodId')}
                                    onChange={(val) => form.setFieldsValue({ prodId: val })}
                                    filterOption={(inpt, opt:any) => (opt?.label as string)?.toLowerCase().includes(inpt.toLowerCase())} 
                                    placeholder="Tìm kiếm và chọn sản phẩm..."
                                    options={(modalType === 'EXPORT' 
                                        ? products.filter(p => {
                                            const st = stocks.find(s => s.item_id === p.id);
                                            return st && Number(st.quantity) > 0;
                                        }) 
                                        : products
                                    ).map((p: any) => ({ 
                                        value: p.id, 
                                        label: `${p.sku} - ${p.name}` + (modalType === 'EXPORT' ? ` (Tồn: ${stocks.find(s => s.item_id === p.id)?.quantity || 0})` : '')
                                    }))}
                                />
                            </div>
                            <div style={{ width: '15%' }}>
                                <InputNumber 
                                    min={1} 
                                    placeholder="Số lượng" 
                                    style={{ width: '100%' }} 
                                    value={form.getFieldValue('qty') || 1}
                                    onChange={(val) => form.setFieldsValue({ qty: val })}
                                />
                            </div>
                            <Button 
                                type="primary" 
                                icon={<PlusOutlined />} 
                                onClick={() => {
                                    const prodId = form.getFieldValue('prodId');
                                    const qty = form.getFieldValue('qty') || 1;
                                    if (!prodId) {
                                        message.warning('Vui lòng chọn sản phẩm');
                                        return;
                                    }
                                    
                                    if (modalType === 'EXPORT') {
                                        const stockItem = stocks.find(s => s.item_id === prodId);
                                        const available = Number(stockItem?.quantity || 0);
                                        if (qty > available) {
                                            message.warning(`Sản phẩm này chỉ còn tồn ${available} trong kho mẫu`);
                                            return;
                                        }
                                    }

                                    const exists = selectedItems.find(i => i.product_id === prodId);
                                    if (exists) {
                                        message.warning('Sản phẩm đã có trong danh sách!');
                                    } else {
                                        setSelectedItems([...selectedItems, { product_id: prodId, quantity: qty, note: '' }]);
                                    }
                                    form.setFieldsValue({ prodId: undefined, qty: 1 });
                                }}
                            >
                                Thêm vào danh sách
                            </Button>
                        </div>

                        <Table 
                            size="small" 
                            bordered
                            dataSource={selectedItems} 
                            rowKey={(r, idx) => idx as number}
                            pagination={false}
                            columns={[
                                { 
                                    title: 'Sản phẩm', 
                                    render: (_, r) => {
                                        const p = products.find(prod => prod.id === r.product_id);
                                        const src = getGoogleDriveImageUrl(p?.image_url);
                                        return (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                {src ? <img src={src} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }} alt="" /> : <div style={{ width: 40, height: 40, background: '#f0f0f0', borderRadius: 4 }} />}
                                                <div>
                                                    <div style={{ fontWeight: 'bold' }}>{p?.name}</div>
                                                    <div style={{ fontSize: 12, color: '#888' }}>{p?.sku}</div>
                                                </div>
                                            </div>
                                        );
                                    } 
                                },
                                { 
                                    title: 'Số lượng', 
                                    dataIndex: 'quantity',
                                    width: 120,
                                    render: (val, record, idx) => (
                                        <InputNumber 
                                            min={1} 
                                            value={val} 
                                            onChange={(newVal) => {
                                                const newItems = [...selectedItems];
                                                newItems[idx].quantity = newVal || 1;
                                                setSelectedItems(newItems);
                                            }}
                                            style={{ width: '100%' }}
                                        />
                                    )
                                },
                                {
                                    title: 'Ghi chú',
                                    dataIndex: 'note',
                                    width: 250,
                                    render: (val, record, idx) => (
                                        <Input 
                                            placeholder="Ghi chú (màu sắc, kích thước...)" 
                                            value={val}
                                            onChange={(e) => {
                                                const newItems = [...selectedItems];
                                                newItems[idx].note = e.target.value;
                                                setSelectedItems(newItems);
                                            }}
                                        />
                                    )
                                },
                                { 
                                    title: '', 
                                    width: 50, 
                                    align: 'center',
                                    render: (_, r, idx) => (
                                        <Button danger size="small" type="text" icon={<DeleteOutlined />} onClick={()=> {
                                            const n = [...selectedItems]; n.splice(idx, 1); setSelectedItems(n);
                                        }}/> 
                                    )
                                }
                            ]}
                        />
                    </Card>
                </Form>
            </Modal>
        </div>
    );
};

export default SampleInventoryPage;
