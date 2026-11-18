import React, { useState, useEffect } from 'react';
import { Tabs, Table, Button, Tag, Space, Modal, Form, Input, Select, DatePicker, Switch, message, Tooltip, Typography, Alert, Drawer, Divider, Card, Badge, Spin, Progress } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CopyOutlined, SendOutlined, CalendarOutlined, LoadingOutlined } from '@ant-design/icons';
import api from '../../utils/api';
import dayjs from 'dayjs';
import RichTextEditor from '../common/RichTextEditor';

const { TabPane } = Tabs;
const { TextArea } = Input;
const { Paragraph, Text } = Typography;

const RecruitmentTab: React.FC = () => {
    const [activeKey, setActiveKey] = useState('jobs');
    
    // States
    const [jobs, setJobs] = useState<any[]>([]);
    const [candidates, setCandidates] = useState<any[]>([]);
    const [interviews, setInterviews] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Modals
    const [jobModalVisible, setJobModalVisible] = useState(false);
    const [interviewModalVisible, setInterviewModalVisible] = useState(false);
    const [assessmentDrawerVisible, setAssessmentDrawerVisible] = useState(false);
    const [questionModalVisible, setQuestionModalVisible] = useState(false);
    const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);
    const [candidateDetailVisible, setCandidateDetailVisible] = useState(false);
    const [candidateDetail, setCandidateDetail] = useState<any>(null);
    
    const [selectedCandidate, setSelectedCandidate] = useState<any>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [questionsCache, setQuestionsCache] = useState<Record<number, any[]>>({});
    const [form] = Form.useForm();
    const [interviewForm] = Form.useForm();
    const [assessmentForm] = Form.useForm();
    const [questionForm] = Form.useForm();

    useEffect(() => {
        if (activeKey === 'jobs') loadJobs();
        if (activeKey === 'candidates') loadCandidates();
        if (activeKey === 'interviews') loadInterviews();
    }, [activeKey]);

    const loadJobs = async () => {
        setLoading(true);
        try {
            const res = await api.get('/hr/recruitment/jobs');
            setJobs(res.data || []);
        } catch (e) {
            message.error('Lỗi tải danh sách tin tuyển dụng');
        }
        setLoading(false);
    };

    const loadCandidates = async () => {
        setLoading(true);
        try {
            const res = await api.get('/hr/recruitment/candidates');
            setCandidates(res.data || []);
        } catch (e) {
            message.error('Lỗi tải danh sách ứng viên');
        }
        setLoading(false);
    };

    const loadInterviews = async () => {
        setLoading(true);
        try {
            const res = await api.get('/hr/recruitment/interviews');
            setInterviews(res.data || []);
        } catch (e) {
            message.error('Lỗi tải danh sách phỏng vấn');
        }
        setLoading(false);
    };

    // --- JOBS ACTIONS ---
    const handleSaveJob = async (values: any) => {
        try {
            if (values.id) {
                await api.put(`/hr/recruitment/jobs/${values.id}`, values);
                message.success('Cập nhật thành công');
            } else {
                await api.post('/hr/recruitment/jobs', values);
                message.success('Tạo thành công');
            }
            setJobModalVisible(false);
            loadJobs();
        } catch (error) {
            message.error('Lỗi khi lưu dữ liệu');
        }
    };

    const deleteJob = async (id: number) => {
        Modal.confirm({
            title: 'Xác nhận xóa',
            content: 'Bạn có chắc chắn muốn xóa job này?',
            onOk: async () => {
                await api.delete(`/hr/recruitment/jobs/${id}`);
                message.success('Xóa thành công');
                loadJobs();
            }
        });
    };

    // --- CANDIDATE ACTIONS ---
    const sendAssessment = async () => {
        try {
            const values = assessmentForm.getFieldsValue();
            const questions = values.questions || [];
            if (questions.length === 0) {
                message.warning('Danh sách câu hỏi đang trống');
                return;
            }
            // Check max_score sum
            const totalScore = questions.reduce((sum: number, q: any) => sum + Number(q.max_score || 10), 0);
            if (totalScore !== 100) {
                message.warning(`Tổng điểm hiện tại là ${totalScore}. Vui lòng phân bổ lại để tổng điểm bằng 100.`);
                return;
            }

            await api.post(`/hr/recruitment/candidates/${selectedCandidate.id}/send-assessment`, { questions });
            message.success('Đã gửi bài đánh giá');
            setAssessmentDrawerVisible(false);
            loadCandidates();
        } catch {
            message.error('Lỗi khi gửi');
        }
    }

    const copyPortalLink = (token: string) => {
        const link = `${window.location.origin}/portal/recruitment/${token}`;
        navigator.clipboard.writeText(link);
        message.success('Đã copy link portal ứng viên');
    }

    // --- INTERVIEWS ACTIONS ---
    const scheduleInterview = async (values: any) => {
        try {
            const data = {
                ...values,
                candidate_id: selectedCandidate.id,
                scheduled_at: values.scheduled_at.toISOString()
            };
            await api.post('/hr/recruitment/interviews', data);
            message.success('Đã lên lịch phỏng vấn');
            setInterviewModalVisible(false);
            loadCandidates();
            if (activeKey === 'interviews') loadInterviews();
        } catch {
            message.error('Lỗi tạo lịch phỏng vấn');
        }
    };

    const handleParseJD = async () => {
        const desc = form.getFieldValue('description');
        if (!desc || desc.trim() === '') {
            message.warning('Vui lòng nhập mô tả công việc (JD) trước khi phân tích');
            return;
        }
        setLoading(true);
        message.loading({ content: 'AI đang phân tích JD...', key: 'ai-parse' });
        try {
            const res = await api.post('/hr/recruitment/jobs/parse-requirements', { description: desc });
            form.setFieldsValue({ requirements_json: JSON.stringify(res.data, null, 2) });
            message.success({ content: 'Phân tích thành công', key: 'ai-parse' });
        } catch (e) {
            message.error({ content: 'Lỗi phân tích JD', key: 'ai-parse' });
        }
        setLoading(false);
    };

    const handleGenerateAIQuestions = async () => {
        if (!selectedCandidate) return;
        setAiLoading(true);
        message.loading({ content: 'AI đang phân tích JD & CV để tạo câu hỏi... (10-30 giây)', key: 'ai-gen', duration: 60 });
        try {
            const res = await api.post(`/hr/recruitment/candidates/${selectedCandidate.id}/generate-questions`);
            const qs = res.data?.questions || [];
            if (qs.length > 0) {
                assessmentForm.setFieldsValue({ questions: qs });
                setQuestionsCache(prev => ({ ...prev, [selectedCandidate.id]: qs }));
                message.success({ content: `Đã tạo xong ${qs.length} câu hỏi`, key: 'ai-gen' });
            } else {
                const errMsg = res.data?.error || 'Không tạo được câu hỏi (JD có thể trống)';
                message.warning({ content: errMsg, key: 'ai-gen', duration: 5 });
            }
        } catch (e: any) {
            const errDetail = e?.response?.data?.message || e?.message || 'Lỗi tạo câu hỏi chạy AI';
            message.error({ content: errDetail, key: 'ai-gen', duration: 5 });
        }
        setAiLoading(false);
    };

    const openCandidateDetail = async (record: any) => {
        setSelectedCandidate(record);
        setCandidateDetailVisible(true);
        setCandidateDetail(null);
        try {
            const res = await api.get(`/hr/recruitment/assessments/${record.id}`);
            setCandidateDetail(res.data);
        } catch (e) {
            message.error('Lỗi khi tải chi tiết đánh giá');
        }
    };

    const handleSaveQuestion = () => {
        questionForm.validateFields().then(values => {
            const questions = assessmentForm.getFieldValue('questions') || [];
            if (editingQuestionIndex !== null) {
                questions[editingQuestionIndex] = values;
            } else {
                questions.push(values);
            }
            assessmentForm.setFieldsValue({ questions: [...questions] });
            setQuestionModalVisible(false);
        });
    };

    const deleteQuestion = (index: number) => {
        const questions = assessmentForm.getFieldValue('questions') || [];
        questions.splice(index, 1);
        assessmentForm.setFieldsValue({ questions: [...questions] });
    };

    return (
        <div>
            <Tabs activeKey={activeKey} onChange={setActiveKey} size="small" type="card">
                <TabPane tab={<><Badge status="processing" /> Tin Tuyển Dụng</>} key="jobs">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div style={{ fontSize: 16, fontWeight: 600 }}>Quản lý Tin Tuyển Dụng</div>
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); form.setFieldsValue({ status: 'DRAFT', job_type: 'FULL_TIME', show_on_website: true }); setJobModalVisible(true); }}>
                            Tạo JD Mới
                        </Button>
                    </div>
                    <Table
                        size="small"
                        loading={loading}
                        dataSource={jobs}
                        rowKey="id"
                        columns={[
                            { title: 'Tiêu đề', dataIndex: 'title', key: 'title' },
                            { title: 'Loại', dataIndex: 'job_type', key: 'job_type' },
                            { title: 'Phòng ban', dataIndex: 'department', key: 'department' },
                            { title: 'Trạng thái', dataIndex: 'status', key: 'status', render: val => <Tag color={val === 'PUBLISHED' ? 'green' : 'default'}>{val}</Tag> },
                            { title: 'Hiển thị Web', dataIndex: 'show_on_website', key: 'show_on_website', render: val => val ? <Tag color="blue">Có</Tag> : <Tag>Không</Tag> },
                            {
                                title: 'Thao tác', key: 'actions', render: (_, record) => (
                                    <Space>
                                        <Button size="small" type="text" icon={<EditOutlined />} onClick={() => { form.setFieldsValue(record); setJobModalVisible(true); }} />
                                        <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => deleteJob(record.id)} />
                                    </Space>
                                )
                            }
                        ]}
                    />
                </TabPane>

                <TabPane tab="Ứng Viên" key="candidates">
                    <Table
                        size="small"
                        loading={loading}
                        dataSource={candidates}
                        rowKey="id"
                        columns={[
                            { title: 'Tên', dataIndex: 'name', key: 'name' },
                            { title: 'Ngày tạo', dataIndex: 'applied_at', key: 'applied_at', render: val => val ? dayjs(val).format('DD/MM/YYYY HH:mm') : '-' },
                            { title: 'Vị trí', key: 'job', render: (_, record) => record.job_post?.title },
                            { title: 'Score', dataIndex: 'overall_score', key: 'score', render: val => val ? <Tag color={val >= 7 ? 'green' : 'red'}>{val}</Tag> : '-' },
                            { title: 'Trạng thái', dataIndex: 'status', key: 'status', render: val => <Tag color="geekblue">{val}</Tag> },
                            { title: 'Nguồn', dataIndex: 'source', key: 'source' },
                            { title: 'CV', dataIndex: 'cv_url', key: 'cv', render: val => val ? <a href={val} target="_blank" rel="noreferrer">Xem CV</a> : '-' },
                            {
                                title: 'Thao tác', key: 'actions', render: (_, record) => (
                                    <Space size="small" wrap>
                                        <Tooltip title="Copy Portal Link">
                                            <Button size="small" type="text" icon={<CopyOutlined />} onClick={() => copyPortalLink(record.portal_token)} />
                                        </Tooltip>
                                        <Tooltip title="Tạo & Gửi bài Test">
                                            <Button size="small" type="text" icon={<SendOutlined />} onClick={() => { 
                                                setSelectedCandidate(record); 
                                                assessmentForm.resetFields(); 
                                                // Restore from cache first, then from job template
                                                const cached = questionsCache[record.id];
                                                if (cached && Array.isArray(cached)) {
                                                    assessmentForm.setFieldsValue({ questions: cached });
                                                } else {
                                                    const jt = (record.job_post as any)?.assessment_template;
                                                    if (jt && Array.isArray(jt)) {
                                                        assessmentForm.setFieldsValue({ questions: jt });
                                                    } else {
                                                        assessmentForm.setFieldsValue({ questions: [] });
                                                    }
                                                }
                                                setAssessmentDrawerVisible(true); 
                                            }} />
                                        </Tooltip>
                                        <Tooltip title="Lên lịch PV">
                                            <Button size="small" type="text" icon={<CalendarOutlined />} onClick={() => { setSelectedCandidate(record); interviewForm.resetFields(); setInterviewModalVisible(true); }} />
                                        </Tooltip>
                                        {['ASSESSED', 'INTERVIEW_SCHEDULED', 'HIRED', 'REJECTED'].includes(record.status) && (
                                            <Tooltip title="Xem kết quả AI">
                                                <Button size="small" type="text" onClick={() => openCandidateDetail(record)}>🤖</Button>
                                            </Tooltip>
                                        )}
                                    </Space>
                                )
                            }
                        ]}
                    />
                </TabPane>

                <TabPane tab="Lịch Phỏng Vấn" key="interviews">
                    <Table
                        size="small"
                        loading={loading}
                        dataSource={interviews}
                        rowKey="id"
                        columns={[
                            { title: 'Ứng viên', key: 'candidate', render: (_, record) => record.candidate?.name },
                            { title: 'Thời gian', dataIndex: 'scheduled_at', key: 'scheduled_at', render: val => dayjs(val).format('HH:mm DD/MM/YYYY') },
                            { title: 'Hình thức', key: 'loc', render: (_, record) => record.meeting_link ? <a href={record.meeting_link} target="_blank" rel="noreferrer">Online</a> : record.location },
                            { title: 'Người PV', dataIndex: 'hr_interviewer', key: 'hr' },
                            { title: 'Ket quả', dataIndex: 'result_status', key: 'status', render: val => <Tag color={val === 'PASS' ? 'green' : (val === 'FAIL' ? 'red' : 'default')}>{val}</Tag> }
                        ]}
                    />
                </TabPane>
            </Tabs>

            {/* JOB DRAWER */}
            <Drawer 
                title={form.getFieldValue('id') ? "Cập nhật Tin Tuyển Dụng" : "Tạo Tin Tuyển Dụng mới"} 
                open={jobModalVisible} 
                onClose={() => setJobModalVisible(false)} 
                width={960}
                extra={
                    <Space>
                        <Button onClick={() => setJobModalVisible(false)}>Hủy</Button>
                        <Button type="primary" onClick={() => form.submit()} icon={<SendOutlined />}>Lưu thông tin</Button>
                    </Space>
                }
            >
                <Form form={form} layout="vertical" onFinish={handleSaveJob} requiredMark="optional">
                    <Form.Item name="id" hidden><Input /></Form.Item>
                    
                    <Card size="small" title="Thông tin cơ bản" bordered={false} style={{ marginBottom: 16, background: '#f8fafc' }}>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                            <Form.Item name="title" label="Tiêu đề JD" rules={[{ required: true, message: 'Vui lòng nhập tiêu đề' }]}><Input placeholder="VD: Nhân viên Kinh Doanh" size="large" /></Form.Item>
                            <Form.Item name="slug" label="Đường dẫn (Slug)" rules={[{ required: true, message: 'Vui lòng nhập slug' }]}><Input placeholder="vd: nhan-vien-kinh-doanh" size="large" addonBefore="/" /></Form.Item>
                            <Form.Item name="department" label="Phòng ban"><Input placeholder="VD: Phòng Kinh Doanh" /></Form.Item>
                            <Form.Item name="location" label="Địa điểm làm việc"><Input placeholder="VD: Trụ sở chính HN" /></Form.Item>
                            <Form.Item name="job_type" label="Loại hợp đồng">
                                <Select>
                                    <Select.Option value="FULL_TIME">Full Time (Toàn thời gian)</Select.Option>
                                    <Select.Option value="PART_TIME">Part Time (Bán thời gian)</Select.Option>
                                    <Select.Option value="INTERN">Thực tập sinh</Select.Option>
                                </Select>
                            </Form.Item>
                            <Form.Item name="salary_range" label="Mức lương đề xuất"><Input placeholder="VD: 10.000.000 - 15.000.000 VNĐ" /></Form.Item>
                        </div>
                    </Card>

                    <Card size="small" title="Cấu hình hiển thị" bordered={false} style={{ marginBottom: 16, background: '#f8fafc' }}>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                            <Form.Item name="status" label="Trạng thái tuyển dụng">
                                <Select>
                                    <Select.Option value="DRAFT">Nháp (Chưa công bố)</Select.Option>
                                    <Select.Option value="PUBLISHED">Đang mở (Nhận hồ sơ)</Select.Option>
                                    <Select.Option value="CLOSED">Đóng (Ngừng nhận)</Select.Option>
                                </Select>
                            </Form.Item>
                            <Form.Item name="show_on_website" label="Hiển thị trên Trang chủ Website" valuePropName="checked">
                                <Switch checkedChildren="Bật" unCheckedChildren="Tắt" />
                            </Form.Item>
                        </div>
                    </Card>

                    <Alert message="Mô tả công việc sẽ hiển thị nguyên bản trên màn hình ứng viên. Vui lòng trình bày rõ ràng, sạch sẽ." type="info" showIcon style={{ marginBottom: 16 }} />
                    <Form.Item name="description" label={<span style={{fontWeight: 600}}>Chi tiết Mô Tả Công Việc (JD)</span>} getValueProps={(v: any) => ({ value: v })}>
                        <RichTextEditor minHeight={450} placeholder="Nhập mục tiêu công việc, yêu cầu kỹ năng, quyền lợi..." />
                    </Form.Item>

                    <Divider />
                    <Form.Item name="requirements_json" label={
                        <Space>
                            <span style={{fontWeight: 600}}>Yêu cầu năng lực (Competencies)</span>
                            <Button type="dashed" size="small" onClick={handleParseJD} disabled={loading} icon={<span style={{fontSize: 14}}>🤖</span>}>AI Phân Tích JD</Button>
                        </Space>
                    }>
                        <TextArea rows={4} placeholder='VD: {"skills": ["React"], "experience": ["2 years"]}' />
                    </Form.Item>

                    <Form.Item name="assessment_template" label={<span style={{fontWeight: 600}}>Khung câu hỏi Test Năng lực (Tùy chọn)</span>} tooltip="Danh sách bộ câu hỏi mặc định khi gửi bài Test cho ứng viên vị trí này">
                        <TextArea rows={4} placeholder='VD: [{"category": "Chuyên môn", "question": "Bạn đã có kinh nghiệm gì?"}]' />
                    </Form.Item>
                </Form>
            </Drawer>

            {/* ASSESSMENT DRAWER */}
            <Drawer
                title={`Gửi bài test cho ${selectedCandidate?.name}`}
                open={assessmentDrawerVisible}
                onClose={() => setAssessmentDrawerVisible(false)}
                width={960}
                extra={
                    <Space>
                        <Button onClick={() => setAssessmentDrawerVisible(false)}>Hủy</Button>
                        <Button type="primary" onClick={sendAssessment} icon={<SendOutlined />}>Duyệt & Gửi Ứng Viên</Button>
                    </Space>
                }
            >
                <Alert message="Sẽ tạo 1 link Portal riêng cho ứng viên và thay đổi trạng thái thành 'Đã Gửi Bài Test'" type="info" showIcon style={{marginBottom: 16}} />
                <Button type="dashed" block style={{marginBottom: 16}} loading={aiLoading} onClick={handleGenerateAIQuestions} icon={!aiLoading ? <span style={{fontSize: 16}}>🤖</span> : undefined}>
                    {aiLoading ? 'AI đang tạo câu hỏi và tiêu chí chấm điểm... vui lòng chờ' : '🤖 AI Tạo Câu Hỏi & Tiêu Chí Chấm Điểm (Dựa theo JD & CV)'}
                </Button>
                {aiLoading && <Progress percent={99.9} status="active" showInfo={false} strokeColor={{ from: '#108ee9', to: '#87d068' }} style={{marginBottom: 16, marginTop: -8}} />}
                
                <Form form={assessmentForm} layout="vertical">
                    <Form.Item name="questions" valuePropName="dataSource">
                        <Table
                            size="small"
                            pagination={false}
                            rowKey={(r, i) => i || 0}
                            expandable={{
                                expandedRowRender: (record: any) => (
                                    <div style={{ padding: 16, background: '#fafafa' }}>
                                        <p><strong>Mục đích:</strong> {record.intent}</p>
                                        <p><strong>Ý chính cần có:</strong> {record.key_points?.join(', ')}</p>
                                        <div className="grid grid-cols-3 gap-4 mt-4">
                                            <Card size="small" title={<span style={{color: '#52c41a'}}>Xuất sắc (8-10đ)</span>}>{record.scoring_criteria?.excellent}</Card>
                                            <Card size="small" title={<span style={{color: '#1890ff'}}>Tốt (5-7đ)</span>}>{record.scoring_criteria?.good}</Card>
                                            <Card size="small" title={<span style={{color: '#faad14'}}>Yếu (1-4đ)</span>}>{record.scoring_criteria?.poor}</Card>
                                        </div>
                                    </div>
                                )
                            }}
                            columns={[
                                { title: 'Danh mục', dataIndex: 'category', width: 120 },
                                { title: 'Nội dung câu hỏi', dataIndex: 'question' },
                                { title: 'Điểm', dataIndex: 'max_score', width: 80, render: val => <strong>{val}</strong> },
                                {
                                    title: 'Thao tác', width: 100, render: (_, record, index) => (
                                        <Space>
                                            <Button size="small" type="text" icon={<EditOutlined />} onClick={() => {
                                                setEditingQuestionIndex(index);
                                                questionForm.setFieldsValue(record);
                                                setQuestionModalVisible(true);
                                            }} />
                                            <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => deleteQuestion(index)} />
                                        </Space>
                                    )
                                }
                            ]}
                            summary={pageData => {
                                let totalScore = 0;
                                pageData.forEach(({ max_score }) => {
                                    totalScore += Number(max_score || 10);
                                });
                                return (
                                    <Table.Summary.Row>
                                        <Table.Summary.Cell index={0} colSpan={2}><strong style={{float: 'right'}}>Tổng điểm:</strong></Table.Summary.Cell>
                                        <Table.Summary.Cell index={1}>
                                            <Text type={totalScore === 100 ? 'success' : 'danger'}><strong>{totalScore}</strong> / 100</Text>
                                        </Table.Summary.Cell>
                                        <Table.Summary.Cell index={2}></Table.Summary.Cell>
                                    </Table.Summary.Row>
                                );
                            }}
                        />
                    </Form.Item>
                    <Button type="dashed" block icon={<PlusOutlined />} onClick={() => {
                        setEditingQuestionIndex(null);
                        questionForm.resetFields();
                        questionForm.setFieldsValue({ max_score: 10, scoring_criteria: { excellent: '', good: '', poor: '' }});
                        setQuestionModalVisible(true);
                    }}>Thêm câu hỏi thủ công</Button>
                </Form>
            </Drawer>

            {/* EDIT QUESTION MODAL */}
            <Modal title={editingQuestionIndex !== null ? "Chỉnh sửa câu hỏi" : "Thêm câu hỏi mới"} open={questionModalVisible} onCancel={() => setQuestionModalVisible(false)} onOk={handleSaveQuestion} width={800}>
                <Form form={questionForm} layout="vertical">
                    <div className="grid grid-cols-3 gap-4">
                        <Form.Item name="category" label="Danh mục" rules={[{ required: true }]} className="col-span-2"><Input /></Form.Item>
                        <Form.Item name="max_score" label="Điểm tối đa" rules={[{ required: true }]}><Input type="number" /></Form.Item>
                    </div>
                    <Form.Item name="question" label="Nội dung câu hỏi" rules={[{ required: true }]}><TextArea rows={2} /></Form.Item>
                    <Form.Item name="intent" label="Mục đích đánh giá"><Input /></Form.Item>
                    
                    <Divider orientation="left" plain>Tiêu chí chấm điểm</Divider>
                    <div className="grid grid-cols-3 gap-4">
                        <Form.Item name={['scoring_criteria', 'excellent']} label="Xuất sắc (8-10đ)"><TextArea rows={4} /></Form.Item>
                        <Form.Item name={['scoring_criteria', 'good']} label="Tốt (5-7đ)"><TextArea rows={4} /></Form.Item>
                        <Form.Item name={['scoring_criteria', 'poor']} label="Yếu (1-4đ)"><TextArea rows={4} /></Form.Item>
                    </div>
                </Form>
            </Modal>

            {/* CANDIDATE DETAIL DRAWER */}
            <Drawer title={`Hồ sơ ứng viên: ${selectedCandidate?.name}`} open={candidateDetailVisible} onClose={() => setCandidateDetailVisible(false)} width={960}>
                {selectedCandidate && (
                    <div className="mb-6">
                        <div className="flex gap-4 mb-4">
                            <div><strong>Vị trí:</strong> {selectedCandidate.job_post?.title}</div>
                            <div><strong>Email:</strong> {selectedCandidate.email}</div>
                            <div><strong>SĐT:</strong> {selectedCandidate.phone}</div>
                            {selectedCandidate.cv_url && <div><a href={selectedCandidate.cv_url} target="_blank" rel="noreferrer">📎 Xem CV</a></div>}
                        </div>
                        <div className="flex gap-4">
                            <div><strong>Trạng thái:</strong> <Tag color="geekblue">{selectedCandidate.status}</Tag></div>
                            <div><strong>Điểm Đánh Giá:</strong> {selectedCandidate.overall_score ? <Tag color={selectedCandidate.overall_score >= 7 ? 'green' : 'red'}>{selectedCandidate.overall_score}</Tag> : '-'}</div>
                        </div>
                    </div>
                )}

                {candidateDetail ? (
                    <>
                        {candidateDetail.ai_feedback && (
                            <Card title="🤖 Đánh giá từ AI" size="small" style={{ marginBottom: 16, background: '#f8fafc' }}>
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <strong>Đề xuất: </strong> 
                                        <Tag color={candidateDetail.ai_feedback.recommendation === 'HIRE' ? 'green' : (candidateDetail.ai_feedback.recommendation === 'REJECT' ? 'red' : 'orange')}>
                                            {candidateDetail.ai_feedback.recommendation}
                                        </Tag>
                                    </div>
                                    <div>
                                        <strong>Có dấu hiệu copy/AI: </strong>
                                        {candidateDetail.ai_feedback.duplication_flag ? <Tag color="red">Có nghi ngờ</Tag> : <Tag color="green">An toàn</Tag>}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <h4 className="text-green-600 font-semibold mb-2">✅ Điểm mạnh</h4>
                                        <ul className="list-disc pl-5">
                                            {candidateDetail.ai_feedback.pros?.map((p: string, i: number) => <li key={i}>{p}</li>)}
                                        </ul>
                                    </div>
                                    <div>
                                        <h4 className="text-orange-500 font-semibold mb-2">⚠️ Cần cải thiện</h4>
                                        <ul className="list-disc pl-5">
                                            {candidateDetail.ai_feedback.cons?.map((p: string, i: number) => <li key={i}>{p}</li>)}
                                        </ul>
                                    </div>
                                </div>
                            </Card>
                        )}

                        {candidateDetail.questions_json && candidateDetail.answers_json && (
                            <Card title="📝 Bài Test Đánh Giá" size="small">
                                {candidateDetail.questions_json.map((q: any, i: number) => {
                                    const answer = candidateDetail.answers_json?.find((a: any) => String(a.question_id) === String(q.id))?.answer_text;
                                    return (
                                        <div key={i} className="mb-6 pb-6 border-b border-gray-100 last:border-0 last:mb-0 last:pb-0">
                                            <div className="font-medium mb-2"><span className="text-gray-500">Câu {i + 1} ({q.max_score}đ):</span> {q.question}</div>
                                            <div className="bg-gray-50 p-4 rounded text-gray-700 whitespace-pre-wrap">
                                                {answer || <span className="text-gray-400 italic">Ứng viên chưa trả lời câu này</span>}
                                            </div>
                                        </div>
                                    )
                                })}
                            </Card>
                        )}
                    </>
                ) : (
                    <div style={{ textAlign: 'center', padding: 50 }}><Spin /> Đang tải chi tiết...</div>
                )}
            </Drawer>

            {/* SCHEDULE INTERVIEW MODAL */}
            <Modal title={`Lên lịch phỏng vấn cho ${selectedCandidate?.name}`} visible={interviewModalVisible} onCancel={() => setInterviewModalVisible(false)} onOk={() => interviewForm.submit()}>
                <Form form={interviewForm} layout="vertical" onFinish={scheduleInterview}>
                    <Form.Item name="scheduled_at" label="Thời gian" rules={[{ required: true }]}><DatePicker showTime format="YYYY-MM-DD HH:mm" style={{width: '100%'}} /></Form.Item>
                    <Form.Item name="location" label="Địa điểm (Offline)"><Input placeholder="VP chính..." /></Form.Item>
                    <Form.Item name="meeting_link" label="Link Meeting (Online)"><Input placeholder="https://meet.google.com/..." /></Form.Item>
                    <Form.Item name="hr_interviewer" label="Người phỏng vấn"><Input /></Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default RecruitmentTab;
