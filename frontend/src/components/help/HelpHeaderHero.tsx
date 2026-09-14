import React, { useEffect, useRef } from 'react';
import { Input, Typography, Tag, Space, Card, Row, Col, Button } from 'antd';
import {
    SearchOutlined,
    BookOutlined,
    VideoCameraOutlined,
    RocketOutlined,
    RobotOutlined,
    ThunderboltOutlined
} from '@ant-design/icons';
import { POPULAR_SEARCH_KEYWORDS } from '../../data/help/helpTopicsData';

const { Title, Paragraph, Text } = Typography;

interface HelpHeaderHeroProps {
    searchTerm: string;
    onSearchChange: (value: string) => void;
    onSelectKeyword: (kw: string) => void;
    totalDocs: number;
    totalVideos: number;
    onOpenAiAssistant?: () => void;
}

export const HelpHeaderHero: React.FC<HelpHeaderHeroProps> = ({
    searchTerm,
    onSearchChange,
    onSelectKeyword,
    totalDocs,
    totalVideos,
    onOpenAiAssistant
}) => {
    const inputRef = useRef<any>(null);

    // Keyboard shortcut: Ctrl+K or Cmd+K to focus search input
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <div
            style={{
                position: 'relative',
                background: 'linear-gradient(135deg, #090e1a 0%, #0f172a 45%, #1e293b 80%, #0284c7 100%)',
                borderRadius: '16px',
                padding: '36px 32px 28px',
                color: '#ffffff',
                marginBottom: 24,
                overflow: 'hidden',
                boxShadow: '0 20px 40px -15px rgba(2, 132, 199, 0.25)'
            }}
        >
            {/* Ambient Background Glow */}
            <div
                style={{
                    position: 'absolute',
                    top: -60,
                    right: -60,
                    width: 260,
                    height: 260,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(56, 189, 248, 0.25) 0%, rgba(14, 165, 233, 0) 70%)',
                    pointerEvents: 'none'
                }}
            />
            <div
                style={{
                    position: 'absolute',
                    bottom: -80,
                    left: 40,
                    width: 240,
                    height: 240,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(99, 102, 241, 0.2) 0%, rgba(99, 102, 241, 0) 70%)',
                    pointerEvents: 'none'
                }}
            />

            <Row gutter={[24, 24]} align="middle">
                <Col xs={24} lg={16}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 12px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: 20, backdropFilter: 'blur(8px)', marginBottom: 12 }}>
                        <ThunderboltOutlined style={{ color: '#38bdf8' }} />
                        <span style={{ fontSize: 13, color: '#e0f2fe', fontWeight: 500 }}>
                            Trung Tâm Tri Thức & Hướng Dẫn Vận Hành ERP4U
                        </span>
                    </div>

                    <Title level={2} style={{ color: '#ffffff', margin: '0 0 10px 0', fontSize: '28px', fontWeight: 700, letterSpacing: '-0.5px' }}>
                        Bạn cần trợ giúp quy trình nào hôm nay?
                    </Title>

                    <Paragraph style={{ color: '#cbd5e1', fontSize: 15, marginBottom: 20, maxWidth: 650, lineHeight: 1.6 }}>
                        Tra cứu hơn 35+ quy trình nghiệp vụ chuẩn SOP, xem video hướng dẫn thao tác trực quan và nhận hỗ trợ 24/7 từ Trợ lý ERP4U AI Copilot.
                    </Paragraph>

                    {/* Search Bar */}
                    <div style={{ maxWidth: 650, position: 'relative' }}>
                        <Input
                            ref={inputRef}
                            size="large"
                            prefix={<SearchOutlined style={{ color: '#0284c7', fontSize: 20, marginRight: 8 }} />}
                            suffix={
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ fontSize: 11, background: '#f1f5f9', color: '#64748b', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                                        Ctrl + K
                                    </span>
                                </div>
                            }
                            placeholder="Tìm kiếm: EasyInvoice, 2D Nesting, Thiết kế, Báo giá, Kho, Tính lương..."
                            value={searchTerm}
                            onChange={e => onSearchChange(e.target.value)}
                            allowClear
                            style={{
                                height: 50,
                                borderRadius: 12,
                                fontSize: 15,
                                border: '2px solid rgba(255, 255, 255, 0.2)',
                                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.25)',
                                background: '#ffffff'
                            }}
                        />
                    </div>

                    {/* Popular keywords */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 14 }}>
                        <span style={{ fontSize: 13, color: '#94a3b8', marginRight: 4 }}>Gợi ý nhanh:</span>
                        {POPULAR_SEARCH_KEYWORDS.map(kw => (
                            <Tag
                                key={kw}
                                onClick={() => onSelectKeyword(kw)}
                                style={{
                                    cursor: 'pointer',
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    color: '#e2e8f0',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    borderRadius: 14,
                                    padding: '2px 10px',
                                    fontSize: 12,
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                {kw}
                            </Tag>
                        ))}
                    </div>
                </Col>

                {/* Right Column: Quick Metric Badges */}
                <Col xs={24} lg={8}>
                    <div
                        style={{
                            background: 'rgba(15, 23, 42, 0.65)',
                            backdropFilter: 'blur(16px)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: 14,
                            padding: '20px 22px'
                        }}
                    >
                        <div style={{ fontSize: 13, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600, marginBottom: 14 }}>
                            Kho Tài Nguyên Hệ Thống
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                            <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '10px 14px', borderRadius: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#38bdf8', marginBottom: 4 }}>
                                    <BookOutlined style={{ fontSize: 16 }} />
                                    <span style={{ fontSize: 12, fontWeight: 500 }}>Tài Liệu SOP</span>
                                </div>
                                <div style={{ fontSize: 22, fontWeight: 700, color: '#ffffff' }}>
                                    {totalDocs}+
                                </div>
                            </div>

                            <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '10px 14px', borderRadius: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444', marginBottom: 4 }}>
                                    <VideoCameraOutlined style={{ fontSize: 16 }} />
                                    <span style={{ fontSize: 12, fontWeight: 500 }}>Video Thực Hành</span>
                                </div>
                                <div style={{ fontSize: 22, fontWeight: 700, color: '#ffffff' }}>
                                    {totalVideos}+
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: 14 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
                                <span style={{ fontSize: 12, color: '#cbd5e1' }}>AI Copilot Sẵn sàng</span>
                            </div>
                            {onOpenAiAssistant && (
                                <Button
                                    size="small"
                                    type="primary"
                                    icon={<RobotOutlined />}
                                    onClick={onOpenAiAssistant}
                                    style={{
                                        background: '#0284c7',
                                        borderColor: '#0284c7',
                                        borderRadius: 6,
                                        fontSize: 12,
                                        fontWeight: 600
                                    }}
                                >
                                    Chat với AI
                                </Button>
                            )}
                        </div>
                    </div>
                </Col>
            </Row>
        </div>
    );
};
