import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Spin, Card, Typography, Steps, Button, Form, Input, Alert, message, Result, Tag, Divider, Space } from 'antd';
import { CheckCircleOutlined, SolutionOutlined, IdcardOutlined, SendOutlined } from '@ant-design/icons';
import api from '../utils/api';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { Step } = Steps;

const PortalRecruitmentPage: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [submitting, setSubmitting] = useState(false);
    const [form] = Form.useForm();

    useEffect(() => {
        if (token) loadData();
    }, [token]);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/public/recruitment/portal/${token}`);
            setData(res.data);
        } catch (e: any) {
            setData({ error: true, message: e.response?.data?.message || 'Link không hợp lệ hoặc đã hết hạn.' });
        }
        setLoading(false);
    };

    const submitAssessment = async (values: any) => {
        setSubmitting(true);
        try {
            // values contains dynamic keys like answer_0, answer_1...
            const answers = Object.keys(values).map(key => {
                const qIndex = parseInt(key.replace('answer_', ''));
                return {
                    question: data.assessment.questions_json[qIndex].question,
                    answer_text: values[key]
                };
            });

            await api.post(`/public/recruitment/portal/${token}/submit-assessment`, { answers });
            message.success('Đã nộp bài đánh giá thành công!');
            loadData();
        } catch (e) {
            message.error('Lỗi khi nộp bài đánh giá.');
        }
        setSubmitting(false);
    };

    if (loading) return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>;

    if (!data || data.error) {
        return (
            <div style={{ maxWidth: 600, margin: '40px auto' }}>
                <Result status="error" title="Lỗi Truy Cập" subTitle={data?.message || 'Không tìm thấy thông tin.'} />
            </div>
        );
    }

    const { candidate, assessment, interviews } = data;
    const job = candidate.job_post;

    let currentStep = 0;
    if (candidate.status === 'ASSESSMENT_SENT' || candidate.status === 'ASSESSED') currentStep = 1;
    if (candidate.status === 'INTERVIEW_SCHEDULED') currentStep = 2;
    if (candidate.status === 'HIRED' || candidate.status === 'REJECTED') currentStep = 3;

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f0f2f5', padding: '20px 10px' }}>
            <div style={{ maxWidth: 800, margin: '0 auto' }}>
                <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                    <div style={{ textAlign: 'center', marginBottom: 30 }}>
                        <Title level={2} style={{ color: '#0050b3' }}>ERP4U - Tuyển Dụng</Title>
                        <Text type="secondary">Cổng Thông Tin Ứng Viên</Text>
                    </div>

                    <Steps current={currentStep} style={{ marginBottom: 40 }}>
                        <Step title="Đã Ứng Tuyển" icon={<IdcardOutlined />} />
                        <Step title="Bài Test" icon={<SolutionOutlined />} />
                        <Step title="Phỏng Vấn" icon={<SendOutlined />} />
                        <Step title="Kết Quả" icon={<CheckCircleOutlined />} />
                    </Steps>

                    <div style={{ marginBottom: 24, padding: 16, backgroundColor: '#fafafa', borderRadius: 8 }}>
                        <Title level={4}>Xin chào, {candidate.name}</Title>
                        <Paragraph>Cảm ơn bạn đã ứng tuyển vào vị trí <b>{job?.title}</b> tại ERP4U.</Paragraph>
                        <Descriptions item={candidate} job={job} />
                    </div>

                    {/* ASSESSMENT SECTION */}
                    {assessment && assessment.status === 'PENDING' && (
                        <div style={{ marginTop: 24 }}>
                            <Alert
                                message="BẠN CÓ MỘT BÀI ĐÁNH GIÁ CẦN HOÀN THÀNH"
                                description="Vui lòng trả lời các câu hỏi bên dưới. Hệ thống sẽ lưu lại kết quả của bạn."
                                type="info"
                                showIcon
                                style={{ marginBottom: 16 }}
                            />
                            <Card type="inner" title="Form Đánh Giá Năng Lực">
                                <Form form={form} layout="vertical" onFinish={submitAssessment}>
                                    {assessment.questions_json?.map((q: any, i: number) => (
                                        <Form.Item
                                            key={i}
                                            label={<b>{i + 1}. {q.question}</b>}
                                            name={`answer_${i}`}
                                            rules={[{ required: true, message: 'Vui lòng nhập câu trả lời' }]}
                                        >
                                            <Input.TextArea rows={4} placeholder="Nhập câu trả lời của bạn..." />
                                        </Form.Item>
                                    ))}
                                    <Button type="primary" htmlType="submit" size="large" loading={submitting} block>
                                        Nộp Bài Đánh Giá
                                    </Button>
                                </Form>
                            </Card>
                        </div>
                    )}

                    {assessment && assessment.status !== 'PENDING' && (
                        <div style={{ marginTop: 24 }}>
                            <Alert message="Bạn đã hoàn thành phần đánh giá năng lực." type="success" showIcon />
                        </div>
                    )}

                    {/* INTERVIEWS SECTION */}
                    {interviews && interviews.length > 0 && (
                        <div style={{ marginTop: 24 }}>
                            <Title level={4}>Lịch Phỏng Vấn</Title>
                            {interviews.map((intv: any) => (
                                <Card size="small" style={{ marginBottom: 16, borderColor: '#1890ff' }} key={intv.id}>
                                    <Paragraph><b>Thời gian:</b> {dayjs(intv.scheduled_at).format('HH:mm - DD/MM/YYYY')}</Paragraph>
                                    <Paragraph><b>Địa điểm:</b> {intv.location || 'Online'}</Paragraph>
                                    {intv.meeting_link && <Paragraph><b>Link:</b> <a href={intv.meeting_link} target="_blank" rel="noreferrer">{intv.meeting_link}</a></Paragraph>}
                                    <Paragraph><b>Trạng thái:</b> <Tag color={intv.result_status === 'PASS' ? 'green' : (intv.result_status === 'FAIL' ? 'red' : 'blue')}>{intv.result_status}</Tag></Paragraph>
                                </Card>
                            ))}
                        </div>
                    )}

                    {/* FINAL RESULTS */}
                    {(candidate.status === 'HIRED' || candidate.status === 'REJECTED') && (
                        <div style={{ marginTop: 24 }}>
                            <Result
                                status={candidate.status === 'HIRED' ? 'success' : 'warning'}
                                title={candidate.status === 'HIRED' ? 'Chúc mừng bạn đã trúng tuyển!' : 'Rất tiếc, bạn chưa phù hợp với vị trí này.'}
                                subTitle="Bộ phận HR sẽ liên hệ với bạn trong thời gian sớm nhất nếu có thông tin thêm."
                            />
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
};

const Descriptions = ({ item, job }: { item: any, job: any }) => (
    <Space direction="vertical" style={{ width: '100%' }}>
        <Text><b>Vị trí:</b> {job?.title} ({job?.job_type})</Text>
        <Text><b>Ngày ứng tuyển:</b> {dayjs(item.applied_at).format('DD/MM/YYYY')}</Text>
        <Text><b>Email:</b> {item.email}</Text>
        <Text><b>SĐT:</b> {item.phone}</Text>
    </Space>
);

export default PortalRecruitmentPage;
