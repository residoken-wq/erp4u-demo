import React, { useEffect } from 'react';
import { Form, Input, InputNumber, Select, DatePicker, Row, Col, Button, message, Upload } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import api from '../../utils/api';
import moment from 'moment';

const { Option } = Select;
const { TextArea } = Input;

interface DesignOrderFormProps {
    initialValues?: any;
    onSuccess: () => void;
}

const DesignOrderForm: React.FC<DesignOrderFormProps> = ({ initialValues, onSuccess }) => {
    const [form] = Form.useForm();

    useEffect(() => {
        if (initialValues) {
            form.setFieldsValue({
                ...initialValues,
                design_deadline: initialValues.design_deadline ? moment(initialValues.design_deadline) : null,
                print_deadline: initialValues.print_deadline ? moment(initialValues.print_deadline) : null,
                print_content: typeof initialValues.print_content === 'string' ? JSON.parse(initialValues.print_content) : initialValues.print_content
            });
        }
    }, [initialValues, form]);

    const handleFinish = async (values: any) => {
        try {
            const payload = {
                ...values,
                design_deadline: values.design_deadline ? values.design_deadline.format('YYYY-MM-DD') : null,
                print_deadline: values.print_deadline ? values.print_deadline.format('YYYY-MM-DD') : null,
            };

            if (initialValues && initialValues.id) {
                await api.put(`/designs/orders/${initialValues.id}`, payload);
                message.success('Cập nhật thành công');
            } else {
                await api.post('/designs/orders', payload);
                message.success('Tạo đơn thiết kế thành công');
            }
            onSuccess();
        } catch (error) {
            message.error('Có lỗi xảy ra');
        }
    };

    return (
        <Form form={form} layout="vertical" onFinish={handleFinish}>
            <Row gutter={16}>
                <Col span={12}>
                    <Form.Item label="Tên trường (Tiếng Việt/Anh)" name="school_name" rules={[{ required: true, message: 'Vui lòng nhập tên trường' }]}>
                        <Input />
                    </Form.Item>
                </Col>
                <Col span={12}>
                    <Form.Item label="Liên kết Đơn hàng (SO / PO)" name="sales_order_id">
                        <Input placeholder="Nhập ID (Tính năng autocomplete sẽ cập nhật sau)" />
                    </Form.Item>
                </Col>
            </Row>

            <Row gutter={16}>
                <Col span={8}>
                    <Form.Item label="Loại sản phẩm" name="product_type" rules={[{ required: true }]}>
                        <Select>
                            <Option value="Túi">Túi</Option>
                            <Option value="Gối">Gối</Option>
                            <Option value="Chăn">Chăn</Option>
                            <Option value="Nệm">Nệm</Option>
                            <Option value="Bộ combo">Bộ combo</Option>
                        </Select>
                    </Form.Item>
                </Col>
                <Col span={8}>
                    <Form.Item label="Kích thước" name="dimensions" rules={[{ required: true }]}>
                        <Input placeholder="VD: 50x41 cm" />
                    </Form.Item>
                </Col>
                <Col span={8}>
                    <Form.Item label="Số lượng đặt" name="quantity" rules={[{ required: true }]}>
                        <InputNumber style={{ width: '100%' }} />
                    </Form.Item>
                </Col>
            </Row>

            <Row gutter={16}>
                <Col span={8}>
                    <Form.Item label="Kiểu (VD: ba lô rút)" name="product_style">
                        <Input />
                    </Form.Item>
                </Col>
                <Col span={8}>
                    <Form.Item label="Mã màu nền túi" name="background_color">
                        <Input placeholder="VD: pc107" />
                    </Form.Item>
                </Col>
                <Col span={8}>
                    <Form.Item label="Màu in nội dung" name="print_text_color">
                        <Input placeholder="VD: Trắng/Đen/Vàng" />
                    </Form.Item>
                </Col>
            </Row>

            <Row gutter={16}>
                <Col span={12}>
                    <Form.Item label="Nguồn Logo" name="logo_source">
                        <Select>
                            <Option value="SELF_CHECK">Tự kiếm (Ưu tiên)</Option>
                            <Option value="DESIGN_TEAM">Nhờ thiết kế check</Option>
                        </Select>
                    </Form.Item>
                </Col>
                <Col span={12}>
                    <Form.Item label="Số lượng màu test" name="test_color_count">
                        <InputNumber min={0} max={2} style={{ width: '100%' }} placeholder="Tối đa 2 màu" />
                    </Form.Item>
                </Col>
            </Row>

            <Form.Item label="Nội dung cần in (Địa chỉ, Hotline, Slogan, Tên lớp...)" name={['print_content', 'details']}>
                <TextArea rows={3} placeholder="Mô tả chi tiết các nội dung cần in..." />
            </Form.Item>

            <Row gutter={16}>
                <Col span={12}>
                    <Form.Item label="Deadline Thiết Kế" name="design_deadline">
                        <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                </Col>
                <Col span={12}>
                    <Form.Item label="Deadline In" name="print_deadline">
                        <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                </Col>
            </Row>

            <Form.Item label="Ghi chú thêm" name="notes">
                <TextArea rows={2} />
            </Form.Item>

            <Form.Item>
                <Button type="primary" htmlType="submit" block>
                    Lưu Đơn Thiết Kế
                </Button>
            </Form.Item>
        </Form>
    );
};

export default DesignOrderForm;
