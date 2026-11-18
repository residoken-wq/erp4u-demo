import React from 'react';

export type RoleCategory = 'ALL' | 'SALES' | 'PRODUCTION' | 'INVENTORY' | 'FINANCE' | 'HR' | 'DESIGN';

export interface HelpStep {
    title: string;
    description: React.ReactNode | string;
    icon?: string;
    tip?: string;
    warning?: string;
    image?: string;
}

export interface HelpTopic {
    id: string;
    title: string;
    category: RoleCategory;
    categoryName: string;
    tags: string[];
    summary: string;
    estimatedReadTime: string;
    updatedAt: string;
    isNew?: boolean;
    isFeatured?: boolean;
    youtubeId?: string;
    videoUrl?: string;
    steps?: HelpStep[];
    contentRenderer?: () => React.ReactNode;
    deepLink?: {
        label: string;
        path: string;
    };
    relatedTopics?: string[];
}

export interface KnowledgeVideoItem {
    id: string;
    title: string;
    category: RoleCategory;
    categoryName: string;
    description: string;
    youtubeId?: string; // YouTube video ID (e.g. "dQw4w9WgXcQ")
    videoUrl?: string;   // Full URL or embed URL
    duration: string;
    thumbnailUrl?: string;
    level: 'Cơ bản' | 'Trung cấp' | 'Nâng cao';
    badge?: string;
    keySteps: string[];
    deepLink?: {
        label: string;
        path: string;
    };
    topicId?: string;
}

export interface ChangelogModule {
    name: string;
    tag?: string;
    highlights: string[];
    deepLink?: {
        label: string;
        path: string;
    };
}

export interface ChangelogItem {
    id: string;
    date: string;
    title: string;
    tag: string;
    tagColor: string;
    isLatest?: boolean;
    modules: ChangelogModule[];
}

export interface FAQItem {
    id: string;
    category: RoleCategory;
    question: string;
    answer: string;
    relatedTopicId?: string;
    deepLink?: {
        label: string;
        path: string;
    };
}
