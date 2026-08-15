import React, { useState, useEffect, useMemo } from 'react';
import { Layout, Row, Col, Card, Input, Button, List, Avatar, Badge, message, Select, Typography, Statistic, Divider, Empty, Tag, Drawer, Modal } from 'antd';
import { SearchOutlined, ShoppingCartOutlined, UserOutlined, DeleteOutlined, PlusOutlined, MinusOutlined, CheckCircleOutlined, WalletOutlined, HomeOutlined, BarcodeOutlined } from '@ant-design/icons';
import api from '../utils/api';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import useMobile from '../hooks/useMobile'; // <--- Import Hook
import { FloatButton } from 'antd'; // <--- Import FloatButton
import { InputNumber } from 'antd'; // <--- Import InputNumber

const { Header, Content } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;

interface Product {
    id: number;
    sku: string;
    name: string;
    base_price: number;
    quantity_in_stock: number;
    image_url?: string;
    category?: string;
    unit?: string;
}

interface CartItem extends Product {
    qty: number;
}

const PosPage: React.FC = () => {
    const navigate = useNavigate();
    const [products, setProducts] = useState<Product[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
    const isMobile = useMobile(); // <--- Detect Mobile
    const [mobileCartVisible, setMobileCartVisible] = useState(false); // <--- Drawer State

    const [vatRate, setVatRate] = useState<number>(0);
    const [printModalVisible, setPrintModalVisible] = useState<boolean>(false);
    const [printedOrder, setPrintedOrder] = useState<any>(null);
    const [shippingFee, setShippingFee] = useState<number>(0);

    // Initial Data Fetch
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [resProd, resCust] = await Promise.all([
                    api.get('/products'),
                    api.get('/customers')
                ]);
                setProducts(resProd.data || []);
                setCustomers(resCust.data || []);
            } catch (error) {
                message.error('Lỗi tải dữ liệu');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Helper: Add to Cart
    const addToCart = (product: Product) => {
        if (product.quantity_in_stock < 0) {
            message.warning('Sản phẩm này đã hết hàng kho (Tồn < 0)');
            return;
        }

        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
            }
            return [...prev, { ...product, qty: 1 }];
        });
        message.success({ content: `Đã thêm ${product.name}`, key: 'cart_msg', duration: 1 });
    };

    // Helper: Update Qty
    const updateQty = (id: number, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.id === id) {
                const newQty = Math.max(1, item.qty + delta);
                return { ...item, qty: newQty };
            }
            return item;
        }));
    };

    // Helper: Remove Item
    const removeFromCart = (id: number) => {
        setCart(prev => prev.filter(item => item.id !== id));
    };

    // Helper: Checkout
    const handleCheckout = async () => {
        if (cart.length === 0) return message.warning('Giỏ hàng trống');

        try {
            const payload = {
                customer_id: selectedCustomer ? selectedCustomer.id : null,
                customer_name: selectedCustomer ? selectedCustomer.name : 'Khách lẻ',
                items: cart.map(item => ({
                    sku: item.sku,
                    product_id: item.id,
                    product_sku: item.sku,
                    product_name: item.name,
                    quantity: item.qty,
                    unit_price: item.base_price,
                    total_price: item.qty * item.base_price
                })),
                total_amount: totalAmount,
                vat_rate: vatRate,
                shipping_fee: shippingFee,
                status: 'COMPLETED', // Auto complete for retail
                billing_address: 'Tại quầy',
                notes: 'Đơn bán lẻ POS' // Identify source
            };

            const res = await api.post('/sales', payload);
            message.success('Thanh toán thành công!');
            setCart([]);
            setSelectedCustomer(null);
            setVatRate(0);
            setShippingFee(0);

            if (res.data) {
                setPrintedOrder(res.data);
                setPrintModalVisible(true);
            }
        } catch (error) {
            message.error('Lỗi thanh toán');
        }
    };

    // Helper: Mobile Search Add
    const handleMobileSearch = (val: any) => {
        const p = products.find(x => x.id === val);
        if (p) {
            addToCart(p);
            // We use a key to force re-render of Select to plain state if needed, or just let it stay selected? 
            // Better to clear it so user can search again. 
            // Since we use the same state 'searchText' or a separate one?
            // Let's use a ref or just ignore value controlled.
        }
    };

    // Filtering
    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const matchSearch = p.name.toLowerCase().includes(searchText.toLowerCase()) || p.sku.toLowerCase().includes(searchText.toLowerCase());
            const matchCat = selectedCategory === 'ALL' || p.category === selectedCategory; // Assuming category field exists or logic needs adjustment
            return matchSearch && matchCat;
        });
    }, [products, searchText, selectedCategory]);

    const categories = useMemo(() => [...new Set(products.map(p => p.category || 'Khác'))], [products]);
    const subtotalAmount = cart.reduce((acc, item) => acc + (item.qty * item.base_price), 0);
    const vatAmount = subtotalAmount * vatRate / 100;
    const totalAmount = subtotalAmount + vatAmount + shippingFee;
    const totalQty = cart.reduce((acc, item) => acc + item.qty, 0);

    // --- RENDER HELPERS ---
    const renderProductGrid = () => (
        <Content style={{ padding: '16px', overflowY: 'auto', background: '#f0f2f5', height: '100%', scrollbarWidth: 'thin' }}>
            <div style={{ marginBottom: 16, display: 'flex', gap: 10 }}>
                <Input
                    prefix={<SearchOutlined style={{ color: '#ccc' }} />}
                    placeholder="Tìm sản phẩm (Tên, SKU, Barcode)..."
                    size="large"
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                    style={{ flex: 1, borderRadius: 8 }}
                />
                <Select
                    value={selectedCategory}
                    onChange={setSelectedCategory}
                    size="large"
                    style={{ width: isMobile ? 110 : 150 }} // Slightly smaller on mobile
                    dropdownMatchSelectWidth={false}
                >
                    <Option value="ALL">Tất cả</Option>
                    {categories.map(c => <Option key={c} value={c}>{c}</Option>)}
                </Select>
            </div>

            <Row gutter={[16, 16]}>
                {filteredProducts.map(product => {
                    const isOutOfStock = product.quantity_in_stock < 0;
                    return (
                        <Col xs={12} sm={12} md={8} lg={6} xl={4} key={product.id}>
                            {/* xs={12} allows 2 items per row on mobile */}
                            <Card
                                hoverable={!isOutOfStock}
                                style={{
                                    borderRadius: 8,
                                    overflow: 'hidden',
                                    opacity: isOutOfStock ? 0.6 : 1,
                                    cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                                    height: '100%',
                                    display: 'flex', flexDirection: 'column'
                                }}
                                bodyStyle={{ padding: 8, flex: 1, display: 'flex', flexDirection: 'column' }} // Reduce padding on mobile
                                onClick={() => !isOutOfStock && addToCart(product)}
                                cover={
                                    <div style={{ height: isMobile ? 120 : 140, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #f0f0f0' }}>
                                        {product.image_url ? (
                                            <img alt={product.name} src={product.image_url} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                                        ) : (
                                            <div style={{ fontSize: 32, color: '#eee' }}><BarcodeOutlined /></div>
                                        )}
                                    </div>
                                }
                            >
                                <div style={{ flex: 1 }}>
                                    <Text strong style={{ fontSize: 13, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 40 }}>
                                        {product.name}
                                    </Text>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 8 }}>
                                        <div>
                                            <Text strong style={{ color: '#1890ff', fontSize: 15 }}>{Number(product.base_price).toLocaleString('vi-VN')}đ</Text>
                                        </div>
                                    </div>
                                    {!isMobile && <Tag color={isOutOfStock ? 'red' : 'green'} style={{ marginTop: 5 }}>{isOutOfStock ? 'Hết' : 'Kho: ' + product.quantity_in_stock}</Tag>}
                                </div>
                                {!isMobile && !isOutOfStock && <Button type="primary" block size="small" style={{ marginTop: 8 }} icon={<PlusOutlined />}>Thêm</Button>}
                            </Card>
                        </Col>
                    )
                })}
                {filteredProducts.length === 0 && <Empty description="Không tìm thấy sản phẩm" style={{ width: '100%', marginTop: 50 }} />}
            </Row>
        </Content>
    );

    const renderCartContent = () => (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>
            {/* CART HEADER (Hidden on mobile fast checkout to save space or keep? Let's hide if mobile) */}
            {!isMobile && (
                <div style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Title level={4} style={{ margin: 0 }}><ShoppingCartOutlined /> Giỏ Hàng <Badge count={totalQty} style={{ backgroundColor: '#52c41a' }} /></Title>
                    <Button type="text" icon={<DeleteOutlined />} danger onClick={() => setCart([])}>Xóa</Button>
                </div>
            )}
            {/* Mobile simplified header for Cart section */}
            {isMobile && (
                <div style={{ padding: '8px 12px', background: '#f5f5f5', color: '#666', fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700 }}>GIỎ HÀNG ({cart.length}) items</span>
                    {cart.length > 0 && <span style={{ color: 'red', cursor: 'pointer' }} onClick={() => setCart([])}>Xóa hết</span>}
                </div>
            )}

            <div style={{ padding: isMobile ? '8px 12px' : '12px 24px', background: isMobile ? '#fff' : '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                <Select
                    showSearch
                    placeholder={isMobile ? "Khách hàng" : "Khách lẻ (Mặc định)"}
                    style={{ width: '100%' }}
                    allowClear
                    optionFilterProp="children"
                    onChange={(val) => {
                        const cust = customers.find(c => c.id === val);
                        setSelectedCustomer(cust);
                    }}
                    filterOption={(input, option: any) =>
                        (option?.children as unknown as string).toLowerCase().includes(input.toLowerCase())
                    }
                >
                    {customers.map(c => <Option key={c.id} value={c.id}>{c.name} - {c.phone}</Option>)}
                </Select>
                {selectedCustomer && <div style={{ marginTop: 5, fontSize: 12, color: '#1890ff' }}><UserOutlined /> {selectedCustomer.phone}</div>}
            </div>

            {/* CART ITEMS */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px' }}>
                <List
                    itemLayout="horizontal"
                    dataSource={cart}
                    renderItem={item => (
                        <List.Item actions={[
                            <Button size="small" shape="circle" icon={<MinusOutlined />} onClick={() => item.qty > 1 ? updateQty(item.id, -1) : removeFromCart(item.id)} />,
                            <span style={{ fontWeight: 600, width: 20, textAlign: 'center' }}>{item.qty}</span>,
                            <Button size="small" shape="circle" icon={<PlusOutlined />} onClick={() => updateQty(item.id, 1)} />
                        ]}>
                            <List.Item.Meta
                                title={<span style={{ fontSize: 13 }}>{item.name}</span>}
                                description={
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: 12, color: '#999' }}>{Number(item.base_price).toLocaleString('vi-VN')} x {item.qty}</span>
                                        <span style={{ fontWeight: 600, color: '#333' }}>{Number(item.base_price * item.qty).toLocaleString('vi-VN')}đ</span>
                                    </div>
                                }
                            />
                        </List.Item>
                    )}
                />
                {cart.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có sản phẩm" style={{ marginTop: 30 }} />}
            </div>

            {/* FOOTER TOTALS */}
            <div style={{ padding: 24, background: '#fafafa', borderTop: '1px solid #e8e8e8' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text>Tạm tính:</Text>
                    <Text strong>{Number(subtotalAmount).toLocaleString('vi-VN')}đ</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
                    <Text>VAT (%):</Text>
                    <Select value={vatRate} onChange={(val) => setVatRate(val)} style={{ width: 80, marginLeft: 10 }} size="small">
                        <Option value={0}>0%</Option>
                        <Option value={8}>8%</Option>
                        <Option value={10}>10%</Option>
                    </Select>
                </div>
                {vatRate > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                        <Text>Tiền VAT:</Text>
                        <Text strong>{Number(vatAmount).toLocaleString('vi-VN')}đ</Text>
                    </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
                    <Text>Phí vận chuyển:</Text>
                    <InputNumber
                        value={shippingFee}
                        min={0}
                        onChange={(val) => setShippingFee(val === null ? 0 : Number(val))}
                        formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        parser={(value) => value!.replace(/\$\s?|(,*)/g, '') as any}
                        style={{ width: 120, marginLeft: 10 }}
                        size="small"
                        addonAfter="đ"
                    />
                </div>
                <Divider style={{ margin: '12px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
                    <Title level={4} style={{ margin: 0 }}>Tổng:</Title>
                    <Title level={3} type="danger" style={{ margin: 0 }}>{Number(totalAmount).toLocaleString('vi-VN')}đ</Title>
                </div>

                <Row gutter={10}>
                    <Col span={12}>
                        <Button block type="dashed" size="large" onClick={() => navigate('/orders')}>Thoát</Button>
                    </Col>
                    <Col span={12}>
                        <Button block type="primary" size="large" icon={<WalletOutlined />} onClick={handleCheckout} disabled={cart.length === 0}>
                            Thanh Toán
                        </Button>
                    </Col>
                </Row>
            </div>
        </div>
    );

    // --- MOBILE FAST CHECKOUT LAYOUT ---
    if (isMobile) {
        const topProducts = products.slice(0, 10); // Simulating Top 10

        return (
            <div style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', background: '#fff', overflow: 'hidden' }}>
                {/* 1. SEARCH & QUICK ADD */}
                <div style={{ padding: '12px 12px 0 12px' }}>
                    <Select
                        showSearch
                        placeholder="Tìm & Thêm nhanh (Tên/SKU)..."
                        style={{ width: '100%' }}
                        size="large"
                        filterOption={(input, option: any) =>
                            (option?.children as unknown as string).toLowerCase().includes(input.toLowerCase())
                        }
                        onChange={(val) => handleMobileSearch(val)}
                        value={null} // Keep clean
                        dropdownMatchSelectWidth={false}
                    >
                        {products.map(p => (
                            <Option key={p.id} value={p.id} disabled={p.quantity_in_stock < 0}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>{p.name}</span>
                                    {p.quantity_in_stock < 0 && <span style={{ color: 'red' }}>Hết</span>}
                                </div>
                            </Option>
                        ))}
                    </Select>
                </div>

                {/* 2. HORIZONTAL TOP 10 */}
                <div style={{ padding: 12 }}>
                    <div style={{ fontSize: 11, color: '#999', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Phổ biến (Top 10)</div>
                    <div style={{ display: 'flex', overflowX: 'auto', gap: 10, paddingBottom: 4 }}>
                        {topProducts.map(p => {
                            const isOOS = p.quantity_in_stock < 0;
                            return (
                                <div
                                    key={p.id}
                                    onClick={() => !isOOS && addToCart(p)}
                                    style={{
                                        minWidth: 90, maxWidth: 90,
                                        background: '#fafafa',
                                        borderRadius: 8,
                                        border: '1px solid #eee',
                                        padding: 6,
                                        opacity: isOOS ? 0.6 : 1,
                                        position: 'relative',
                                        flexShrink: 0
                                    }}
                                >
                                    <div style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4, background: '#fff', borderRadius: 4 }}>
                                        {p.image_url ? (
                                            <img src={p.image_url} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                                        ) : <BarcodeOutlined style={{ fontSize: 18, color: '#ddd' }} />}
                                    </div>
                                    <div style={{ fontSize: 10, fontWeight: 500, lineHeight: 1.1, height: 22, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', color: '#333' }}>
                                        {p.name}
                                    </div>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: '#1890ff', marginTop: 2 }}>{Number(p.base_price).toLocaleString('vi-VN')}</div>
                                    {isOOS && <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 'bold', color: 'red' }}>HẾT</div>}
                                </div>
                            )
                        })}
                    </div>
                    <Divider style={{ margin: '12px 0 0 0' }} />
                </div>

                {/* 3. CART CONTENT (Reuse Logic) */}
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {/* Customer Select (Copied from renderCartContent to place here) or we can reuse `renderCartContent`? 
                       Let's reuse renderCartContent but we need to hide the Header. 
                       renderCartContent has a wrapper div with background #fff. 
                       We can just use it. 
                    */}
                    {renderCartContent()}
                </div>
            </div>
        );
    }


    // THIẾT KẾ MODAL IN HÓA ĐƠN
    const renderPrintModal = () => {
        if (!printedOrder) return null;

        const orderItems = printedOrder.items || [];
        const qrcodeUrl = `https://img.vietqr.io/image/ACB-141847859-compact2.jpg?amount=${printedOrder.total_amount}&addInfo=${printedOrder.order_code}&accountName=CTY TNHH TM DV TUONG LINH`;

        const subtotal = (printedOrder.total_amount || 0) / (1 + (printedOrder.vat_rate || 0) / 100);
        const vatVal = (printedOrder.total_amount || 0) - subtotal;

        return (
            <Modal
                title="In Hóa Đơn Bán Lẻ"
                open={printModalVisible}
                onCancel={() => setPrintModalVisible(false)}
                footer={[
                    <Button key="close" onClick={() => setPrintModalVisible(false)}>Đóng</Button>,
                    <Button key="print" type="primary" onClick={() => window.print()}>
                        🖨️ In Hóa Đơn
                    </Button>
                ]}
                width={400}
                centered
            >
                <style>{`
                    @media print {
                        body * { visibility: hidden; }
                        #pos-receipt, #pos-receipt * { visibility: visible; }
                        #pos-receipt { position: absolute; left: 0; top: 0; width: 300px; margin: 0; padding: 0; }
                        .ant-modal-wrap { background: transparent !important; }
                        .ant-modal-content { box-shadow: none !important; margin: 0; padding: 0; }
                        .ant-modal-close, .ant-modal-header, .ant-modal-footer { display: none !important; }
                        .ant-modal-mask { display: none !important; }
                        html, body { background: #fff; height: auto; }
                    }
                `}</style>
                <div id="pos-receipt" style={{ width: 300, margin: '0 auto', fontFamily: 'monospace', color: '#000', fontSize: 13, padding: 10, background: '#fff' }}>
                    <div style={{ textAlign: 'center', marginBottom: 10 }}>
                        <h2 style={{ margin: 0, fontSize: 18 }}>ERP4U</h2>
                        <div>Hóa Đơn Bán Lẻ POS</div>
                        <div>================================</div>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                        <div><strong>Mã đơn:</strong> {printedOrder.order_code}</div>
                        <div><strong>Ngày:</strong> {dayjs(printedOrder.created_at || new Date()).format('DD/MM/YYYY HH:mm')}</div>
                    </div>
                    <div>================================</div>
                    <table style={{ width: '100%', marginBottom: 10, borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px dashed #000' }}>
                                <th style={{ textAlign: 'left', paddingBottom: 5 }}>SP</th>
                                <th style={{ textAlign: 'center', paddingBottom: 5 }}>SL</th>
                                <th style={{ textAlign: 'right', paddingBottom: 5 }}>Thành tiền</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orderItems.map((item: any, idx: number) => {
                                const productName = products.find(p => p.sku === item.sku)?.name || item.sku;
                                return (
                                    <tr key={idx}>
                                        <td style={{ padding: '5px 0', verticalAlign: 'top' }}>
                                            <div style={{ maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{productName}</div>
                                            <span style={{ fontSize: 11 }}>{Number(item.unit_price).toLocaleString('vi-VN')}</span>
                                        </td>
                                        <td style={{ textAlign: 'center', verticalAlign: 'top', paddingTop: 5 }}>{item.quantity}</td>
                                        <td style={{ textAlign: 'right', verticalAlign: 'top', paddingTop: 5 }}>{Number(item.subtotal || (item.quantity * item.unit_price)).toLocaleString('vi-VN')}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <div>================================</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span>Cộng tiền hàng:</span>
                        <span>{Number(subtotal).toLocaleString('vi-VN')}đ</span>
                    </div>
                    {printedOrder.vat_rate > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                            <span>VAT ({printedOrder.vat_rate}%):</span>
                            <span>{Number(vatVal).toLocaleString('vi-VN')}đ</span>
                        </div>
                    )}
                    {printedOrder.shipping_fee > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                            <span>Phí vận chuyển:</span>
                            <span>{Number(printedOrder.shipping_fee).toLocaleString('vi-VN')}đ</span>
                        </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: 15, marginTop: 5 }}>
                        <span>TỔNG CỘNG:</span>
                        <span>{Number(printedOrder.total_amount).toLocaleString('vi-VN')}đ</span>
                    </div>
                    <div style={{ textAlign: 'center', marginTop: 20 }}>
                        <div style={{ marginBottom: 5, fontSize: 12 }}>Quét mã để thanh toán / Chuyển khoản</div>
                        <img src={qrcodeUrl} alt="VietQR" style={{ width: 180, height: 180 }} />
                    </div>
                    <div style={{ textAlign: 'center', marginTop: 15, fontSize: 12, borderTop: '1px dashed #000', paddingTop: 10 }}>
                        Trân trọng cảm ơn quý khách!
                    </div>
                </div>
            </Modal>
        );
    };

    // DESKTOP LAYOUT (Preserved Logic)
    return (
        <Layout style={{ height: 'calc(100vh - 64px)', overflow: 'hidden', flexDirection: 'row' }}>
            {/* LEFT SIDE: PRODUCTS GRID */}
            {renderProductGrid()}

            {/* RIGHT SIDE: CART */}
            <div style={{ width: 420, minWidth: 420, background: '#fff', borderLeft: '1px solid #e8e8e8', height: '100%' }}>
                {renderCartContent()}
            </div>

            {/* PRINT OVERLAY MODAL */}
            {renderPrintModal()}
        </Layout>
    );
};

export default PosPage;
