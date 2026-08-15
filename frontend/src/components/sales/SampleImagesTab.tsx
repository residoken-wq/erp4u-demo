import React, { useState, useEffect } from 'react';
import { Input, Button, Space, message, Carousel, Empty, Popconfirm, Typography, Card } from 'antd';
import { PlusOutlined, DeleteOutlined, CheckCircleOutlined, PictureOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import api from '../../utils/api';

const { Text } = Typography;

interface SampleImagesTabProps {
    orderId: number;
    initialImages: string[];
    isApproved: boolean;
    onApprove: () => void;
    onSave: (images: string[]) => void;
    isQuotation?: boolean;
}

// Convert Google Drive share link to direct image URL
// Using thumbnail API which is more reliable than uc?export=view
const getDirectImageUrl = (url: string): string => {
    if (!url) return '';

    // Handle Google Drive links
    // Format: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
    // Convert to thumbnail API: https://drive.google.com/thumbnail?id=FILE_ID&sz=w1000
    const driveMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (driveMatch) {
        return `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=w1000`;
    }

    // Handle direct Google Drive links
    // Format: https://drive.google.com/open?id=FILE_ID
    const openMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (openMatch) {
        return `https://drive.google.com/thumbnail?id=${openMatch[1]}&sz=w1000`;
    }

    // Return as-is if not a Google Drive link
    return url;
};

const SampleImagesTab: React.FC<SampleImagesTabProps> = ({
    orderId,
    initialImages,
    isApproved,
    onApprove,
    onSave,
    isQuotation = false
}) => {
    const [images, setImages] = useState<string[]>(initialImages || []);
    const [newUrl, setNewUrl] = useState('');
    const [saving, setSaving] = useState(false);
    const carouselRef = React.useRef<any>(null);

    useEffect(() => {
        setImages(initialImages || []);
    }, [initialImages]);

    const handleAddUrl = () => {
        if (!newUrl.trim()) {
            message.warning('Vui lòng nhập URL');
            return;
        }
        if (images.length >= 10) {
            message.warning('Tối đa 10 hình ảnh');
            return;
        }
        // Validate URL format
        try {
            new URL(newUrl);
        } catch {
            message.error('URL không hợp lệ');
            return;
        }
        setImages([...images, newUrl.trim()]);
        setNewUrl('');
    };

    const handleRemoveUrl = (index: number) => {
        const newImages = images.filter((_, i) => i !== index);
        setImages(newImages);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.put(`/sales/${orderId}`, { approved_sample_images: images });
            message.success('Đã lưu hình ảnh mẫu');
            onSave(images);
        } catch (e) {
            message.error('Lỗi lưu hình ảnh');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ padding: '16px 0' }}>
            {/* URL Input Section */}
            <Card size="small" title={<><PictureOutlined /> Hình mẫu sản xuất (tối đa 10 hình)</>} style={{ marginBottom: 16 }}>
                <div style={{ marginBottom: 12 }}>
                    <Space.Compact style={{ width: '100%' }}>
                        <Input
                            placeholder="Dán URL Google Drive hình ảnh..."
                            value={newUrl}
                            onChange={(e) => setNewUrl(e.target.value)}
                            onPressEnter={handleAddUrl}
                            disabled={images.length >= 10}
                        />
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleAddUrl} disabled={images.length >= 10}>
                            Thêm
                        </Button>
                    </Space.Compact>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                        Hỗ trợ Google Drive link (ví dụ: https://drive.google.com/file/d/xxx/view)
                    </Text>
                </div>

                {/* URL List */}
                {images.length > 0 ? (
                    <div style={{ maxHeight: 150, overflowY: 'auto', marginBottom: 12 }}>
                        {images.map((url, index) => (
                            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, padding: '4px 8px', background: '#f5f5f5', borderRadius: 4 }}>
                                <Text style={{ flex: 1, fontSize: 12 }} ellipsis={{ tooltip: url }}>
                                    {index + 1}. {url}
                                </Text>
                                <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleRemoveUrl(index)} />
                            </div>
                        ))}
                    </div>
                ) : (
                    <Empty description="Chưa có hình ảnh mẫu" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: '12px 0' }} />
                )}
            </Card>

            {/* Image Slideshow */}
            {images.length > 0 && (
                <Card size="small" title="Xem trước" style={{ marginBottom: 16, position: 'relative', overflow: 'hidden' }}>
                    {/* Approved Ribbon */}
                    {isApproved && (
                        <div style={{
                            position: 'absolute',
                            top: 20,
                            right: -35,
                            background: 'linear-gradient(135deg, #52c41a, #389e0d)',
                            color: '#fff',
                            padding: '6px 40px',
                            fontSize: 11,
                            fontWeight: 700,
                            transform: 'rotate(45deg)',
                            zIndex: 10,
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                            textTransform: 'uppercase',
                            letterSpacing: 0.5
                        }}>
                            ✓ Đã duyệt
                        </div>
                    )}
                    <div style={{ position: 'relative' }}>
                        <Carousel ref={carouselRef} dots={{ className: 'custom-dots' }} autoplay={false}>
                            {images.map((url, index) => (
                                <div key={index}>
                                    <div style={{
                                        height: 300,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: '#f0f0f0',
                                        borderRadius: 8
                                    }}>
                                        <img
                                            src={getDirectImageUrl(url)}
                                            alt={`Mẫu ${index + 1}`}
                                            style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                                            onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                target.style.display = 'none';
                                                if (target.parentElement) {
                                                    target.parentElement.innerHTML = '<div style="color:#999;text-align:center;padding:20px;">⚠️ Không tải được hình<br/><small>Kiểm tra lại URL Google Drive</small></div>';
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </Carousel>
                        {images.length > 1 && (
                            <>
                                <Button
                                    shape="circle"
                                    icon={<LeftOutlined />}
                                    style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', zIndex: 1 }}
                                    onClick={() => carouselRef.current?.prev()}
                                />
                                <Button
                                    shape="circle"
                                    icon={<RightOutlined />}
                                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', zIndex: 1 }}
                                    onClick={() => carouselRef.current?.next()}
                                />
                            </>
                        )}
                    </div>
                    <div style={{ textAlign: 'center', marginTop: 8 }}>
                        <Text type="secondary">{images.length} hình ảnh</Text>
                    </div>
                </Card>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <Button onClick={handleSave} loading={saving}>
                    Lưu URLs
                </Button>
                {!isQuotation && (
                    <Popconfirm
                        title="Xác nhận duyệt mẫu sản xuất?"
                        description="Sau khi duyệt, đơn hàng sẽ chuyển sang trạng thái 'Đã duyệt mẫu'."
                        onConfirm={onApprove}
                        okText="Xác nhận"
                        cancelText="Hủy"
                    >
                        <Button
                            type="primary"
                            icon={<CheckCircleOutlined />}
                            style={{ backgroundColor: isApproved ? '#52c41a' : undefined }}
                            disabled={isApproved}
                        >
                            {isApproved ? 'Đã duyệt mẫu SX' : 'Duyệt mẫu SX'}
                        </Button>
                    </Popconfirm>
                )}
            </div>
        </div>
    );
};

export default SampleImagesTab;
