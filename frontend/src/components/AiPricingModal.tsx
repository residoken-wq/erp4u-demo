import React, { useState } from 'react';
import { Modal, Form, Select, InputNumber, Button, Row, Col, Typography, Divider, message, Spin, Alert } from 'antd';
import { RobotOutlined, ThunderboltOutlined, RiseOutlined, SafetyOutlined } from '@ant-design/icons';
import api from '../utils/api';

const { Title, Text } = Typography;
const { Option } = Select;

interface Props {
    open: boolean;
    onClose: () => void;
    productName: string;
    costPrice: number;
    onApply: (prices: any) => void;
}

const AiPricingModal: React.FC<Props> = ({ open, onClose, productName, costPrice, onApply }) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [suggestion, setSuggestion] = useState<any>(null);

    const handleAnalyze = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);
            const payload = {
                cost_price: costPrice,
                competitor_price: values.competitor_price,
                strategy: values.strategy,
                market_volume: values.market_volume
            };

            const res = await api.post('/ai/pricing', payload);
            setSuggestion(res.data);
            message.success('Đã có đề xuất giá mới!');
        } catch (e) {
            message.error('Lỗi phân tích AI');
        } finally {
            setLoading(false);
        }
    };

    const handleApply = () => {
        if (!suggestion) return;
        onApply({
            price_100: suggestion.price_100,
            price_50: suggestion.price_50,
            price_30: suggestion.price_30,
            min_price: suggestion.min_price
        });
        onClose();
        setSuggestion(null);
        form.resetFields();
    };

    return (
        <Modal
            open={open}
            onCancel={onClose}
            title={<span><RobotOutlined style={{ color: '#1890ff' }} /> AI Trợ Giá Thông Minh</span>}
            footer={null}
            width={700}
        >
            <div style={{ marginBottom: 20 }}>
                <Alert
                    message={`Sản phẩm: ${productName}`}
                    description={<span>Giá vốn hiện tại: <b style={{ color: '#cf1322' }}>{Number(costPrice).toLocaleString()} ₫</b></span>}
                    type="info"
                    showIcon
                />
            </div>

            <Form form={form} layout="vertical" initialValues={{ strategy: 'BALANCED', market_volume: 'MEDIUM' }}>
                <Row gutter={16}>
                    <Col span={8}>
                        <Form.Item name="competitor_price" label="Giá Đối Thủ (Nếu có)">
                            <InputNumber style={{ width: '100%' }} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} placeholder="VD: 50,000" />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item name="strategy" label="Chiến lược giá" rules={[{ required: true }]}>
                            <Select>
                                <Option value="AGGRESSIVE"><ThunderboltOutlined /> Cạnh tranh (Giá rẻ)</Option>
                                <Option value="BALANCED"><SafetyOutlined /> Cân bằng (An toàn)</Option>
                                <Option value="PROFIT"><RiseOutlined /> Tối ưu Lợi nhuận</Option>
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item name="market_volume" label="Quy mô thị trường">
                            <Select>
                                <Option value="LOW">Thấp (Ngách)</Option>
                                <Option value="MEDIUM">Trung bình</Option>
                                <Option value="HIGH">Cao (Đại trà)</Option>
                            </Select>
                        </Form.Item>
                    </Col>
                </Row>
                <Button type="primary" onClick={handleAnalyze} loading={loading} block icon={<RobotOutlined />} size="large">
                    Phân Tích & Gợi Ý
                </Button>
            </Form>

            {suggestion && (
                <div style={{ marginTop: 24, padding: 20, background: '#f6ffed', borderRadius: 8, border: '1px solid #b7eb8f' }}>
                    <Title level={5} style={{ color: '#389e0d', marginTop: 0 }}>Kết Quả Đề Xuất:</Title>
                    <p style={{ fontStyle: 'italic', color: '#555' }}>"{suggestion.explanation}"</p>

                    <Divider style={{ margin: '12px 0' }} />

                    <Row gutter={16} style={{ textAlign: 'center' }}>
                        <Col span={6}>
                            <div style={{ fontSize: 12, color: '#888' }}>SL 100+</div>
                            <div style={{ fontSize: 18, fontWeight: 'bold', color: '#096dd9' }}>{Number(suggestion.price_100).toLocaleString()} ₫</div>
                        </Col>
                        <Col span={6}>
                            <div style={{ fontSize: 12, color: '#888' }}>SL 50+</div>
                            <div style={{ fontSize: 18, fontWeight: 'bold', color: '#096dd9' }}>{Number(suggestion.price_50).toLocaleString()} ₫</div>
                        </Col>
                        <Col span={6}>
                            <div style={{ fontSize: 12, color: '#888' }}>SL 30+</div>
                            <div style={{ fontSize: 18, fontWeight: 'bold', color: '#096dd9' }}>{Number(suggestion.price_30).toLocaleString()} ₫</div>
                        </Col>
                        <Col span={6}>
                            <div style={{ fontSize: 12, color: '#888' }}>Giá Sàn (Min)</div>
                            <div style={{ fontSize: 18, fontWeight: 'bold', color: '#cf1322' }}>{Number(suggestion.min_price).toLocaleString()} ₫</div>
                        </Col>
                    </Row>

                    <Button type="primary" onClick={handleApply} style={{ marginTop: 20, width: '100%' }}>
                        Áp Dụng Vào Bảng Giá
                    </Button>
                </div>
            )}
        </Modal>
    );
};

export default AiPricingModal;
