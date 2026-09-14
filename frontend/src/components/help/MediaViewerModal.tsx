import React from 'react';
import { Modal, Typography, Tag, Button, Space } from 'antd';
import { YoutubeOutlined, ArrowRightOutlined, CloseOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Paragraph, Text } = Typography;

interface MediaViewerModalProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    description?: string;
    youtubeId?: string;
    videoUrl?: string;
    imageUrl?: string;
    deepLink?: {
        label: string;
        path: string;
    };
}

export const MediaViewerModal: React.FC<MediaViewerModalProps> = ({
    open,
    onClose,
    title,
    description,
    youtubeId,
    videoUrl,
    imageUrl,
    deepLink
}) => {
    const navigate = useNavigate();

    // Determine iframe embed URL
    let embedSrc = videoUrl;
    if (youtubeId) {
        embedSrc = `https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0&modestbranding=1`;
    } else if (videoUrl && videoUrl.includes('youtube.com/watch?v=')) {
        const id = videoUrl.split('v=')[1]?.split('&')[0];
        if (id) embedSrc = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`;
    } else if (videoUrl && videoUrl.includes('youtu.be/')) {
        const id = videoUrl.split('youtu.be/')[1]?.split('?')[0];
        if (id) embedSrc = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`;
    }

    return (
        <Modal
            open={open}
            onCancel={onClose}
            footer={null}
            width={880}
            destroyOnClose
            centered
            bodyStyle={{ padding: 0, borderRadius: 12, overflow: 'hidden' }}
        >
            {/* Media Display Area */}
            <div style={{ background: '#090d16', position: 'relative', width: '100%', minHeight: 460 }}>
                {embedSrc ? (
                    <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden' }}>
                        <iframe
                            title={title || 'Video Hướng dẫn ERP4U'}
                            src={embedSrc}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                border: 0
                            }}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        />
                    </div>
                ) : imageUrl ? (
                    <div style={{ textAlign: 'center', padding: 20 }}>
                        <img
                            src={imageUrl}
                            alt={title}
                            style={{ maxWidth: '100%', maxHeight: 520, objectFit: 'contain', borderRadius: 8 }}
                        />
                    </div>
                ) : (
                    <div style={{ height: 350, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                        Không có dữ liệu media
                    </div>
                )}
            </div>

            {/* Content & Metadata */}
            <div style={{ padding: '20px 24px', background: '#ffffff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <Tag color="red" icon={<YoutubeOutlined />} style={{ borderRadius: 6, padding: '2px 8px' }}>
                                Video Tutorial
                            </Tag>
                            <Text type="secondary" style={{ fontSize: 13 }}>
                                ERP4U Video Knowledge Center
                            </Text>
                        </div>
                        <Title level={4} style={{ margin: '0 0 8px 0', color: '#0f172a' }}>
                            {title}
                        </Title>
                        {description && (
                            <Paragraph type="secondary" style={{ marginBottom: 16, lineHeight: 1.6 }}>
                                {description}
                            </Paragraph>
                        )}
                    </div>

                    <Button
                        type="text"
                        icon={<CloseOutlined />}
                        onClick={onClose}
                        style={{ color: '#64748b' }}
                    />
                </div>

                {deepLink && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
                        <Button
                            type="primary"
                            icon={<ArrowRightOutlined />}
                            onClick={() => {
                                onClose();
                                navigate(deepLink.path);
                            }}
                            style={{
                                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                                borderColor: '#2563eb',
                                borderRadius: 8,
                                height: 38
                            }}
                        >
                            {deepLink.label}
                        </Button>
                    </div>
                )}
            </div>
        </Modal>
    );
};
