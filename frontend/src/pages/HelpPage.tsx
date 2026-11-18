import React, { useState, useMemo, useEffect } from 'react';
import { Layout, Tabs, Typography, Tag, Card, Row, Col, Input, Button, Breadcrumb, Badge, Empty } from 'antd';
import {
    BookOutlined,
    VideoCameraOutlined,
    RocketOutlined,
    RobotOutlined,
    SearchOutlined,
    ShopOutlined,
    ExperimentOutlined,
    PrinterOutlined,
    ContainerOutlined,
    DollarOutlined,
    TeamOutlined,
    ThunderboltOutlined,
    FireOutlined,
    PlayCircleOutlined,
    AppstoreOutlined
} from '@ant-design/icons';
import { HelpHeaderHero } from '../components/help/HelpHeaderHero';
import { KnowledgeMediaCenter } from '../components/help/KnowledgeMediaCenter';
import { HelpDocReader } from '../components/help/HelpDocReader';
import { WhatsNewChangelog } from '../components/help/WhatsNewChangelog';
import { HelpAiAssistant } from '../components/help/HelpAiAssistant';
import { HELP_TOPICS, ROLE_FILTERS } from '../data/help/helpTopicsData';
import { KNOWLEDGE_MEDIA_LIST } from '../data/help/knowledgeMediaData';
import { HelpTopic, RoleCategory } from '../data/help/types';

const { Content, Sider } = Layout;
const { Title, Paragraph, Text } = Typography;

const HelpPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'docs' | 'knowledge' | 'changelog' | 'ai'>('docs');
    const [selectedTopicId, setSelectedTopicId] = useState<string>('intro');
    const [selectedCategory, setSelectedCategory] = useState<RoleCategory>('ALL');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [aiInitialQuestion, setAiInitialQuestion] = useState<string | undefined>(undefined);

    // Filtered topics based on search query and category
    const filteredTopics = useMemo(() => {
        return HELP_TOPICS.filter(t => {
            const matchesCategory = selectedCategory === 'ALL' || t.category === selectedCategory;
            const matchesSearch =
                searchTerm.trim() === '' ||
                t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                t.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
                t.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
            return matchesCategory && matchesSearch;
        });
    }, [searchTerm, selectedCategory]);

    // Active topic object
    const currentTopic = useMemo(() => {
        return HELP_TOPICS.find(t => t.id === selectedTopicId) || HELP_TOPICS[0];
    }, [selectedTopicId]);

    // Handle switching to a topic directly
    const handleSelectTopic = (topicId: string) => {
        setSelectedTopicId(topicId);
        setActiveTab('docs');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Handle asking AI about a specific topic
    const handleAskAi = (topicTitle: string) => {
        setAiInitialQuestion(topicTitle);
        setActiveTab('ai');
    };

    const handleSelectKeyword = (keyword: string) => {
        setSearchTerm(keyword);
    };

    return (
        <div style={{ background: '#f8fafc', minHeight: '100vh', padding: '16px 24px 40px' }}>
            {/* Top Breadcrumb */}
            <Breadcrumb
                style={{ marginBottom: 16 }}
                items={[
                    { title: <a href="/">Trang chủ</a> },
                    { title: 'Trung Tâm Tri Thức & Hướng Dẫn' },
                    {
                        title:
                            activeTab === 'docs'
                                ? 'Tài Liệu Hướng Dẫn'
                                : activeTab === 'knowledge'
                                ? 'Thư Viện Trực Quan (Video)'
                                : activeTab === 'changelog'
                                ? 'Tính Năng Mới'
                                : 'Trợ Lý AI Help Copilot'
                    }
                ]}
            />

            {/* Hero Banner with Instant Search */}
            <HelpHeaderHero
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onSelectKeyword={handleSelectKeyword}
                totalDocs={HELP_TOPICS.length}
                totalVideos={KNOWLEDGE_MEDIA_LIST.length}
                onOpenAiAssistant={() => setActiveTab('ai')}
            />

            {/* Main Navigation Tabs */}
            <div style={{ marginBottom: 20 }}>
                <Tabs
                    activeKey={activeTab}
                    onChange={key => setActiveTab(key as any)}
                    size="large"
                    tabBarStyle={{
                        background: '#ffffff',
                        padding: '6px 20px 0',
                        borderRadius: 12,
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                        marginBottom: 20
                    }}
                    items={[
                        {
                            key: 'docs',
                            label: (
                                <span style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <BookOutlined style={{ fontSize: 18, color: '#0284c7' }} />
                                    Tài Liệu Hướng Dẫn (Docs & SOP)
                                </span>
                            )
                        },
                        {
                            key: 'knowledge',
                            label: (
                                <span style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <PlayCircleOutlined style={{ fontSize: 18, color: '#ef4444' }} />
                                    Knowledge Hub (Video & Hình Ảnh)
                                    <Badge count="Hot" style={{ backgroundColor: '#ef4444' }} />
                                </span>
                            )
                        },
                        {
                            key: 'changelog',
                            label: (
                                <span style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <RocketOutlined style={{ fontSize: 18, color: '#16a34a' }} />
                                    Tính Năng Mới & Bản Phát Hành
                                    <Badge count="Mới" style={{ backgroundColor: '#16a34a' }} />
                                </span>
                            )
                        },
                        {
                            key: 'ai',
                            label: (
                                <span style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <RobotOutlined style={{ fontSize: 18, color: '#8b5cf6' }} />
                                    Trợ Lý AI Help Copilot
                                </span>
                            )
                        }
                    ]}
                />
            </div>

            {/* TAB CONTENT 1: DOCUMENTATION & SOPS */}
            {activeTab === 'docs' && (
                <Layout style={{ background: 'transparent' }}>
                    <Row gutter={[24, 24]}>
                        {/* Left Sidebar: Topics Catalog */}
                        <Col xs={24} lg={8} xl={7}>
                            <Card
                                title={
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>
                                            Danh Mục Hướng Dẫn
                                        </span>
                                        <Tag color="blue" style={{ borderRadius: 10 }}>
                                            {filteredTopics.length} bài
                                        </Tag>
                                    </div>
                                }
                                style={{
                                    borderRadius: 14,
                                    border: '1px solid #e2e8f0',
                                    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)',
                                    position: 'sticky',
                                    top: 20
                                }}
                                bodyStyle={{ padding: 12 }}
                            >
                                {/* Role Filter Chips */}
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid #f1f5f9' }}>
                                    {ROLE_FILTERS.map(rf => (
                                        <Tag
                                            key={rf.key}
                                            onClick={() => setSelectedCategory(rf.key as RoleCategory)}
                                            style={{
                                                cursor: 'pointer',
                                                padding: '3px 8px',
                                                borderRadius: 10,
                                                fontSize: 11,
                                                fontWeight: selectedCategory === rf.key ? 700 : 400,
                                                background: selectedCategory === rf.key ? '#0284c7' : '#f8fafc',
                                                color: selectedCategory === rf.key ? '#ffffff' : '#475569',
                                                borderColor: selectedCategory === rf.key ? '#0284c7' : '#e2e8f0'
                                            }}
                                        >
                                            {rf.label}
                                        </Tag>
                                    ))}
                                </div>

                                {/* List of topics */}
                                <div style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto', paddingRight: 4 }}>
                                    {filteredTopics.length === 0 ? (
                                        <Empty description="Không có bài viết phù hợp" style={{ padding: '20px 0' }} />
                                    ) : (
                                        filteredTopics.map(topic => {
                                            const isSelected = topic.id === selectedTopicId;
                                            return (
                                                <div
                                                    key={topic.id}
                                                    onClick={() => setSelectedTopicId(topic.id)}
                                                    style={{
                                                        padding: '10px 12px',
                                                        borderRadius: 10,
                                                        marginBottom: 6,
                                                        cursor: 'pointer',
                                                        background: isSelected ? '#eff6ff' : '#ffffff',
                                                        border: isSelected ? '1px solid #93c5fd' : '1px solid #f1f5f9',
                                                        transition: 'all 0.2s ease',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: 4
                                                    }}
                                                    onMouseEnter={e => {
                                                        if (!isSelected) e.currentTarget.style.background = '#f8fafc';
                                                    }}
                                                    onMouseLeave={e => {
                                                        if (!isSelected) e.currentTarget.style.background = '#ffffff';
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            {topic.isNew && (
                                                                <span style={{ fontSize: 9, background: '#10b981', color: '#fff', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                                                                    MỚI
                                                                </span>
                                                            )}
                                                            <span
                                                                style={{
                                                                    fontSize: 13,
                                                                    fontWeight: isSelected ? 700 : 500,
                                                                    color: isSelected ? '#1d4ed8' : '#1e293b',
                                                                    lineHeight: 1.4
                                                                }}
                                                            >
                                                                {topic.title}
                                                            </span>
                                                        </div>
                                                        {(topic.youtubeId || topic.videoUrl) && (
                                                            <PlayCircleOutlined style={{ color: '#ef4444', fontSize: 14, flexShrink: 0 }} title="Có video hướng dẫn" />
                                                        )}
                                                    </div>

                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#94a3b8' }}>
                                                        <span>{topic.categoryName}</span>
                                                        <span>•</span>
                                                        <span>{topic.estimatedReadTime}</span>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </Card>
                        </Col>

                        {/* Right Content Area: Detailed Document Reader */}
                        <Col xs={24} lg={16} xl={17}>
                            <Card
                                style={{
                                    borderRadius: 14,
                                    border: '1px solid #e2e8f0',
                                    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)',
                                    minHeight: 600
                                }}
                                bodyStyle={{ padding: '28px 32px' }}
                            >
                                <HelpDocReader topic={currentTopic} onAskAiAboutTopic={handleAskAi} />
                            </Card>
                        </Col>
                    </Row>
                </Layout>
            )}

            {/* TAB CONTENT 2: KNOWLEDGE HUB (VIDEO & MEDIA) */}
            {activeTab === 'knowledge' && (
                <Card
                    style={{
                        borderRadius: 14,
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)'
                    }}
                    bodyStyle={{ padding: '24px 28px' }}
                >
                    <KnowledgeMediaCenter searchTerm={searchTerm} onSelectTopic={handleSelectTopic} />
                </Card>
            )}

            {/* TAB CONTENT 3: WHAT'S NEW & CHANGELOG */}
            {activeTab === 'changelog' && (
                <Card
                    style={{
                        borderRadius: 14,
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)'
                    }}
                    bodyStyle={{ padding: '28px 32px' }}
                >
                    <WhatsNewChangelog />
                </Card>
            )}

            {/* TAB CONTENT 4: HELP AI COPILOT */}
            {activeTab === 'ai' && (
                <HelpAiAssistant initialQuestion={aiInitialQuestion} onSelectTopic={handleSelectTopic} />
            )}
        </div>
    );
};

export default HelpPage;
