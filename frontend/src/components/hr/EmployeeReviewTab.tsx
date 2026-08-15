import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Modal, Form, Radio, Input, message, Space, Typography, Badge } from 'antd';
import { FormOutlined, RobotOutlined, CheckCircleOutlined } from '@ant-design/icons';
import api from '../../utils/api';
import dayjs from 'dayjs';

const { Title, Paragraph } = Typography;

interface Props {
    employee: any;
}

const EmployeeReviewTab: React.FC<Props> = ({ employee }) => {
    const [reviews, setReviews] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Do review Modal
    const [doModal, setDoModal] = useState(false);
    const [currentReview, setCurrentReview] = useState<any>(null);
    const [form] = Form.useForm();
    const [submitting, setSubmitting] = useState(false);

    // View Review Modal
    const [viewModal, setViewModal] = useState(false);

    useEffect(() => {
        if (employee?.id) {
            loadReviews();
        }
    }, [employee]);

    const loadReviews = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/hr/employee-reviews?reviewer_id=${employee.id}`);
            setReviews(res.data);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    const handleDoReview = (review: any) => {
        setCurrentReview(review);
        form.resetFields();
        setDoModal(true);
    };

    const handleViewReview = (review: any) => {
        setCurrentReview(review);
        setViewModal(true);
    };

    const handleSubmitReview = async (values: any) => {
        setSubmitting(true);
        try {
            await api.post(`/hr/employee-reviews/${currentReview.id}/submit`, { answers: values });
            message.success('Đã nộp bài đánh giá thành công! Đang chờ AI phân tích...');
            setDoModal(false);
            setCurrentReview(null);
            loadReviews();
        } catch (e) {
            message.error('Lỗi khi nộp bài');
        }
        setSubmitting(false);
    };

    return (
        <div>
            <div style={{ marginBottom: 16 }}>
                <Typography.Text type="secondary">
                    Danh sách các bài đánh giá 360 độ bạn cần thực hiện. Bao gồm tự đánh giá và đánh giá đồng nghiệp.
                </Typography.Text>
            </div>
            
            <Table
                loading={loading}
                dataSource={reviews}
                rowKey="id"
                size="small"
                columns={[
                    { 
                        title: 'Đợt đánh giá', 
                        dataIndex: ['campaign', 'title'] 
                    },
                    {
                        title: 'Loại',
                        render: (_: any, r: any) => (
                            r.reviewer_id === r.reviewee_id 
                                ? <Tag color="purple">Tự đánh giá</Tag> 
                                : <Tag color="blue">Đánh giá đồng nghiệp</Tag>
                        )
                    },
                    {
                        title: 'Người được đánh giá',
                        render: (_: any, r: any) => r.reviewer_id === r.reviewee_id ? 'Bạn' : r.reviewee?.full_name
                    },
                    {
                        title: 'Trạng thái',
                        dataIndex: 'status',
                        render: (s: string) => s === 'SUBMITTED' 
                            ? <Badge status="success" text="Đã hoàn thành" /> 
                            : <Badge status="warning" text="Cần đánh giá" />
                    },
                    {
                        title: 'Thao tác',
                        render: (_: any, r: any) => (
                            r.status === 'PENDING' ? (
                                <Button size="small" type="primary" icon={<FormOutlined />} onClick={() => handleDoReview(r)}>
                                    Làm bài
                                </Button>
                            ) : (
                                <Button size="small" icon={<CheckCircleOutlined />} onClick={() => handleViewReview(r)}>
                                    Xem kết quả
                                </Button>
                            )
                        )
                    }
                ]}
            />

            {/* Modal Làm bài */}
            <Modal
                title={`Đánh giá 360: ${currentReview?.reviewer_id === currentReview?.reviewee_id ? 'Tự đánh giá' : `Đánh giá ${currentReview?.reviewee?.full_name}`}`}
                open={doModal}
                onCancel={() => setDoModal(false)}
                onOk={() => form.submit()}
                confirmLoading={submitting}
                width={700}
                okText="Nộp bài"
            >
                {currentReview && (
                    <Form form={form} layout="vertical" onFinish={handleSubmitReview}>
                        {currentReview.questions_json?.map((q: any, index: number) => (
                            <Card size="small" key={q.id} style={{ marginBottom: 16 }}>
                                <div style={{ marginBottom: 8 }}>
                                    <b>Câu {index + 1}:</b> {q.content} <Tag color="blue">{q.category}</Tag>
                                </div>
                                <Form.Item
                                    name={`q_${q.id}`}
                                    rules={[{ required: true, message: 'Vui lòng trả lời câu hỏi này' }]}
                                    style={{ marginBottom: 0 }}
                                >
                                    {q.type === 'RATING' ? (
                                        <Radio.Group>
                                            <Space direction="vertical">
                                                <Radio value={1}>1 - Rất kém</Radio>
                                                <Radio value={2}>2 - Kém</Radio>
                                                <Radio value={3}>3 - Trung bình</Radio>
                                                <Radio value={4}>4 - Tốt</Radio>
                                                <Radio value={5}>5 - Rất tốt</Radio>
                                            </Space>
                                        </Radio.Group>
                                    ) : (
                                        <Input.TextArea rows={3} placeholder="Nhập ý kiến của bạn..." />
                                    )}
                                </Form.Item>
                            </Card>
                        ))}
                    </Form>
                )}
            </Modal>

            {/* Modal Xem Kết Quả */}
            <Modal
                title="Kết quả đánh giá & AI Nhận xét"
                open={viewModal}
                onCancel={() => setViewModal(false)}
                footer={[<Button key="close" onClick={() => setViewModal(false)}>Đóng</Button>]}
                width={700}
            >
                {currentReview && (
                    <div>
                        <div style={{ background: '#f6ffed', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                            <Title level={5}><RobotOutlined /> AI Phân tích & Gợi ý</Title>
                            {/* Ai feedback might be JSON or Markdown */}
                            <Paragraph style={{ whiteSpace: 'pre-wrap' }}>
                                {currentReview.ai_feedback || 'Chưa có dữ liệu phản hồi từ AI.'}
                            </Paragraph>
                        </div>
                        
                        <Title level={5}>Chi tiết câu trả lời của bạn</Title>
                        {currentReview.questions_json?.map((q: any, index: number) => {
                            const ans = currentReview.answers_json ? currentReview.answers_json[`q_${q.id}`] : null;
                            return (
                                <div key={q.id} style={{ marginBottom: 12, borderBottom: '1px solid #f0f0f0', paddingBottom: 8 }}>
                                    <div><b>{index + 1}. {q.content}</b></div>
                                    <div style={{ color: '#1890ff', marginTop: 4 }}>
                                        {q.type === 'RATING' ? `Đánh giá: ${ans}/5` : `Trả lời: ${ans}`}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default EmployeeReviewTab;
