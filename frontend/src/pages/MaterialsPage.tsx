import React, { useEffect, useState, useMemo } from 'react';
import { Table, Tag, Button, message, Card, Row, Col, Modal, Form, Input, InputNumber, Select, Popconfirm, Space, Divider, Tabs, Tooltip } from 'antd';
import { ReloadOutlined, PlusOutlined, EditOutlined, DeleteOutlined, SwapOutlined, SearchOutlined } from '@ant-design/icons';
import axios from 'axios';

import { API_URL } from '../config'; 
const API = `${API_URL}/materials`;

const MaterialsPage: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // --- MỚI: STATE CHO TÌM KIẾM ---
  const [searchText, setSearchText] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try { 
        const res = await axios.get(API); 
        // Đảm bảo data luôn là mảng
        setData(Array.isArray(res.data) ? res.data : []); 
    } catch (e) { 
        message.error('Lỗi tải dữ liệu'); 
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async (values: any) => {
    try {
      if (editingItem) {
        await axios.put(`${API}/${editingItem.id}`, values);
        message.success('Cập nhật thành công');
      } else {
        await axios.post(API, values);
        message.success('Thêm mới thành công');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (e) { message.error('Có lỗi xảy ra'); }
  };

  const handleDelete = async (id: number) => {
    try { await axios.delete(`${API}/${id}`); message.success('Đã xóa'); fetchData(); } 
    catch (e) { message.error('Xóa thất bại'); }
  };

  // --- MỚI: LOGIC TẠO BỘ LỌC ĐỘNG TỪ DỮ LIỆU ---
  // Lấy danh sách unique các Category và Material Type để tạo filter cho cột
  const getFilters = (key: string) => {
      const uniqueValues = [...new Set(data.map(item => item[key]).filter(Boolean))];
      return uniqueValues.map(val => ({ text: val, value: val }));
  };

  // --- MỚI: LOGIC TÌM KIẾM & LỌC DỮ LIỆU ---
  const filteredData = useMemo(() => {
      if (!searchText) return data;
      const lowerSearch = searchText.toLowerCase();
      return data.filter((item: any) => 
          (item.code && item.code.toLowerCase().includes(lowerSearch)) ||
          (item.name && item.name.toLowerCase().includes(lowerSearch))
      );
  }, [data, searchText]);

  // --- CẤU HÌNH CỘT CHO TAB 1: KHO CƠ BẢN ---
  const columnsBase = [
    { 
      title: 'Nhóm', 
      dataIndex: 'category', 
      key: 'cat',
      width: 120,
      // MỚI: Filter động
      filters: getFilters('category'),
      onFilter: (value: any, record: any) => record.category === value,
      render: (t:any) => t ? <Tag color="blue">{t}</Tag> : '-' 
    },
    { 
      title: 'Loại', 
      dataIndex: 'material_type', 
      key: 'type',
      width: 120,
      // MỚI: Filter động cho Loại
      filters: getFilters('material_type'),
      onFilter: (value: any, record: any) => record.material_type === value,
      render: (t:any) => t ? <Tag color="cyan">{t}</Tag> : '-'
    },
    { 
        title: 'Mã VL', 
        dataIndex: 'code', 
        width: 120, 
        render: (t:any) => <b>{t}</b>,
        // Có thể sort theo mã
        sorter: (a: any, b: any) => (a.code || '').localeCompare(b.code || '')
    },
    { 
        title: 'Tên Nguyên Liệu', 
        dataIndex: 'name',
        // Có thể sort theo tên
        sorter: (a: any, b: any) => (a.name || '').localeCompare(b.name || '')
    },
    { 
      title: 'ĐVT', dataIndex: 'unit', align: 'center' as const, width: 80,
      render: (t:any) => <Tag color="orange">{t}</Tag>
    },
    { 
      title: 'Giá Vốn', dataIndex: 'cost_per_unit', align: 'right' as const, width: 120,
      render: (v:any) => Number(v).toLocaleString()
    },
    { 
      title: 'Tồn Kho', dataIndex: 'quantity_in_stock', align: 'right' as const, width: 120,
      render: (v:any, r:any) => <b style={{color: v>0?'green':'red', fontSize: 15}}>{Number(v).toLocaleString()}</b>,
      sorter: (a: any, b: any) => a.quantity_in_stock - b.quantity_in_stock
    },
    {
      title: 'Hành động', key: 'action', width: 100, align: 'center' as const,
      render: (_: any, record: any) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => { setEditingItem(record); form.setFieldsValue(record); setIsModalOpen(true); }} />
          <Popconfirm title="Xóa?" onConfirm={() => handleDelete(record.id)}>
            <Button icon={<DeleteOutlined />} size="small" danger />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // --- CẤU HÌNH CỘT CHO TAB 2: QUY ĐỔI ---
  const columnsConvert = [
    { title: 'Mã NPL', dataIndex: 'code', width: 120, render: (t:any) => <b>{t}</b> },
    { title: 'Tên Nguyên Liệu', dataIndex: 'name' },
    { 
        title: 'Công Thức Quy Đổi', key: 'formula', 
        render: (r:any) => (
            <div style={{ background: '#f5f5f5', padding: '5px 10px', borderRadius: 4, display: 'inline-block' }}>
                1 <b>{r.purchase_unit || '?'}</b> <SwapOutlined /> {r.conversion_factor} <b>{r.unit}</b>
            </div>
        )
    },
    { 
        title: 'Giá Mua (Tham khảo)', key: 'purchase_price', align: 'right' as const,
        render: (r:any) => {
            const purchasePrice = Number(r.cost_per_unit) * Number(r.conversion_factor);
            return (
                <Tooltip title={`= ${Number(r.cost_per_unit).toLocaleString()} * ${r.conversion_factor}`}>
                    {purchasePrice.toLocaleString()} / {r.purchase_unit}
                </Tooltip>
            )
        }
    },
    {
      title: '', key: 'action', width: 80,
      render: (_: any, record: any) => (
        <Button size="small" onClick={() => { setEditingItem(record); form.setFieldsValue(record); setIsModalOpen(true); }}>Sửa</Button>
      ),
    },
  ];

  // Lọc dữ liệu quy đổi từ dữ liệu đã search
  const conversionData = filteredData.filter((item: any) => item.purchase_unit && item.conversion_factor > 1);

  const tabItems = [
    {
      key: '1',
      label: `Danh Sách Tồn Kho (${filteredData.length})`,
      children: <Table columns={columnsBase} dataSource={filteredData} rowKey="id" loading={loading} bordered pagination={{ pageSize: 10 }} />
    },
    {
      key: '2',
      label: `Cấu Hình Quy Đổi (${conversionData.length})`,
      children: <Table columns={columnsConvert} dataSource={conversionData} rowKey="id" loading={loading} bordered />
    }
  ];

  return (
    <div>
      <Card 
        title="Quản lý Nguyên Vật Liệu" 
        extra={
            <Space>
                {/* --- MỚI: THANH TÌM KIẾM --- */}
                <Input 
                    placeholder="Tìm kiếm Mã hoặc Tên..." 
                    prefix={<SearchOutlined />} 
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    style={{ width: 250 }}
                    allowClear
                />
                <Button icon={<PlusOutlined />} type="primary" onClick={() => { setEditingItem(null); form.resetFields(); setIsModalOpen(true); }}>Thêm Mới</Button>
                <Button icon={<ReloadOutlined />} onClick={fetchData}>Tải lại</Button>
            </Space>
        }
      >
        <Tabs defaultActiveKey="1" items={tabItems} />
      </Card>

      <Modal title={editingItem ? "Sửa Nguyên Liệu" : "Thêm Nguyên Liệu Mới"} open={isModalOpen} onCancel={() => setIsModalOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ conversion_factor: 1 }}>
          <Row gutter={16}>
             <Col span={12}><Form.Item name="code" label="Mã VL" rules={[{ required: true }]}><Input /></Form.Item></Col>
             <Col span={12}><Form.Item name="name" label="Tên Nguyên Liệu" rules={[{ required: true }]}><Input /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
             <Col span={12}><Form.Item name="category" label="Nhóm"><Input placeholder="Vải, Chỉ..."/></Form.Item></Col>
             <Col span={12}><Form.Item name="material_type" label="Loại"><Input placeholder="Cotton..."/></Form.Item></Col>
          </Row>
          
          <Divider orientation="left" style={{ borderColor: '#1890ff', color: '#1890ff' }}>Quy Cách & Tồn Kho</Divider>
          
          <Row gutter={16}>
             <Col span={8}><Form.Item name="unit" label="ĐVT Kho (Gốc)" rules={[{ required: true }]}><Input placeholder="m, kg" /></Form.Item></Col>
             <Col span={8}><Form.Item name="purchase_unit" label="ĐVT Mua"><Input placeholder="Tấm, Cây" /></Form.Item></Col>
             <Col span={8}><Form.Item name="conversion_factor" label="Hệ số"><InputNumber style={{width:'100%'}} /></Form.Item></Col>
          </Row>

          <div style={{ background: '#f0f5ff', padding: '10px', borderRadius: 4, marginBottom: 20 }}>
             <Row gutter={16}>
                <Col span={12}><Form.Item name="cost_per_unit" label="Giá Vốn (trên 1 ĐVT Gốc)" style={{marginBottom:0}}><InputNumber style={{width:'100%'}} formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} /></Form.Item></Col>
                <Col span={12}><Form.Item name="quantity_in_stock" label="Số lượng Tồn (ĐVT Gốc)" style={{marginBottom:0}}><InputNumber style={{width:'100%'}} /></Form.Item></Col>
             </Row>
          </div>
        </Form>
      </Modal>
    </div>
  );
};
export default MaterialsPage;