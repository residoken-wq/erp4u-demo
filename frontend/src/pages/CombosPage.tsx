import React, { useEffect, useState, useMemo } from 'react';
import { Table, Button, message, Card, Modal, Form, Input, InputNumber, Select, Row, Col, Space, Divider, Tooltip, Statistic, Popconfirm, Tag } from 'antd';
import { PlusOutlined, DeleteOutlined, GiftOutlined, DollarOutlined, EditOutlined, WarningOutlined, SearchOutlined, CalculatorOutlined, RiseOutlined, FallOutlined, MenuOutlined } from '@ant-design/icons';
import { DndContext, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import api from '../utils/api';
import DraggableRow from '../components/common/DraggableRow';

const ExpandedComboRow = ({ comboSku, productMap }: { comboSku: string, productMap: any }) => {
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState<any[]>([]);

    useEffect(() => {
        const fetchItems = async () => {
            setLoading(true);
            try {
                const res = await api.get(`/products/combo/${encodeURIComponent(comboSku)}`);
                const data = (res.data || []).map((comp: any) => ({
                    sku: comp.child_product?.sku,
                    quantity: comp.quantity,
                    id: comp.id,
                    name: comp.child_product?.name,
                    unit: comp.child_product?.unit,
                })).filter((item: any) => item.sku);
                setItems(data);
            } catch (e) {
                console.error(e);
            }
            setLoading(false);
        };
        fetchItems();
    }, [comboSku]);

    const columns = [
        { title: 'Mã SP', dataIndex: 'sku', key: 'sku', width: 150 },
        { title: 'Tên Sản Phẩm (Sản phẩm con)', dataIndex: 'name', key: 'name', render: (t: any, r: any) => productMap[r.sku]?.name || t || 'N/A' },
        { title: 'Số lượng', dataIndex: 'quantity', key: 'quantity', width: 120 },
        { title: 'ĐVT', dataIndex: 'unit', key: 'unit', width: 100, render: (t: any, r: any) => productMap[r.sku]?.unit || t },
        { title: 'Tồn kho thật', dataIndex: 'stock', key: 'stock', width: 120, align: 'right' as const, render: (t: any, r: any) => <span style={{ color: '#595959', fontWeight: 'bold' }}>{Number(productMap[r.sku]?.quantity_in_stock || 0).toLocaleString()}</span> },
    ];

    return (
        <Table 
            dataSource={items} 
            columns={columns} 
            pagination={false} 
            size="small" 
            loading={loading} 
            rowKey="id" 
            bordered={false}
            style={{ margin: '10px 24px', border: '1px dashed #d9d9d9', borderRadius: '4px', padding: '10px', backgroundColor: '#fafafa' }}
        />
    );
};

const CombosPage: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [combos, setCombos] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [searchText, setSearchText] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [form] = Form.useForm();

    // DnD Sensors (must be at component level)
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 1 } })
    );

    // Permission State
    const [canViewCost, setCanViewCost] = useState(false);

    useEffect(() => {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            const user = JSON.parse(userStr);
            const perms = user.permissions || [];
            const prodPerm = perms.find((p: any) => p.module_code === 'PRODUCT');
            if (user.username === 'admin') {
                setCanViewCost(true);
            } else if (prodPerm && (prodPerm.view_cost_price === true || prodPerm.view_cost_price === 1)) {
                setCanViewCost(true);
            }
        }
    }, []);

    // --- STATE METRICS (Chỉ số tài chính) ---
    const [metrics, setMetrics] = useState({
        totalRefCost: 0,    // Tổng giá vốn (từ SP con)
        totalRefSell: 0,    // Tổng giá bán lẻ (từ SP con)
        diff: 0,            // Chênh lệch (Official - RefSell)
        profit: 0           // Lợi nhuận (Official - RefCost)
    });

    // Map dữ liệu để tra cứu nhanh: Giá bán & Giá vốn
    const productMap = useMemo(() => {
        return products.reduce((acc, p) => {
            const sku = p.value;
            acc[sku] = {
                price: Number(p.price) || 0,        // Giá bán lẻ
                cost: Number(p.cost_price) || 0,    // Giá vốn
                quantity_in_stock: Number(p.quantity_in_stock) || 0, // Tồn kho
                name: p.label.split(' - ')[1],
                unit: p.unit,
                customer_description: p.customer_description // NEW
            };
            return acc;
        }, {});
    }, [products]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const resProd = await api.get(`/products`);
            if (Array.isArray(resProd.data)) {
                setProducts(resProd.data.map((p: any) => ({
                    label: `${p.sku} - ${p.name}`,
                    value: p.sku,
                    price: Number(p.base_price) || 0,
                    cost_price: Number(p.cost_price) || 0, // Lấy thêm giá vốn
                    quantity_in_stock: Number(p.quantity_in_stock) || 0, // Tồn kho
                    unit: p.unit,
                    customer_description: p.customer_description // NEW
                })));

                const comboList = resProd.data.filter((p: any) => p.product_type === 'COMBO');
                setCombos(comboList);
            }
        } catch (e) { message.error('Lỗi tải dữ liệu'); }
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    const filteredCombos = useMemo(() => {
        if (!searchText) return combos;
        const lower = searchText.toLowerCase();
        return combos.filter(c =>
            (c.sku && c.sku.toLowerCase().includes(lower)) ||
            (c.name && c.name.toLowerCase().includes(lower))
        );
    }, [combos, searchText]);

    const fetchComboDetail = async (comboSku: string) => {
        try {
            const res = await api.get(`/products/combo/${encodeURIComponent(comboSku)}`);
            return (res.data || []).map((comp: any) => ({
                sku: comp.child_product?.sku,
                quantity: comp.quantity,
                id: comp.id
            })).filter((item: any) => item.sku);
        } catch (e) { return []; }
    };

    // --- HÀM TÍNH TOÁN CÁC CHỈ SỐ ---
    const calculateMetrics = (allValues: any) => {
        const items = allValues.items || [];
        // FIX: Lấy đúng field base_price (đồng bộ với ProductsPage)
        const officialPrice = Number(allValues.base_price) || 0;

        let refSell = 0;
        let refCost = 0;

        items.forEach((item: any) => {
            if (item && item.sku && item.quantity) {
                const info = productMap[item.sku];
                if (info) {
                    refSell += Number(item.quantity) * info.price;
                    refCost += Number(item.quantity) * info.cost;
                }
            }
        });

        setMetrics({
            totalRefSell: refSell,
            totalRefCost: refCost,
            diff: officialPrice - refSell,
            profit: officialPrice - refCost
        });
    };

    const openEdit = async (record: any) => {
        setEditingItem(record);
        form.resetFields();
        setIsModalOpen(true);

        const comboItems = await fetchComboDetail(record.sku);

        // Set value vào form
        const initialValues = {
            sku: record.sku,
            name: record.name,
            base_price: record.base_price, // FIX: Dùng tên field chuẩn 'base_price'
            items: comboItems
        };

        // Đợi form render rồi set value để kích hoạt tính toán
        setTimeout(() => {
            form.setFieldsValue(initialValues);
            calculateMetrics(initialValues);
        }, 100);
    };

    // --- HÀM LƯU (ĐÃ SỬA LỖI) ---
    const handleSave = async (values: any) => {
        try {
            const { sku, name, items, base_price } = values;

            let comboProduct = editingItem;

            // FIX: Payload gửi đầy đủ thông tin giống ProductsPage
            const payload = {
                sku,
                name,
                base_price: Number(base_price), // Giá bán chính thức
                cost_price: Number(metrics.totalRefCost), // Giá vốn (tự động tính)
                product_type: 'COMBO',
                is_active: true
            };

            if (!comboProduct) {
                const res = await api.post(`/products`, payload);
                comboProduct = res.data;
            } else {
                await api.put(`/products/${comboProduct.id}`, payload);
            }

            // Lưu thành phần combo
            if (comboProduct?.id) {
                const components = items.map((item: any) => ({ sku: item.sku, quantity: item.quantity }));
                await api.post(`/products/${comboProduct.id}/components`, components);
            }

            message.success('Đã lưu Combo và Cập nhật giá thành công!');
            setIsModalOpen(false); setEditingItem(null); fetchData();
        } catch (e: any) {
            message.error(e.response?.data?.message || 'Lỗi lưu Combo');
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await api.delete(`/products/${id}`);
            message.success('Đã xóa Combo'); fetchData();
        } catch (e: any) { Modal.warning({ title: 'Không thể xóa', content: 'Combo này có thể đang được sử dụng.' }); }
    };

    const columns = [
        { title: 'Mã Combo', dataIndex: 'sku', render: (t: any) => <b>{t}</b> },
        { title: 'Tên Combo', dataIndex: 'name' },
        { title: 'Giá vốn', dataIndex: 'cost_price', align: 'right' as const, render: (v: any) => <span style={{ color: 'red' }}>{Number(v).toLocaleString()} ₫</span>, hidden: !canViewCost },
        { title: 'Giá bán', dataIndex: 'base_price', align: 'right' as const, render: (v: any) => <Tag color="green" style={{ fontSize: 14 }}>{Number(v).toLocaleString()} ₫</Tag> },
        { title: 'Tồn kho thật', dataIndex: 'quantity_in_stock', align: 'right' as const, render: (v: any) => <span style={{ color: '#595959', fontWeight: 'bold' }}>{Number(v || 0).toLocaleString()}</span> },
        {
            title: '', key: 'act', width: 100, align: 'center' as const,
            render: (r: any) => (
                <Space>
                    <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(r)} />
                    <Popconfirm title="Xóa?" onConfirm={() => handleDelete(r.id)}><Button icon={<DeleteOutlined />} danger size="small" /></Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <Card title="Quản lý Combo Quà Tặng" extra={<Space><Input prefix={<SearchOutlined />} placeholder="Tìm combo..." value={searchText} onChange={e => setSearchText(e.target.value)} style={{ width: 200 }} /><Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingItem(null); form.resetFields(); setMetrics({ totalRefCost: 0, totalRefSell: 0, diff: 0, profit: 0 }); setIsModalOpen(true); }}>Tạo Combo</Button></Space>}>
            <Table 
                dataSource={filteredCombos} 
                columns={columns} 
                rowKey="id" 
                loading={loading}
                expandable={{
                    expandedRowRender: (record) => <ExpandedComboRow comboSku={record.sku} productMap={productMap} />,
                    rowExpandable: (record) => true,
                }}
            />

            <Modal
                title={<span><GiftOutlined /> {editingItem ? `Chỉnh sửa: ${editingItem.sku}` : "Thiết lập Combo Mới"}</span>}
                open={isModalOpen}
                onCancel={() => { setIsModalOpen(false); }}
                onOk={() => form.submit()}
                width={1100}
                style={{ top: 20 }}
                okText="Lưu Combo"
            >
                <Form form={form} layout="vertical" onFinish={handleSave} onValuesChange={(_, all) => calculateMetrics(all)}>
                    {/* --- THÔNG TIN CHUNG --- */}
                    <Row gutter={16}>
                        <Col span={8}><Form.Item name="sku" label="Mã Combo" rules={[{ required: true }]}><Input disabled={!!editingItem} /></Form.Item></Col>
                        <Col span={8}><Form.Item name="name" label="Tên Combo" rules={[{ required: true }]}><Input /></Form.Item></Col>
                        <Col span={8}>
                            {/* FIX: Đổi tên field thành base_price để khớp với ProductsPage */}
                            <Form.Item
                                name="base_price"
                                label="Giá Bán Chính Thức"
                                rules={[{ required: true, message: 'Nhập giá bán' }]}
                            >
                                <InputNumber
                                    style={{ width: '100%', fontWeight: 'bold', color: '#13c2c2' }}
                                    formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                    parser={(value) => value!.replace(/\$\s?|(,*)/g, '')} // <--- QUAN TRỌNG: Xử lý parse số
                                    addonAfter="₫"
                                    placeholder="Nhập giá bán..."
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Divider orientation="left" style={{ marginTop: 0 }}>Thành phần Combo</Divider>

                    <Form.List name="items">
                        {(fields, { add, remove, move }) => {
                            // --- DRAG END HANDLER ---
                            const onDragEnd = (event: DragEndEvent) => {
                                const { active, over } = event;
                                if (active.id !== over?.id) {
                                    const activeIndex = fields.findIndex((i) => i.key === active.id);
                                    const overIndex = fields.findIndex((i) => i.key === over?.id);
                                    move(activeIndex, overIndex);
                                }
                            };

                            // sensors moved to component level

                            return (
                                <div style={{ maxHeight: 300, overflowY: 'auto', paddingRight: 5 }}>
                                    <DndContext sensors={sensors} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
                                        <SortableContext items={fields.map(i => i.key)} strategy={verticalListSortingStrategy}>
                                            {fields.map(({ key, name, ...restField }, index) => {
                                                const sku = form.getFieldValue(['items', name, 'sku']);
                                                const info = productMap[sku] || { price: 0, cost: 0, unit: '' };
                                                return (
                                                    <DraggableRow key={key} id={key.toString()}>
                                                        {(listeners) => (
                                                            <Row gutter={8} align="middle" style={{ marginBottom: 10, background: '#fafafa', padding: 8, borderRadius: 6, border: '1px solid #f0f0f0' }}>
                                                                <Col span={1} style={{ textAlign: 'center', cursor: 'grab' }} {...listeners}>
                                                                    <MenuOutlined style={{ color: '#999' }} />
                                                                </Col>
                                                                <Col span={10}>
                                                                    <Form.Item {...restField} name={[name, 'sku']} noStyle rules={[{ required: true }]}>
                                                                        <Select placeholder="Chọn sản phẩm con" options={products} showSearch optionFilterProp="label" style={{ width: '100%' }} />
                                                                    </Form.Item>
                                                                    <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                                                                        {canViewCost && <span>Giá vốn: {info.cost.toLocaleString()} | </span>} Giá bán lẻ: {info.price.toLocaleString()}
                                                                        {info.customer_description && <div style={{ marginTop: 2, fontStyle: 'italic', color: '#666' }}>{info.customer_description}</div>}
                                                                    </div>
                                                                </Col>
                                                                <Col span={4}>
                                                                    <Form.Item {...restField} name={[name, 'quantity']} noStyle rules={[{ required: true }]}>
                                                                        <InputNumber min={1} placeholder="SL" addonAfter={info.unit} style={{ width: '100%' }} />
                                                                    </Form.Item>
                                                                </Col>
                                                                <Col span={6} style={{ textAlign: 'right', color: '#555' }}>
                                                                    Thành tiền: <b>{(info.price * (form.getFieldValue(['items', name, 'quantity']) || 0)).toLocaleString()}</b>
                                                                </Col>
                                                                <Col span={3} style={{ textAlign: 'center' }}>
                                                                    <DeleteOutlined onClick={() => remove(name)} style={{ color: 'red', cursor: 'pointer' }} />
                                                                </Col>
                                                            </Row>
                                                        )}
                                                    </DraggableRow>
                                                );
                                            })}
                                        </SortableContext>
                                    </DndContext>
                                    <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>Thêm sản phẩm</Button>
                                </div>
                            );
                        }}
                    </Form.List>

                    <Divider />

                    {/* --- KHU VỰC THỐNG KÊ TÀI CHÍNH --- */}
                    <div style={{ background: '#f6ffed', padding: 16, borderRadius: 8, border: '1px solid #b7eb8f' }}>
                        <Row gutter={24} style={{ textAlign: 'center' }}>
                            <Col span={6}>
                                {canViewCost ? (
                                    <>
                                        <Statistic
                                            title="3. Tổng Giá Vốn (Tham Khảo)"
                                            value={metrics.totalRefCost}
                                            prefix={<CalculatorOutlined />}
                                            valueStyle={{ fontSize: 18 }}
                                        />
                                        <div style={{ fontSize: 11, color: '#888' }}>(Tổng giá vốn SP con)</div>
                                    </>
                                ) : (
                                    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}>
                                        <i>-- Ẩn (Không có quyền) --</i>
                                    </div>
                                )}
                            </Col>

                            <Col span={6} style={{ borderLeft: '1px solid #d9d9d9' }}>
                                <Statistic
                                    title="1. Tổng Giá Bán Lẻ (Tham Khảo)"
                                    value={metrics.totalRefSell}
                                    valueStyle={{ fontSize: 18 }}
                                />
                                <div style={{ fontSize: 11, color: '#888' }}>(Tổng giá bán SP con)</div>
                            </Col>

                            <Col span={6} style={{ borderLeft: '1px solid #d9d9d9' }}>
                                <Statistic
                                    title="5. Chênh lệch (So với mua lẻ)"
                                    value={Math.abs(metrics.diff)}
                                    prefix={metrics.diff < 0 ? <FallOutlined /> : <RiseOutlined />}
                                    valueStyle={{ color: metrics.diff < 0 ? '#389e0d' : '#cf1322', fontSize: 18, fontWeight: 'bold' }}
                                    suffix={metrics.diff < 0 ? "(Tiết kiệm)" : "(Đắt hơn)"}
                                />
                            </Col>

                            <Col span={6} style={{ borderLeft: '1px solid #d9d9d9', background: '#fff7e6' }}>
                                {canViewCost ? (
                                    <>
                                        <Statistic
                                            title="4. Lợi Nhuận Dự Kiến"
                                            value={metrics.profit}
                                            prefix={<DollarOutlined />}
                                            valueStyle={{ color: metrics.profit > 0 ? '#d46b08' : 'red', fontSize: 20, fontWeight: 'bold' }}
                                        />
                                        <div style={{ fontSize: 11, color: '#888' }}>(Giá chính thức - Giá vốn)</div>
                                    </>
                                ) : (
                                    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}>
                                        <i>-- Ẩn --</i>
                                    </div>
                                )}
                            </Col>
                        </Row>
                    </div>
                </Form>
            </Modal>
        </Card>
    );
};

export default CombosPage;