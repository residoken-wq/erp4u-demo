import React, { useState } from 'react';
import { Card, Row, Col, Tag, Typography, Button, Input, Empty, Space, Badge } from 'antd';
import {
    PlayCircleOutlined,
    YoutubeOutlined,
    ClockCircleOutlined,
    CheckCircleOutlined,
    ArrowRightOutlined,
    BookOutlined,
    FilterOutlined
} from '@ant-design/icons';
import { KNOWLEDGE_MEDIA_LIST } from '../../data/help/knowledgeMediaData';
import { KnowledgeVideoItem, RoleCategory } from '../../data/help/types';
import { ROLE_FILTERS } from '../../data/help/helpTopicsData';
import { MediaViewerModal } from './MediaViewerModal';
import { useNavigate } from 'react-router-dom';

const { Title, Paragraph, Text } = Typography;

interface KnowledgeMediaCenterProps {
    searchTerm?: string;
    onSelectTopic?: (topicId: string) => void;
}

export const KnowledgeMediaCenter: React.FC<KnowledgeMediaCenterProps> = ({
    searchTerm = '',
    onSelectTopic
}) => {
    const navigate = useNavigate();
    const [selectedCategory, setSelectedCategory] = useState<RoleCategory>('ALL');
    const [activeVideo, setActiveVideo] = useState<KnowledgeVideoItem | null>(null);

    // Filter by search term and role
    const filteredList = KNOWLEDGE_MEDIA_LIST.filter(item => {
        const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory;
        const matchesSearch =
            searchTerm.trim() === '' ||
            item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.keySteps.some(step => step.toLowerCase().includes(searchTerm.toLowerCase()));
        return matchesCategory && matchesSearch;
    });

    return (
        <div>
            {/* Header & Role Filters */}
            <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <Title level={3} style={{ margin: 0, color: '#0f172a', fontWeight: 700 }}>
                            🎬 Thư Viện Hướng Dẫn Trực Quan & Video Thực Hành
                        </Title>
                        <Text type="secondary" style={{ fontSize: 14 }}>
                            Video minh họa từng bước thao tác thực tế trên phần mềm và sơ đồ quy trình trực quan.
                        </Text>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Tag color="red" icon={<YoutubeOutlined />} style={{ padding: '4px 10px', fontSize: 13, borderRadius: 6 }}>
                            Nhúng YouTube Iframe
                        </Tag>
                        <Tag color="blue" style={{ padding: '4px 10px', fontSize: 13, borderRadius: 6 }}>
                            {filteredList.length} bài hướng dẫn
                        </Tag>
                    </div>
                </div>

                {/* Role Tabs */}
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6 }}>
                    {ROLE_FILTERS.map(rf => {
                        const isSelected = selectedCategory === rf.key;
                        return (
                            <Button
                                key={rf.key}
                                type={isSelected ? 'primary' : 'default'}
                                onClick={() => setSelectedCategory(rf.key as RoleCategory)}
                                style={{
                                    borderRadius: 20,
                                    fontWeight: isSelected ? 600 : 400,
                                    height: 36,
                                    padding: '0 16px',
                                    border: isSelected ? 'none' : '1px solid #e2e8f0',
                                    background: isSelected ? '#0284c7' : '#ffffff',
                                    boxShadow: isSelected ? '0 4px 12px rgba(2, 132, 199, 0.25)' : 'none',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                {rf.label}
                            </Button>
                        );
                    })}
                </div>
            </div>

            {/* Video Cards Grid */}
            {filteredList.length === 0 ? (
                <Card style={{ textAlign: 'center', padding: '40px 0', borderRadius: 12, border: '1px dashed #cbd5e1' }}>
                    <Empty
                        description={
                            <div>
                                <Text strong style={{ fontSize: 16 }}>Không tìm thấy video hướng dẫn phù hợp</Text>
                                <Paragraph type="secondary" style={{ marginTop: 4 }}>
                                    Hãy thử tìm kiếm với từ khóa khác hoặc chuyển sang danh mục "Tất Cả Phân Hệ".
                                </Paragraph>
                            </div>
                        }
                    />
                </Card>
            ) : (
                <Row gutter={[20, 20]}>
                    {filteredList.map(item => (
                        <Col xs={24} md={12} xl={8} key={item.id}>
                            <Card
                                hoverable
                                style={{
                                    height: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    borderRadius: 14,
                                    overflow: 'hidden',
                                    border: '1px solid #e2e8f0',
                                    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)',
                                    transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                                }}
                                bodyStyle={{
                                    padding: 16,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    flex: 1
                                }}
                                cover={
                                    <div
                                        onClick={() => setActiveVideo(item)}
                                        style={{
                                            position: 'relative',
                                            height: 190,
                                            background: '#0f172a',
                                            cursor: 'pointer',
                                            overflow: 'hidden'
                                        }}
                                    >
                                        <img
                                            alt={item.title}
                                            src={item.thumbnailUrl}
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'cover',
                                                opacity: 0.85,
                                                transition: 'transform 0.3s ease'
                                            }}
                                            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
                                            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1.0)')}
                                        />

                                        {/* Play Button Overlay */}
                                        <div
                                            style={{
                                                position: 'absolute',
                                                top: '50%',
                                                left: '50%',
                                                transform: 'translate(-50%, -50%)',
                                                width: 56,
                                                height: 56,
                                                borderRadius: '50%',
                                                background: 'rgba(239, 68, 68, 0.92)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                boxShadow: '0 8px 24px rgba(239, 68, 68, 0.5)',
                                                transition: 'all 0.2s ease'
                                            }}
                                        >
                                            <PlayCircleOutlined style={{ fontSize: 32, color: '#ffffff' }} />
                                        </div>

                                        {/* Duration Badge */}
                                        <div
                                            style={{
                                                position: 'absolute',
                                                bottom: 10,
                                                right: 10,
                                                background: 'rgba(0, 0, 0, 0.8)',
                                                color: '#ffffff',
                                                fontSize: 12,
                                                fontWeight: 600,
                                                padding: '2px 8px',
                                                borderRadius: 4,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 4
                                            }}
                                        >
                                            <ClockCircleOutlined />
                                            {item.duration}
                                        </div>

                                        {/* Top Badge */}
                                        {item.badge && (
                                            <div
                                                style={{
                                                    position: 'absolute',
                                                    top: 10,
                                                    left: 10,
                                                    background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                                                    color: '#ffffff',
                                                    fontSize: 11,
                                                    fontWeight: 600,
                                                    padding: '3px 9px',
                                                    borderRadius: 12,
                                                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                                                }}
                                            >
                                                {item.badge}
                                            </div>
                                        )}
                                    </div>
                                }
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                    <Tag color="cyan" style={{ borderRadius: 4, margin: 0, fontSize: 11 }}>
                                        {item.categoryName}
                                    </Tag>
                                    <Tag color={item.level === 'Cơ bản' ? 'green' : item.level === 'Trung cấp' ? 'orange' : 'purple'} style={{ borderRadius: 4, margin: 0, fontSize: 11 }}>
                                        {item.level}
                                    </Tag>
                                </div>

                                <Title
                                    level={5}
                                    onClick={() => setActiveVideo(item)}
                                    style={{
                                        margin: '0 0 8px 0',
                                        color: '#0f172a',
                                        fontSize: 15,
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        lineHeight: 1.4
                                    }}
                                >
                                    {item.title}
                                </Title>

                                <Paragraph
                                    type="secondary"
                                    ellipsis={{ rows: 2 }}
                                    style={{ fontSize: 13, marginBottom: 12, color: '#64748b', lineHeight: 1.5 }}
                                >
                                    {item.description}
                                </Paragraph>

                                {/* Key Checkpoints Checklist */}
                                <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 8, marginBottom: 14 }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>
                                        Các bước thực hành chính:
                                    </div>
                                    <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: '#334155' }}>
                                        {item.keySteps.slice(0, 3).map((step, idx) => (
                                            <li key={idx} style={{ marginBottom: 3, lineHeight: 1.4 }}>
                                                {step}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Actions Footer */}
                                <div style={{ marginTop: 'auto', display: 'flex', gap: 8, paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
                                    <Button
                                        type="primary"
                                        icon={<YoutubeOutlined />}
                                        onClick={() => setActiveVideo(item)}
                                        style={{
                                            flex: 1,
                                            borderRadius: 8,
                                            background: '#ef4444',
                                            borderColor: '#ef4444',
                                            fontWeight: 600,
                                            fontSize: 12
                                        }}
                                    >
                                        Xem Video
                                    </Button>

                                    {item.topicId && onSelectTopic && (
                                        <Button
                                            icon={<BookOutlined />}
                                            onClick={() => onSelectTopic(item.topicId!)}
                                            style={{
                                                borderRadius: 8,
                                                fontSize: 12,
                                                color: '#0284c7',
                                                borderColor: '#bae6fd'
                                            }}
                                            title="Đọc quy trình chi tiết"
                                        >
                                            Chi Tiết
                                        </Button>
                                    )}

                                    {item.deepLink && (
                                        <Button
                                            icon={<ArrowRightOutlined />}
                                            onClick={() => navigate(item.deepLink!.path)}
                                            style={{
                                                borderRadius: 8,
                                                fontSize: 12
                                            }}
                                            title={item.deepLink.label}
                                        />
                                    )}
                                </div>
                            </Card>
                        </Col>
                    ))}
                </Row>
            )}

            {/* Video Modal Player */}
            {activeVideo && (
                <MediaViewerModal
                    open={!!activeVideo}
                    onClose={() => setActiveVideo(null)}
                    title={activeVideo.title}
                    description={activeVideo.description}
                    youtubeId={activeVideo.youtubeId}
                    videoUrl={activeVideo.videoUrl}
                    deepLink={activeVideo.deepLink}
                />
            )}
        </div>
    );
};
