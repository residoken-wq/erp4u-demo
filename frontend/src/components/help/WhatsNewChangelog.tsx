import React from 'react';
import { Timeline, Card, Tag, Typography, Button, Space, Row, Col, Badge } from 'antd';
import {
    GiftOutlined,
    RocketOutlined,
    CheckCircleOutlined,
    ArrowRightOutlined,
    ThunderboltOutlined,
    StarFilled
} from '@ant-design/icons';
import { CHANGELOG_DATA } from '../../data/help/changelogData';
import { useNavigate } from 'react-router-dom';

const { Title, Paragraph, Text } = Typography;

export const WhatsNewChangelog: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
            {/* Intro Banner */}
            <div
                style={{
                    background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                    border: '1px solid #bbf7d0',
                    borderRadius: 14,
                    padding: '24px 28px',
                    marginBottom: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 16
                }}
            >
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <Tag color="green" icon={<StarFilled />} style={{ borderRadius: 6, padding: '2px 8px', fontSize: 12 }}>
                            Cập Nhật Liên Tục
                        </Tag>
                        <span style={{ fontSize: 13, color: '#166534', fontWeight: 600 }}>
                            Hệ thống ERP4U V2.6.0
                        </span>
                    </div>
                    <Title level={3} style={{ color: '#14532d', margin: '0 0 6px 0', fontWeight: 700 }}>
                        🚀 Khám Phá Các Tính Năng Được Cập Nhật Mới
                    </Title>
                    <Paragraph style={{ color: '#15803d', margin: 0, fontSize: 14, maxWidth: 620 }}>
                        Theo dõi nhật ký phát hành (Changelog), các công cụ tối ưu hóa mới ra mắt (Thiết kế in ấn, Xếp rập 2D Nesting, Báo cáo xưởng in, QC, EasyInvoice) và trải nghiệm ngay trên giao diện ERP.
                    </Paragraph>
                </div>

                <Button
                    type="primary"
                    icon={<RocketOutlined />}
                    onClick={() => navigate('/designs')}
                    style={{
                        background: '#16a34a',
                        borderColor: '#16a34a',
                        borderRadius: 8,
                        height: 40,
                        fontWeight: 600
                    }}
                >
                    Khám Phá Module Thiết Kế
                </Button>
            </div>

            {/* Changelog Timeline */}
            <Timeline
                mode="left"
                items={CHANGELOG_DATA.map((item, index) => ({
                    color: item.isLatest ? '#16a34a' : '#0284c7',
                    dot: item.isLatest ? <RocketOutlined style={{ fontSize: 18 }} /> : <CheckCircleOutlined style={{ fontSize: 16 }} />,
                    children: (
                        <Card
                            key={item.id}
                            style={{
                                marginBottom: 28,
                                borderRadius: 14,
                                border: item.isLatest ? '2px solid #86efac' : '1px solid #e2e8f0',
                                boxShadow: item.isLatest ? '0 8px 24px rgba(22, 163, 74, 0.1)' : '0 2px 8px rgba(0, 0, 0, 0.04)'
                            }}
                            bodyStyle={{ padding: 24 }}
                        >
                            {/* Header of Release */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                        <Tag color={item.tagColor} style={{ borderRadius: 6, fontWeight: 700, fontSize: 12 }}>
                                            {item.tag}
                                        </Tag>
                                        <Text type="secondary" style={{ fontSize: 13 }}>
                                            Ngày phát hành: {item.date}
                                        </Text>
                                        {item.isLatest && (
                                            <Badge count="MỚI NHẤT" style={{ backgroundColor: '#16a34a' }} />
                                        )}
                                    </div>
                                    <Title level={4} style={{ color: '#0f172a', margin: 0, fontWeight: 700 }}>
                                        {item.title}
                                    </Title>
                                </div>
                            </div>

                            {/* Modules in Release */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {item.modules.map((mod, mIdx) => (
                                    <div
                                        key={mIdx}
                                        style={{
                                            background: '#f8fafc',
                                            borderRadius: 10,
                                            padding: '16px 18px',
                                            border: '1px solid #f1f5f9'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <ThunderboltOutlined style={{ color: '#0284c7' }} />
                                                <strong style={{ fontSize: 15, color: '#0f172a' }}>{mod.name}</strong>
                                                {mod.tag && (
                                                    <Tag color="cyan" style={{ borderRadius: 4, fontSize: 11 }}>
                                                        {mod.tag}
                                                    </Tag>
                                                )}
                                            </div>

                                            {mod.deepLink && (
                                                <Button
                                                    size="small"
                                                    type="link"
                                                    icon={<ArrowRightOutlined />}
                                                    onClick={() => navigate(mod.deepLink!.path)}
                                                    style={{ padding: 0, fontWeight: 600, color: '#0284c7' }}
                                                >
                                                    {mod.deepLink.label}
                                                </Button>
                                            )}
                                        </div>

                                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#334155' }}>
                                            {mod.highlights.map((h, hIdx) => (
                                                <li key={hIdx} style={{ marginBottom: 6, lineHeight: 1.6 }}>
                                                    {h}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )
                }))}
            />
        </div>
    );
};
