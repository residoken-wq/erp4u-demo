import React, { useEffect, useState } from 'react';
import { Table, Button, message, Card, Modal, Form, Input, InputNumber, Popconfirm, Space, Tag } from 'antd';
import { PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined, ExperimentOutlined } from '@ant-design/icons';
import axios from 'axios';
import { API_URL } from '../config';

const ProcessesPage: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
        const res = await axios.get(`${API_URL}/processes`);
        setData(res.data);
    } catch(e) { message.error('Lỗi tải dữ liệu'); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async (values: any) => {
      try {
          // Đảm bảo standard_cost luôn có giá trị số
          const payload = {
              ...values,
              standard_cost: values.standard_cost || 0
          };

          if(editingItem) await axios.put(`${API_URL}/processes/${editingItem.id}`, payload);
          else await axios.post(`${API_URL}/processes`, payload);
          
          message.success('Thành công');
          setIsModalOpen(false); fetchData();
      } catch(e: any) { message.error(e.response?.data?.message || 'Lỗi lưu'); }
  };

  const handleDelete = async (id: number) => {
      try { await axios.delete(`${API_URL}/processes/${id}`); fetchData(); } 
      catch(e) { message.error('Không thể xóa (Đang được sử dụng)'); }
  };

  const columns = [
      { title: 'Mã Công Đoạn', dataIndex: 'code', width: 150, render: (t:any) => <b>{t}</b> },
      { title: 'Tên Công Đoạn', dataIndex: 'name', render: (t:any) => <><ExperimentOutlined /> {t}</> },
      { title: 'ĐVT Tính Lương', dataIndex: 'unit', align: 'center' as const, render: (t:any) => <Tag color="blue">{t}</Tag> },
      { title: 'Đơn Giá Định Mức', dataIndex: 'standard_cost', align: 'right' as const, render: (v:any) => Number(v).toLocaleString() },
      { 
          title: '', key: 'act', align: 'right' as const, width: 100,
          render: (_:any, r:any) => (
              <Space>
                  <Button icon={<EditOutlined />} size="small" onClick={()=>{setEditingItem(r); form.setFieldsValue(r); setIsModalOpen(true)}} />
                  <Popconfirm title="Xóa?" onConfirm={()=>handleDelete(r.id)}><Button icon={<DeleteOutlined />} size="small" danger /></Popconfirm>
              </Space>
          )
      }
  ];

  return (
    <div>
        <Card title="Danh Mục Công Đoạn Sản Xuất (Master Data)" extra={
            <Space>
                <Button type="primary" icon={<PlusOutlined />} onClick={()=>{setEditingItem(null); form.resetFields(); setIsModalOpen(true)}}>Thêm Công Đoạn</Button>
                <Button icon={<ReloadOutlined />} onClick={fetchData}>Refresh</Button>
            </Space>
        }>
            <Table dataSource={data} columns={columns} rowKey="id" loading={loading} bordered pagination={false} />
        </Card>

        <Modal title={editingItem ? "Sửa Công Đoạn" : "Thêm Công Đoạn Mới"} open={isModalOpen} onCancel={()=>setIsModalOpen(false)} onOk={()=>form.submit()}>
            <Form form={form} layout="vertical" onFinish={handleSave}>
                <Form.Item name="code" label="Mã (Viết liền, không dấu)" rules={[{required:true}]}><Input disabled={!!editingItem} placeholder="VD: P_MAY, P_THEU" /></Form.Item>
                <Form.Item name="name" label="Tên Công Đoạn" rules={[{required:true}]}><Input placeholder="VD: May vắt sổ" /></Form.Item>
                <Form.Item name="unit" label="Đơn Vị Tính (để tính lương/gia công)" rules={[{required:true}]}><Input placeholder="VD: Cái, Giờ, Đường may" /></Form.Item>
                
                {/* --- FIX: Thêm initialValue={0} và required --- */}
                <Form.Item name="standard_cost" label="Đơn Giá Định Mức (Tham khảo)" initialValue={0} rules={[{required: true, message: 'Nhập 0 nếu chưa có giá'}]}>
                    <InputNumber style={{width:'100%'}} formatter={v=>`${v}`.replace(/\B(?=(\d{3})+(?!\d))/g,',')} min={0} />
                </Form.Item>
            </Form>
        </Modal>
    </div>
  );
};

export default ProcessesPage;