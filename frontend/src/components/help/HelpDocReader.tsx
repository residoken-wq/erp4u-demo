import React, { useState } from 'react';
import { Typography, Tag, Card, Divider, Alert, Button, Space, message, Tooltip } from 'antd';
import {
    ClockCircleOutlined,
    CalendarOutlined,
    ShareAltOutlined,
    LikeOutlined,
    DislikeOutlined,
    YoutubeOutlined,
    ArrowRightOutlined,
    RobotOutlined,
    InfoCircleOutlined,
    WarningOutlined,
    CheckCircleFilled
} from '@ant-design/icons';
import { HelpTopic } from '../../data/help/types';
import { useNavigate } from 'react-router-dom';
import { MediaViewerModal } from './MediaViewerModal';

const { Title, Paragraph, Text } = Typography;

interface HelpDocReaderProps {
    topic: HelpTopic;
    onAskAiAboutTopic?: (topicTitle: string) => void;
}

export const HelpDocReader: React.FC<HelpDocReaderProps> = ({
    topic,
    onAskAiAboutTopic
}) => {
    const navigate = useNavigate();
    const [isVideoOpen, setIsVideoOpen] = useState(false);
    const [feedback, setFeedback] = useState<'LIKED' | 'DISLIKED' | null>(null);

    const handleCopyLink = () => {
        navigator.clipboard.writeText(window.location.href);
        message.success('Đã sao chép liên kết bài viết vào bộ nhớ tạm!');
    };

    const handleFeedback = (type: 'LIKED' | 'DISLIKED') => {
        setFeedback(type);
        if (type === 'LIKED') {
            message.success('Cảm ơn bạn đã phản hồi tích cực!');
        } else {
            message.info('Cảm ơn bạn! Chúng tôi sẽ tiếp tục cải thiện nội dung hướng dẫn này.');
        }
    };

    return (
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
            {/* Header Metadata */}
            <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                    <Tag color="blue" style={{ borderRadius: 4, padding: '2px 8px', fontSize: 12 }}>
                        {topic.categoryName}
                    </Tag>
                    {topic.isNew && (
                        <Tag color="green" style={{ borderRadius: 4, padding: '2px 8px', fontSize: 12 }}>
                            Mới ra mắt
                        </Tag>
                    )}
                    {topic.tags.map(t => (
                        <Tag key={t} style={{ borderRadius: 12, background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#475569' }}>
                            #{t}
                        </Tag>
                    ))}
                </div>

                <Title level={2} style={{ color: '#0f172a', fontWeight: 700, margin: '0 0 12px 0', lineHeight: 1.3 }}>
                    {topic.title}
                </Title>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, color: '#64748b', fontSize: 13, borderBottom: '1px solid #f1f5f9', paddingBottom: 16 }}>
                    <Space size="middle">
                        <span>
                            <ClockCircleOutlined style={{ marginRight: 6 }} />
                            Thời lượng đọc: <strong>{topic.estimatedReadTime}</strong>
                        </span>
                        <span>
                            <CalendarOutlined style={{ marginRight: 6 }} />
                            Cập nhật: {topic.updatedAt}
                        </span>
                    </Space>

                    <Space>
                        <Tooltip title="Chia sẻ liên kết">
                            <Button size="small" icon={<ShareAltOutlined />} onClick={handleCopyLink}>
                                Chia sẻ
                            </Button>
                        </Tooltip>
                        {onAskAiAboutTopic && (
                            <Button
                                size="small"
                                type="primary"
                                icon={<RobotOutlined />}
                                onClick={() => onAskAiAboutTopic(topic.title)}
                                style={{ background: '#0284c7', borderColor: '#0284c7' }}
                            >
                                Hỏi AI về bài này
                            </Button>
                        )}
                    </Space>
                </div>
            </div>

            {/* Video Banner if topic has video */}
            {(topic.youtubeId || topic.videoUrl) && (
                <div
                    onClick={() => setIsVideoOpen(true)}
                    style={{
                        background: 'linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%)',
                        border: '1px solid #fecdd3',
                        borderRadius: 12,
                        padding: '16px 20px',
                        marginBottom: 24,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(239, 68, 68, 0.08)',
                        transition: 'all 0.2s ease'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div
                            style={{
                                width: 48,
                                height: 48,
                                borderRadius: '50%',
                                background: '#ef4444',
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)'
                            }}
                        >
                            <YoutubeOutlined style={{ fontSize: 26 }} />
                        </div>
                        <div>
                            <div style={{ fontWeight: 700, color: '#991b1b', fontSize: 15 }}>
                                Có video hướng dẫn trực quan cho nội dung này
                            </div>
                            <div style={{ color: '#b91c1c', fontSize: 13 }}>
                                Bấm để xem clip thao tác thực tế từng bước qua YouTube Iframe
                            </div>
                        </div>
                    </div>

                    <Button
                        type="primary"
                        danger
                        style={{ borderRadius: 8, fontWeight: 600 }}
                    >
                        Xem Video
                    </Button>
                </div>
            )}

            {/* Summary Box */}
            <div
                style={{
                    background: '#f8fafc',
                    borderLeft: '4px solid #0284c7',
                    borderRadius: '0 8px 8px 0',
                    padding: '16px 20px',
                    marginBottom: 28,
                    fontSize: 15,
                    lineHeight: 1.7,
                    color: '#334155'
                }}
            >
                <strong>Tóm lược: </strong> {topic.summary}
            </div>

            {/* Steps Content */}
            {topic.steps && topic.steps.length > 0 && (
                <div style={{ marginBottom: 32 }}>
                    <Title level={4} style={{ color: '#0f172a', marginBottom: 20 }}>
                        📋 Các bước thực hiện chi tiết
                    </Title>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                        {topic.steps.map((step, idx) => (
                            <Card
                                key={idx}
                                style={{
                                    borderRadius: 12,
                                    border: '1px solid #e2e8f0',
                                    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.03)'
                                }}
                                bodyStyle={{ padding: 20 }}
                            >
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                                    <div
                                        style={{
                                            width: 32,
                                            height: 32,
                                            borderRadius: '50%',
                                            background: '#e0f2fe',
                                            color: '#0284c7',
                                            fontWeight: 700,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                            fontSize: 14
                                        }}
                                    >
                                        {idx + 1}
                                    </div>

                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
                                            {step.title}
                                        </div>

                                        <div style={{ fontSize: 14, color: '#475569', lineHeight: 1.6, marginBottom: step.tip || step.warning ? 12 : 0 }}>
                                            {typeof step.description === 'string' ? (
                                                <div style={{ whiteSpace: 'pre-line' }}>{step.description}</div>
                                            ) : (
                                                step.description
                                            )}
                                        </div>

                                        {step.tip && (
                                            <Alert
                                                message={<span><strong>Mẹo thao tác:</strong> {step.tip}</span>}
                                                type="info"
                                                showIcon
                                                icon={<InfoCircleOutlined />}
                                                style={{ marginTop: 10, borderRadius: 6, fontSize: 13 }}
                                            />
                                        )}

                                        {step.warning && (
                                            <Alert
                                                message={<span><strong>Lưu ý quan trọng:</strong> {step.warning}</span>}
                                                type="warning"
                                                showIcon
                                                icon={<WarningOutlined />}
                                                style={{ marginTop: 10, borderRadius: 6, fontSize: 13 }}
                                            />
                                        )}
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* Custom Content Renderer (if any) */}
            {topic.contentRenderer && (
                <div style={{ marginBottom: 32 }}>
                    {topic.contentRenderer()}
                </div>
            )}

            {/* Deep Link to Application */}
            {topic.deepLink && (
                <div
                    style={{
                        background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                        border: '1px solid #bfdbfe',
                        borderRadius: 12,
                        padding: '18px 24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 32
                    }}
                >
                    <div>
                        <div style={{ fontWeight: 700, color: '#1e40af', fontSize: 15 }}>
                            Thực hành ngay trên hệ thống ERP4U
                        </div>
                        <div style={{ color: '#2563eb', fontSize: 13 }}>
                            Mở trực tiếp phân hệ nghiệp vụ tương ứng để trải nghiệm thao tác.
                        </div>
                    </div>

                    <Button
                        type="primary"
                        icon={<ArrowRightOutlined />}
                        onClick={() => navigate(topic.deepLink!.path)}
                        style={{
                            background: '#2563eb',
                            borderColor: '#2563eb',
                            borderRadius: 8,
                            fontWeight: 600
                        }}
                    >
                        {topic.deepLink.label}
                    </Button>
                </div>
            )}

            <Divider style={{ margin: '28px 0' }} />

            {/* Helpful Feedback Section */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#f8fafc',
                    padding: '16px 20px',
                    borderRadius: 10,
                    border: '1px solid #f1f5f9'
                }}
            >
                <div>
                    <span style={{ fontWeight: 600, color: '#334155', fontSize: 14 }}>
                        Tài liệu này có giải đáp được thắc mắc của bạn không?
                    </span>
                </div>

                <Space>
                    <Button
                        icon={<LikeOutlined />}
                        type={feedback === 'LIKED' ? 'primary' : 'default'}
                        onClick={() => handleFeedback('LIKED')}
                        style={{ borderRadius: 6 }}
                    >
                        Hữu ích
                    </Button>
                    <Button
                        icon={<DislikeOutlined />}
                        type={feedback === 'DISLIKED' ? 'primary' : 'default'}
                        danger={feedback === 'DISLIKED'}
                        onClick={() => handleFeedback('DISLIKED')}
                        style={{ borderRadius: 6 }}
                    >
                        Cần bổ sung
                    </Button>
                </Space>
            </div>

            {/* Video Modal Player */}
            {(topic.youtubeId || topic.videoUrl) && (
                <MediaViewerModal
                    open={isVideoOpen}
                    onClose={() => setIsVideoOpen(false)}
                    title={topic.title}
                    description={topic.summary}
                    youtubeId={topic.youtubeId}
                    videoUrl={topic.videoUrl}
                    deepLink={topic.deepLink}
                />
            )}
        </div>
    );
};
