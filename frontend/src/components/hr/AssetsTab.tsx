import React, { useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, DatePicker, Row, Col, Tag, message, Popconfirm, Space } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../../utils/api';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

interface Props {
    employees: any[];
    assets: any[];
    onRefresh: () => void;
}

const AssetsTab: React.FC<Props> = ({ employees, assets, onRefresh }) => {
    const [modal, setModal] = useState(false);
    const [form] = Form.useForm();
    const [editing, setEditing] = useState<any>(null);

    const handleSave = async (values: any) => {
        try {
            values.assigned_date = values.assigned_date.format('YYYY-MM-DD');
            if (values.returned_date) values.returned_date = values.returned_date.format('YYYY-MM-DD');

            if (editing) {
                await api.put(`/hr/assets/${editing.id}`, values);
                message.success('Đã cập nhật');
            } else {
                await api.post('/hr/assets', values);
                message.success('Đã thêm tài sản');
            }
            setModal(false);
            form.resetFields();
            setEditing(null);
            onRefresh();
        } catch (e) { message.error('Lỗi lưu tài sản'); }
    };

    const handleEdit = (asset: any) => {
        setEditing(asset);
        form.setFieldsValue({
            ...asset,
            assigned_date: asset.assigned_date ? dayjs(asset.assigned_date) : null,
            returned_date: asset.returned_date ? dayjs(asset.returned_date) : null,
        });
        setModal(true);
    };

    const handleDelete = async (id: number) => {
        try {
            await api.delete(`/hr/assets/${id}`);
            message.success('Đã xóa');
            onRefresh();
        } catch (e) { message.error('Lỗi xóa'); }
    };

    const columns = [
        { title: 'Nhân viên', dataIndex: ['employee', 'full_name'] },
        { title: 'Tên tài sản', dataIndex: 'asset_name' },
        { title: 'Mã', dataIndex: 'asset_code' },
        { title: 'Serial', dataIndex: 'serial_number' },
        { title: 'Ngày cấp', dataIndex: 'assigned_date', render: (d: string) => dayjs(d).format('DD/MM/YYYY') },
        { title: 'Ngày trả', dataIndex: 'returned_date', render: (d: string) => d ? dayjs(d).format('DD/MM/YYYY') : '-' },
        {
            title: 'Tình trạng', dataIndex: 'condition', render: (c: string) => {
                const colors: any = { NEW: 'green', GOOD: 'blue', FAIR: 'orange', DAMAGED: 'red' };
                const labels: any = { NEW: 'Mới', GOOD: 'Tốt', FAIR: 'Bình thường', DAMAGED: 'Hư hỏng' };
                return <Tag color={colors[c]}>{labels[c]}</Tag>;
            }
        },
        {
            title: 'Thao tác',
            render: (_: any, r: any) => (
                <Space>
                    <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)} />
                    <Popconfirm title="Xóa tài sản này?" onConfirm={() => handleDelete(r.id)}>
                        <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModal(true); }} style={{ marginBottom: 16 }}>
                Cấp phát tài sản
            </Button>
            <Table
                dataSource={assets}
                columns={columns}
                rowKey="id"
                size="small"
                scroll={{ x: 750 }}
                pagination={{ pageSize: 10, showSizeChanger: false }}
            />

            <Modal title="Cấp phát tài sản" open={modal} onCancel={() => setModal(false)} onOk={() => form.submit()}>
                <Form form={form} layout="vertical" onFinish={handleSave}>
                    <Form.Item name="employee_id" label="Nhân viên" rules={[{ required: true }]}>
                        <Select>{employees.map(e => <Option key={e.id} value={e.id}>{e.full_name}</Option>)}</Select>
                    </Form.Item>
                    <Form.Item name="asset_name" label="Tên tài sản" rules={[{ required: true }]}><Input placeholder="VD: Laptop Dell XPS 15" /></Form.Item>
                    <Row gutter={16}>
                        <Col span={12}><Form.Item name="asset_code" label="Mã tài sản"><Input /></Form.Item></Col>
                        <Col span={12}><Form.Item name="serial_number" label="Serial Number"><Input /></Form.Item></Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={12}><Form.Item name="assigned_date" label="Ngày cấp" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" /></Form.Item></Col>
                        <Col span={12}><Form.Item name="condition" label="Tình trạng"><Select><Option value="NEW">Mới</Option><Option value="GOOD">Tốt</Option><Option value="FAIR">Bình thường</Option></Select></Form.Item></Col>
                    </Row>
                    <Form.Item name="note" label="Ghi chú"><TextArea rows={2} /></Form.Item>
                </Form>
            </Modal>
        </>
    );
};

export default AssetsTab;
