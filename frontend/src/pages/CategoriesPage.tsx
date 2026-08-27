import React, { useEffect, useState } from 'react';
import { Table, Button, message, Card, Modal, Form, Input, InputNumber, Popconfirm, Space } from 'antd';
import { ReloadOutlined, PlusOutlined, EditOutlined, DeleteOutlined, PercentageOutlined, AppstoreOutlined } from '@ant-design/icons';
import axios from 'axios';
import { API_URL } from '../config';

const CategoriesPage: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try { const res = await axios.get(`${API_URL}/categories`); setData(res.data); } 
    catch(e) { message.error('Lỗi tải dữ liệu'); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async (values: any) => {
      try {
          if(editingItem) await axios.put(`${API_URL}/categories/${editingItem.id}`, values);
          else await axios.post(`${API_URL}/categories`, values);
          message.success('Thành công. Giá sản phẩm sẽ được tự động cập nhật!');
          setIsModalOpen(false); fetchData();
      } catch(e: any) { message.error(e.response?.data?.message || 'Lỗi lưu'); }
  };

  const handleSyncSize = async (id: number) => {
      try { 
          const res = await axios.post(`${API_URL}/categories/${id}/sync-size`); 
          message.success(res.data.message || 'Đồng bộ thành công');
      } 
      catch(e: any) { message.error(e.response?.data?.message || 'Lỗi đồng bộ'); }
  };

  const handleDelete = async (id: number) => {
      try { await axios.delete(`${API_URL}/categories/${id}`); fetchData(); } 
      catch(e) { message.error('Không thể xóa danh mục đang có sản phẩm'); }
  };

  const columns = [
      { title: 'Mã', dataIndex: 'code', width: 150, render: (t:any) => <b>{t}</b> },
      { title: 'Tên Danh Mục', dataIndex: 'name', render: (t:any) => <><AppstoreOutlined /> {t}</> },
      { title: 'Tên DM Gia Công', dataIndex: 'outsourcing_category_name' },
      { title: 'Kích thước', dataIndex: 'size' },
      { 
          title: '% Biên Lợi Nhuận (Mong muốn)', dataIndex: 'profit_margin', align: 'center' as const,
          render: (v:any) => <span style={{color: '#1890ff', fontWeight:'bold', fontSize:16}}>{v}%</span>
      },
      { 
          title: '', key: 'act', align: 'right' as const, width: 140,
          render: (_:any, r:any) => (
              <Space>
                  <Button size="small" onClick={() => handleSyncSize(r.id)}>Đồng bộ K.thước</Button>
                  <Button icon={<EditOutlined />} size="small" onClick={()=>{setEditingItem(r); form.setFieldsValue(r); setIsModalOpen(true)}} />
                  <Popconfirm title="Xóa?" onConfirm={()=>handleDelete(r.id)}><Button icon={<DeleteOutlined />} size="small" danger /></Popconfirm>
              </Space>
          )
      }
  ];

  return (
    <div>
        <Card title="Quản Lý Danh Mục & Định Giá (Pricing Strategy)" extra={<Button type="primary" icon={<PlusOutlined />} onClick={()=>{setEditingItem(null); form.resetFields(); setIsModalOpen(true)}}>Thêm Danh Mục</Button>}>
            <Table dataSource={data} columns={columns} rowKey="id" loading={loading} bordered />
        </Card>

        <Modal title={editingItem ? "Sửa Danh Mục" : "Thêm Danh Mục"} open={isModalOpen} onCancel={()=>setIsModalOpen(false)} onOk={()=>form.submit()}>
            <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{profit_margin: 30}}>
                <Form.Item name="code" label="Mã Danh Mục" rules={[{required:true}]}><Input disabled={!!editingItem} /></Form.Item>
                <Form.Item name="name" label="Tên Danh Mục" rules={[{required:true}]}><Input /></Form.Item>
                <Form.Item name="outsourcing_category_name" label="Tên Danh Mục (Portal NCC)"><Input placeholder="Ví dụ: Nệm, Chăn, Gối..." /></Form.Item>
                <Form.Item name="size" label="Kích thước" help="Có thể đồng bộ kích thước này cho các sản phẩm (đang để trống kích thước) bằng nút Đồng bộ ở ngoài bảng."><Input placeholder="Ví dụ: 120x60cm, 50x70cm..." /></Form.Item>
                <Form.Item name="profit_margin" label="% Biên Lợi Nhuận Gộp (Margin)" help="Công thức: Giá Bán = Giá Vốn / (1 - %Margin). Thay đổi ở đây sẽ cập nhật giá tất cả SP thuộc danh mục." rules={[{required:true}]}>
                    <InputNumber min={0} max={90} style={{width:'100%'}} suffix={<PercentageOutlined />} />
                </Form.Item>
            </Form>
        </Modal>
    </div>
  );
};

export default CategoriesPage;