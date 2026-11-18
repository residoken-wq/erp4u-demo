import React, { useEffect, useState } from 'react';
import { Form, Input, InputNumber, Button, Table, Row, Col, Card, Upload, message, Divider, Space, Typography, Modal, List } from 'antd';
import { UploadOutlined, PlusOutlined, DeleteOutlined, CalculatorOutlined, SaveOutlined, CopyOutlined } from '@ant-design/icons';
import api from '../../utils/api';
import { API_URL } from '../../config';
import UnifiedDesignWorkflow from '../production/UnifiedDesignWorkflow';

const { Text } = Typography;

interface ProductPatternTabProps {
    editingItem: any;
}

const ProductPatternTab: React.FC<ProductPatternTabProps> = ({ editingItem }) => {
    const [loading, setLoading] = useState(false);
    const [imageUrl, setImageUrl] = useState<string>('');
    const [details, setDetails] = useState<any[]>([]); // Danh sách chi tiết rập
    const [form] = Form.useForm();

    const [printDesigns, setPrintDesigns] = useState<any[]>([]);
    
    const [isStandaloneModalVisible, setIsStandaloneModalVisible] = useState(false);
    const [editingMarker, setEditingMarker] = useState<any>(null);
    const [isCopyModalVisible, setIsCopyModalVisible] = useState(false);
    const [categoryDesigns, setCategoryDesigns] = useState<any[]>([]);
    const [searchCopyText, setSearchCopyText] = useState('');
    
    // --- Pattern Copy States ---
    const [isCopyPatternModalVisible, setIsCopyPatternModalVisible] = useState(false);
    const [categoryProductsWithPattern, setCategoryProductsWithPattern] = useState<any[]>([]);

    useEffect(() => {
        if (editingItem?.id) {
            fetchPattern();
            fetchPrintDesigns();
        }
    }, [editingItem]);

    const fetchDesignsByCategory = async () => {
        if (!editingItem?.category_id) {
            message.warning('Sản phẩm chưa có Danh mục!');
            return;
        }
        try {
            const res = await api.get(`/designs/print-designs?category_id=${editingItem.category_id}`);
            // Filter out current product's designs
            const filtered = res.data.filter((d: any) => d.product_id !== editingItem.id);
            setCategoryDesigns(filtered);
            setIsCopyModalVisible(true);
        } catch (e) {
            message.error('Lỗi tải danh sách sơ đồ cùng danh mục');
        }
    };

    const handleCopyDesign = async (design: any) => {
        try {
            const dataToSave = {
                code: `SD-${Date.now()}`,
                name: `Copy từ: ${design.name}`,
                type: design.type,
                product_id: editingItem.id, // assign to current product
                customer_id: design.customer_id,
                tech_pack: design.tech_pack
            };
            await api.post('/designs/print-designs', dataToSave);
            message.success('Sao chép sơ đồ thành công!');
            setIsCopyModalVisible(false);
            fetchPrintDesigns();
        } catch (e) {
            message.error('Lỗi khi sao chép sơ đồ');
        }
    };

    const fetchPrintDesigns = async () => {
        try {
            const res = await api.get(`/designs/print-designs?product_id=${editingItem.id}`);
            setPrintDesigns(res.data);
        } catch (e) {
            console.error('Error fetching print designs', e);
        }
    };
    
    const fetchProductsForPatternCopy = async () => {
        if (!editingItem?.category_id) {
            message.warning('Sản phẩm chưa có Danh mục!');
            return;
        }
        try {
            const res = await api.get(`/products?category_id=${editingItem.category_id}&limit=100`);
            const products = res.data.items || res.data || [];
            const filtered = products.filter((p: any) => p.id !== editingItem.id);
            setCategoryProductsWithPattern(filtered);
            setIsCopyPatternModalVisible(true);
        } catch (e) {
            message.error('Lỗi tải danh sách sản phẩm cùng danh mục');
        }
    };
    
    const handleCopyPattern = async (product: any) => {
        try {
            const res = await api.get(`/products/${product.id}/pattern`);
            if (res.data) {
                form.setFieldsValue({
                    fabric_width: res.data.fabric_width,
                    fabric_yield: res.data.fabric_yield,
                    note: res.data.note
                });
                setImageUrl(res.data.image_url || '');
                setDetails(res.data.details || []);
                message.success('Đã sao chép cấu hình Rập. Vui lòng bấm Lưu để ghi nhận!');
                setIsCopyPatternModalVisible(false);
            } else {
                message.warning('Sản phẩm này chưa có dữ liệu rập!');
            }
        } catch (e) {
            message.error('Lỗi tải thông tin rập của sản phẩm');
        }
    };

    const fetchPattern = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/products/${editingItem.id}/pattern`);
            if (res.data) {
                form.setFieldsValue({
                    fabric_width: res.data.fabric_width,
                    fabric_yield: res.data.fabric_yield,
                    note: res.data.note
                });
                setImageUrl(res.data.image_url || '');
                setDetails(res.data.details || []);
            }
        } catch (e) {
            // Chưa có pattern thì không làm gì
        }
        setLoading(false);
    };

    // --- LOGIC TÍNH TOÁN ĐỊNH MỨC ---
    const calculateYield = () => {
        const width = form.getFieldValue('fabric_width') || 0; // Khổ vải (cm)
        if (width <= 0) {
            message.warning('Vui lòng nhập Khổ vải > 0');
            return;
        }

        // Tính tổng diện tích các chi tiết (Dài x Rộng x Số lượng)
        let totalArea = 0;
        details.forEach(d => {
            const l = Number(d.length) || 0;
            const w = Number(d.width) || 0;
            const q = Number(d.quantity) || 0;
            totalArea += (l * w * q);
        });

        // Giả sử hiệu suất giác sơ đồ (Marker Efficiency) khoảng 85% - 90% (Hệ số hao hụt)
        // Công thức ước lượng: (Tổng diện tích / Khổ vải) * Hệ số hao hụt (1.15)
        // Đổi đơn vị: Area (cm2), Width (cm) => Length (cm) => (m)

        const efficiency = 0.85; // Hiệu suất sử dụng vải trung bình
        const estimatedLengthCm = (totalArea / width) / efficiency;
        const estimatedLengthM = estimatedLengthCm / 100;

        form.setFieldsValue({ fabric_yield: estimatedLengthM.toFixed(4) });
        message.success(`Đã tính toán: ${estimatedLengthM.toFixed(4)} m (Hiệu suất ~85%)`);
    };

    const handleSave = async (values: any) => {
        try {
            await api.post(`/products/${editingItem.id}/pattern`, {
                ...values,
                image_url: imageUrl,
                details: details
            });
            message.success('Lưu sơ đồ rập thành công');
        } catch (e) {
            message.error('Lỗi khi lưu');
        }
    };

    // --- XỬ LÝ ẢNH ---
    // Lưu ý: Đây là Mock upload, thực tế cần API upload file trả về URL
    const uploadProps = {
        name: 'file',
        action: `${API_URL}/upload/image`, // Correct API Endpoint
        data: { source: 'erp' },
        showUploadList: false,
        onChange(info: any) {
            if (info.file.status === 'done') {
                // API returns { url: '/uploads/filename.ext' }
                if (info.file.response && info.file.response.url) {
                    setImageUrl(info.file.response.url);
                    message.success('Upload ảnh thành công');
                }
            } else if (info.file.status === 'error') {
                message.error(`${info.file.name} upload thất bại.`);
            }
        },
    };

    // --- TABLE CHI TIẾT ---
    const columns = [
        { title: 'Tên chi tiết', dataIndex: 'name', render: (t: any, r: any, i: number) => <Input value={t} onChange={e => updateDetail(i, 'name', e.target.value)} placeholder="Vd: Thân trước" /> },
        { title: 'Dài (cm)', dataIndex: 'length', width: 100, render: (t: any, r: any, i: number) => <InputNumber min={0} value={t} onChange={v => updateDetail(i, 'length', v)} /> },
        { title: 'Rộng (cm)', dataIndex: 'width', width: 100, render: (t: any, r: any, i: number) => <InputNumber min={0} value={t} onChange={v => updateDetail(i, 'width', v)} /> },
        { title: 'Số lượng', dataIndex: 'quantity', width: 80, render: (t: any, r: any, i: number) => <InputNumber min={1} value={t} onChange={v => updateDetail(i, 'quantity', v)} /> },
        { title: 'Xóa', width: 50, render: (_: any, __: any, i: number) => <Button danger icon={<DeleteOutlined />} size="small" onClick={() => { const n = [...details]; n.splice(i, 1); setDetails(n); }} /> }
    ];

    const updateDetail = (index: number, field: string, value: any) => {
        const newDetails = [...details];
        newDetails[index] = { ...newDetails[index], [field]: value };
        setDetails(newDetails);
    };

    return (
        <>
            <Row gutter={24}>
                {/* Cột Trái: Hình ảnh & Thông số chung */}
            <Col span={10}>
                <Card 
                    title="Sơ đồ Rập (Marker)" 
                    size="small"
                    extra={<Button size="small" type="default" icon={<CopyOutlined />} onClick={fetchProductsForPatternCopy}>Copy Rập</Button>}
                >
                    <div style={{ textAlign: 'center', marginBottom: 20 }}>
                        {imageUrl ? (
                            <img src={imageUrl.startsWith('http') ? imageUrl : `${API_URL.replace('/api', '')}${imageUrl}`} alt="Sơ đồ" style={{ maxWidth: '100%', maxHeight: 300, border: '1px dashed #ccc', borderRadius: 8 }} />
                        ) : (
                            <div style={{ height: 200, background: '#fafafa', border: '1px dashed #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>Chưa có hình ảnh</div>
                        )}
                        <div style={{ marginTop: 10 }}>
                            <Upload {...uploadProps}>
                                <Button icon={<UploadOutlined />}>Tải ảnh sơ đồ</Button>
                            </Upload>
                            {imageUrl && <Button type="text" danger onClick={() => setImageUrl('')}>Xóa ảnh</Button>}
                        </div>
                    </div>

                    <Form form={form} layout="vertical" onFinish={handleSave}>
                        <Form.Item name="fabric_width" label="Khổ vải (cm)" rules={[{ required: true }]}>
                            <InputNumber style={{ width: '100%' }} suffix="cm" placeholder="Vd: 150" />
                        </Form.Item>

                        <div style={{ background: '#e6f7ff', padding: 15, borderRadius: 8, border: '1px solid #91d5ff', marginBottom: 20 }}>
                            <Form.Item name="fabric_yield" label={<span style={{ fontWeight: 'bold', color: '#0050b3' }}>Định mức tiêu hao (Yield)</span>} style={{ marginBottom: 0 }}>
                                <InputNumber style={{ width: '100%', fontSize: 16, fontWeight: 'bold' }} step={0.0001} addonAfter="mét / sp" />
                            </Form.Item>
                            <div style={{ marginTop: 5, textAlign: 'right' }}>
                                <Button type="link" size="small" icon={<CalculatorOutlined />} onClick={calculateYield}>Tự động tính từ chi tiết</Button>
                            </div>
                        </div>

                        <Form.Item name="note" label="Ghi chú kỹ thuật">
                            <Input.TextArea rows={3} placeholder="Lưu ý khi giác sơ đồ, độ co rút..." />
                        </Form.Item>

                        <Button type="primary" htmlType="submit" icon={<SaveOutlined />} block>Lưu Thông Tin Rập</Button>
                    </Form>
                </Card>
            </Col>

            {/* Cột Phải: Chi tiết bán thành phẩm */}
            <Col span={14}>
                <Card title="Chi tiết các tấm rập (Cut Pieces)" size="small" extra={<Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => setDetails([...details, { quantity: 1 }])}>Thêm chi tiết</Button>}>
                    <Table
                        dataSource={details}
                        columns={columns}
                        rowKey={(r, i) => i || 0}
                        pagination={false}
                        size="small"
                        summary={(pageData) => {
                            let totalArea = 0;
                            pageData.forEach(({ length, width, quantity }) => {
                                totalArea += (Number(length || 0) * Number(width || 0) * Number(quantity || 0));
                            });
                            return (
                                <Table.Summary.Row>
                                    <Table.Summary.Cell index={0} colSpan={5} align="right">
                                        <Text type="secondary" style={{ fontSize: 12 }}>Tổng diện tích bề mặt: {(totalArea / 10000).toFixed(4)} m²</Text>
                                    </Table.Summary.Cell>
                                </Table.Summary.Row>
                            );
                        }}
                    />
                    <div style={{ marginTop: 10, fontSize: 12, color: '#666', fontStyle: 'italic' }}>
                        * Nhập kích thước bao (Dài x Rộng) của từng chi tiết rập để hệ thống ước tính định mức vải.
                    </div>
                </Card>
            </Col>
        </Row>

        <Divider />
        <Card 
            title="Các Sơ đồ In/Thêu (Markers) đã lưu cho sản phẩm này" 
            size="small"
            extra={
                <Space>
                    <Button type="default" icon={<CopyOutlined />} onClick={fetchDesignsByCategory}>Copy Sơ đồ từ SP cùng loại</Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingMarker(null); setIsStandaloneModalVisible(true); }}>Tạo Sơ đồ Marker</Button>
                </Space>
            }
        >
            <Table
                dataSource={printDesigns}
                rowKey="id"
                pagination={false}
                size="small"
                columns={[
                    { title: 'Mã Sơ đồ', dataIndex: 'code', render: (t) => <b>{t}</b> },
                    { title: 'Tên Sơ đồ', dataIndex: 'name' },
                    { title: 'Ngày tạo', dataIndex: 'created_at', render: (t) => new Date(t).toLocaleString() },
                    { title: 'Khách hàng', render: (r: any) => r.customer?.name || '-' },
                    { title: 'Loại', dataIndex: 'type' },
                    { title: 'SL Mặt vải', render: (r: any) => r.tech_pack?.faces?.length || 0 },
                    { title: 'Thao tác', render: (r: any) => <Button type="link" onClick={() => { setEditingMarker(r); setIsStandaloneModalVisible(true); }}>Sửa</Button> }
                ]}
            />
        </Card>

        <Modal 
            title={editingMarker ? "Sửa Sơ đồ Marker" : "Tạo Sơ đồ Marker"} 
            open={isStandaloneModalVisible} 
            onCancel={() => setIsStandaloneModalVisible(false)} 
            footer={null} 
            width="95%"
            destroyOnClose
            style={{ top: 20 }}
        >
            <UnifiedDesignWorkflow 
                standaloneProduct={editingItem} 
                initialMarker={editingMarker}
                onStandaloneComplete={() => { 
                    setIsStandaloneModalVisible(false); 
                    fetchPrintDesigns(); 
                }} 
            />
        </Modal>

        <Modal 
            title="Sao chép Sơ đồ từ Sản phẩm cùng Danh mục" 
            open={isCopyModalVisible} 
            onCancel={() => setIsCopyModalVisible(false)} 
            footer={null} 
            width={700}
        >
            <Input.Search 
                placeholder="Tìm kiếm sơ đồ, mã hàng, tên sản phẩm..." 
                value={searchCopyText}
                onChange={e => setSearchCopyText(e.target.value)}
                style={{ marginBottom: 16 }}
            />
            <Table
                dataSource={categoryDesigns.filter(d => 
                    d.name?.toLowerCase().includes(searchCopyText.toLowerCase()) || 
                    d.code?.toLowerCase().includes(searchCopyText.toLowerCase()) ||
                    d.product?.name?.toLowerCase().includes(searchCopyText.toLowerCase()) ||
                    d.product?.sku?.toLowerCase().includes(searchCopyText.toLowerCase())
                )}
                rowKey="id"
                pagination={{ pageSize: 5 }}
                size="small"
                columns={[
                    { title: 'Sản phẩm', render: (r: any) => `${r.product?.sku || ''} - ${r.product?.name || ''}` },
                    { title: 'Tên Sơ đồ', dataIndex: 'name' },
                    { title: 'Thao tác', render: (r: any) => <Button type="primary" size="small" onClick={() => handleCopyDesign(r)}>Sao chép</Button> }
                ]}
            />
        </Modal>

        <Modal 
            title="Sao chép Sơ đồ rập từ Sản phẩm cùng Danh mục" 
            open={isCopyPatternModalVisible} 
            onCancel={() => setIsCopyPatternModalVisible(false)} 
            footer={null} 
            width={700}
        >
            <Input.Search 
                placeholder="Tìm kiếm sản phẩm..." 
                allowClear 
                style={{ marginBottom: 16 }}
            />
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                <List
                    dataSource={categoryProductsWithPattern}
                    renderItem={(item: any) => (
                        <List.Item
                            actions={[<Button type="primary" size="small" onClick={() => handleCopyPattern(item)}>Sao chép</Button>]}
                        >
                            <List.Item.Meta
                                title={<b>{item.name}</b>}
                                description={`SKU: ${item.sku || '-'}`}
                            />
                        </List.Item>
                    )}
                />
            </div>
        </Modal>

        </>
    );
};

export default ProductPatternTab;