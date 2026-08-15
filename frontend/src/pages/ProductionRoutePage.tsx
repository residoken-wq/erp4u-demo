import React, { useEffect, useState } from 'react';
import { Table, Button, message, Card, Modal, Form, Input, Select, Tag, Space, Steps, InputNumber, Row, Col, Checkbox, Popconfirm, Typography } from 'antd';
import { ReloadOutlined, ExperimentOutlined, NodeIndexOutlined, DeleteOutlined, PlusOutlined, SaveOutlined, ArrowRightOutlined } from '@ant-design/icons';
import axios from 'axios';
import { API_URL } from '../config';

const { Text } = Typography;

const ProductionRoutePage: React.FC = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [manufacturers, setManufacturers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<any>(null);
  
  const [form] = Form.useForm();

  // 1. Fetch Data
  const fetchData = async () => {
    setLoading(true);
    try {
        const resProd = await axios.get(`${API_URL}/products`);
        // Chỉ lấy sản phẩm lẻ (ko phải combo)
        const prods = Array.isArray(resProd.data) ? resProd.data.filter((p:any) => !p.category?.includes('Combo')) : [];
        setProducts(prods);

        const resSupp = await axios.get(`${API_URL}/suppliers`);
        const manu = Array.isArray(resSupp.data) ? resSupp.data.filter((s:any) => s.type !== 'MATERIAL') : [];
        setManufacturers(manu.map((m:any) => ({ label: m.name, value: m.id })));
    } catch(e) {}
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // 2. Open Config
  const handleConfig = async (product: any) => {
      setCurrentProduct(product);
      try {
          // Lấy routing hiện tại
          const res = await axios.get(`${API_URL}/products/${product.id}/routings`);
          let routings = res.data;
          
          // Nếu chưa có, gợi ý quy trình chuẩn 5 bước
          if (!routings || routings.length === 0) {
              routings = [
                  { step_name: '1. Nối vải', is_required: true, cost: 0 },
                  { step_name: '2. Chần gòn', is_required: true, cost: 0 },
                  { step_name: '3. Gia công May', is_required: true, cost: 0 },
                  { step_name: '4. Gia công Thêu', is_required: false, cost: 0 },
                  { step_name: '5. Gia công Túi', is_required: false, cost: 0 },
              ];
          }
          
          form.setFieldsValue({ routings });
          setIsModalOpen(true);
      } catch(e) { message.error('Lỗi tải quy trình'); }
  };

  // 3. Save Routing
  const handleSave = async (values: any) => {
      try {
          await axios.post(`${API_URL}/products/${currentProduct.id}/routings`, values.routings);
          message.success('Đã lưu quy trình sản xuất');
          setIsModalOpen(false);
          // Gọi API tính lại giá vốn để update cost_price
          await axios.get(`${API_URL}/products/calculate-cost/${currentProduct.sku}`);
      } catch(e) { message.error('Lỗi lưu'); }
  };

  const columns = [
      { title: 'SKU', dataIndex: 'sku', width: 100, render: (t:any) => <b>{t}</b> },
      { title: 'Sản Phẩm', dataIndex: 'name' },
      { 
          title: 'Quy Trình Hiện Tại', key: 'routing', 
          render: (r:any) => (
              <Space split={<ArrowRightOutlined style={{fontSize:10, color:'#ccc'}}/>}>
                  <Tag>Chuẩn bị</Tag>
                  <Tag color="blue">SX...</Tag>
                  <Tag>Hoàn thành</Tag>
              </Space>
          ) 
      },
      { 
          title: 'Hành động', key: 'act', align: 'right' as const, width: 120,
          render: (_:any, r:any) => <Button type="primary" size="small" icon={<NodeIndexOutlined />} onClick={()=>handleConfig(r)}>Cấu hình</Button>
      }
  ];

  return (
    <div>
        <Card title="Định Nghĩa Quy Trình Sản Xuất (Routing)" extra={<Button icon={<ReloadOutlined />} onClick={fetchData} />}>
            <Table dataSource={products} columns={columns} rowKey="id" loading={loading} />
        </Card>

        <Modal title={`Cấu hình công đoạn: ${currentProduct?.name}`} open={isModalOpen} onCancel={()=>setIsModalOpen(false)} onOk={()=>form.submit()} width={800}>
            <Form form={form} layout="vertical" onFinish={handleSave}>
                <div style={{background: '#e6f7ff', padding: '10px', marginBottom: 15, borderRadius: 4, border: '1px solid #91d5ff'}}>
                    <ExperimentOutlined /> Tích chọn <b>Bắt buộc</b> nếu công đoạn đó không thể bỏ qua. Chọn <b>Nhà gia công</b> mặc định để hệ thống tự động gán khi tạo Lệnh SX.
                </div>

                <Form.List name="routings">
                    {(fields, { add, remove }) => (
                        <div style={{maxHeight: 400, overflowY:'auto'}}>
                            {fields.map(({ key, name, ...restField }) => (
                                <Row key={key} gutter={8} align="middle" style={{marginBottom: 10, borderBottom:'1px dashed #f0f0f0', paddingBottom: 10}}>
                                    <Col span={1}><Form.Item {...restField} name={[name, 'is_required']} valuePropName="checked" noStyle><Checkbox /></Form.Item></Col>
                                    <Col span={8}><Form.Item {...restField} name={[name, 'step_name']} noStyle rules={[{required:true}]}><Input placeholder="Tên công đoạn" /></Form.Item></Col>
                                    <Col span={8}><Form.Item {...restField} name={[name, 'supplier_id']} noStyle><Select placeholder="Đơn vị gia công (Mặc định)" allowClear options={manufacturers} /></Form.Item></Col>
                                    <Col span={5}><Form.Item {...restField} name={[name, 'cost']} noStyle><InputNumber placeholder="Đơn giá" style={{width:'100%'}} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} addonAfter="₫" /></Form.Item></Col>
                                    <Col span={2}><DeleteOutlined onClick={() => remove(name)} style={{color:'red', cursor:'pointer'}} /></Col>
                                </Row>
                            ))}
                            <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>Thêm công đoạn tùy chỉnh</Button>
                        </div>
                    )}
                </Form.List>
            </Form>
        </Modal>
    </div>
  );
};

export default ProductionRoutePage;