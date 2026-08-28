import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemConfig } from './system-config.entity';
import { ApiToken } from './entities/api-token.entity';
import { ActivityLog } from './entities/activity-log.entity';
import { ContractTemplate } from './contract-template.entity';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { EmailTemplate } from './email-template.entity';
import { EmailService } from '../common/services/email.service';

export const DEFAULT_SO_PROJECT_TEMPLATE = [
    {
        title: 'Chốt đơn & Hợp đồng',
        department: 'SALES',
        sort_order: 1,
        tasks: [
            'Xác nhận đơn hàng (SO)',
            'Ký hợp đồng',
            'Thu đặt cọc',
        ]
    },
    {
        title: 'Thiết kế mẫu In/Thêu & Quản lý Gia công',
        department: 'DESIGN',
        sort_order: 2,
        tasks: [
            'Thiết kế mẫu in',
            'Thiết kế mẫu thêu',
            'Duyệt mẫu với khách hàng',
            'Quản lý gia công In',
            'Quản lý gia công Thêu',
        ]
    },
    {
        title: 'Lập kế hoạch SX',
        department: 'PLANNING',
        sort_order: 3,
        tasks: [
            'Chạy phân tích MRP',
            'Xác nhận phương án vật tư',
            'Tạo PO NPL & PO Gia công',
        ]
    },
    {
        title: 'Mua hàng NPL',
        department: 'PURCHASING',
        sort_order: 4,
        tasks: [
            'Đặt hàng NCC',
            'Theo dõi tiến độ giao hàng NCC',
            'Nhận hàng & Nhập kho NPL',
        ]
    },
    {
        title: 'Sản xuất & Gia công',
        department: 'PRODUCTION',
        sort_order: 5,
        tasks: [
            'Xuất NPL cho sản xuất',
            'Theo dõi tiến độ sản xuất',
            'Kiểm QC từng công đoạn',
        ]
    },
    {
        title: 'Kiểm tra & Đóng gói',
        department: 'QC',
        sort_order: 6,
        tasks: [
            'QC cuối (Final Inspection)',
            'Đóng gói thành phẩm',
            'Nhập kho Thành phẩm',
        ]
    },
    {
        title: 'Giao hàng',
        department: 'LOGISTICS',
        sort_order: 7,
        tasks: [
            'Soạn & Xuất kho',
            'Vận chuyển / Bàn giao khách',
            'Xác nhận khách nhận hàng',
        ]
    },
    {
        title: 'Thanh toán & Thanh lý',
        department: 'FINANCE',
        sort_order: 8,
        tasks: [
            'Thu thanh toán đợt cuối',
            'Đối soát công nợ',
            'Thanh lý hợp đồng',
        ]
    }
];

@Injectable()
export class SystemService {
    constructor(
        @InjectRepository(SystemConfig) private configRepo: Repository<SystemConfig>,
        @InjectRepository(ApiToken) private apiTokenRepo: Repository<ApiToken>,
        @InjectRepository(ActivityLog) private logRepo: Repository<ActivityLog>,
        @InjectRepository(ContractTemplate) private templateRepo: Repository<ContractTemplate>,
        @InjectRepository(EmailTemplate) private emailTemplateRepo: Repository<EmailTemplate>,
        private emailService: EmailService
    ) { }

    async getValue(key: string): Promise<string | null> {
        const config = await this.configRepo.findOne({ where: { key } });
        return config ? config.value : null;
    }

    async setValue(key: string, value: string, description?: string): Promise<SystemConfig> {
        let config = await this.configRepo.findOne({ where: { key } });
        if (!config) {
            config = this.configRepo.create({ key, value, description });
        } else {
            config.value = value;
            if (description) config.description = description;
        }
        return this.configRepo.save(config);
    }

    // --- SMTP CONFIG HELPER ---
    async getSmtpConfig() {
        const keys = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM_NAME', 'SMTP_FROM_EMAIL', 'SMTP_SECURE'];
        const configs = await this.configRepo.findByIds(keys);
        const result: any = {};
        keys.forEach(k => {
            const found = configs.find(c => c.key === k);
            result[k] = found ? found.value : '';
        });
        return result;
    }

    async saveSmtpConfig(data: any) {
        await this.setValue('SMTP_HOST', data.SMTP_HOST || '', 'SMTP Host Server');
        await this.setValue('SMTP_PORT', data.SMTP_PORT || '587', 'SMTP Port');
        await this.setValue('SMTP_USER', data.SMTP_USER || '', 'SMTP Username');
        await this.setValue('SMTP_PASS', data.SMTP_PASS || '', 'SMTP Password'); // Should encrypt in real app
        await this.setValue('SMTP_FROM_NAME', data.SMTP_FROM_NAME || 'ERP4U', 'Sender Name');
        await this.setValue('SMTP_FROM_EMAIL', data.SMTP_FROM_EMAIL || '', 'Sender Email');
        await this.setValue('SMTP_SECURE', String(data.SMTP_SECURE), 'Use SSL/TLS'); // 'true' or 'false'
        return { success: true };
    }

    async testSmtpConnection(email: string) {
        return this.emailService.testConnection(email);
    }

    // --- COMPANY CONFIG HELPER ---
    async getCompanyConfig() {
        const keys = ['COMPANY_NAME', 'COMPANY_ADDRESS', 'COMPANY_PHONE', 'COMPANY_EMAIL', 'COMPANY_WEBSITE',
            'COMPANY_TAX_CODE', 'COMPANY_REPRESENTATIVE',
            'COMPANY_BANK_NAME', 'COMPANY_BANK_ACCOUNT', 'COMPANY_BANK_HOLDER'];
        const configs = await this.configRepo.findByIds(keys);
        const result: any = {};
        keys.forEach(k => {
            const found = configs.find(c => c.key === k);
            result[k] = found ? found.value : '';
        });
        return result;
    }

    async saveCompanyConfig(data: any) {
        await this.setValue('COMPANY_NAME', data.COMPANY_NAME || '', 'Tên Doanh Nghiệp');
        await this.setValue('COMPANY_ADDRESS', data.COMPANY_ADDRESS || '', 'Địa chỉ');
        await this.setValue('COMPANY_PHONE', data.COMPANY_PHONE || '', 'Số điện thoại');
        await this.setValue('COMPANY_EMAIL', data.COMPANY_EMAIL || '', 'Email liên hệ');
        await this.setValue('COMPANY_WEBSITE', data.COMPANY_WEBSITE || '', 'Website');
        await this.setValue('COMPANY_TAX_CODE', data.COMPANY_TAX_CODE || '', 'Mã số thuế');
        await this.setValue('COMPANY_REPRESENTATIVE', data.COMPANY_REPRESENTATIVE || '', 'Người đại diện');
        await this.setValue('COMPANY_BANK_NAME', data.COMPANY_BANK_NAME || '', 'Tên ngân hàng');
        await this.setValue('COMPANY_BANK_ACCOUNT', data.COMPANY_BANK_ACCOUNT || '', 'Số tài khoản ngân hàng');
        await this.setValue('COMPANY_BANK_HOLDER', data.COMPANY_BANK_HOLDER || '', 'Chủ tài khoản ngân hàng');
        return { success: true };
    }

    // --- SELLER INFO FOR CONTRACT ---
    async getSellerInfo() {
        const company = await this.getCompanyConfig();
        return {
            seller_company_name: company.COMPANY_NAME || '',
            seller_address: company.COMPANY_ADDRESS || '',
            seller_phone: company.COMPANY_PHONE || '',
            seller_email: company.COMPANY_EMAIL || '',
            seller_website: company.COMPANY_WEBSITE || '',
            seller_tax_code: company.COMPANY_TAX_CODE || '',
            seller_representative: company.COMPANY_REPRESENTATIVE || '',
            seller_bank_name: company.COMPANY_BANK_NAME || '',
            seller_bank_account: company.COMPANY_BANK_ACCOUNT || '',
            seller_bank_holder: company.COMPANY_BANK_HOLDER || '',
        };
    }

    // --- EASYINVOICE CONFIG HELPER ---
    async getEasyInvoiceConfig() {
        const keys = ['EASYINVOICE_URL', 'EASYINVOICE_USERNAME', 'EASYINVOICE_PASSWORD', 'EASYINVOICE_TAX_CODE', 'EASYINVOICE_PATTERN'];
        const configs = await this.configRepo.findByIds(keys);
        const result: any = {};
        keys.forEach(k => {
            const found = configs.find(c => c.key === k);
            result[k] = found ? found.value : '';
        });
        return result;
    }

    async saveEasyInvoiceConfig(data: any) {
        await this.setValue('EASYINVOICE_URL', data.EASYINVOICE_URL || '', 'EasyInvoice API URL');
        await this.setValue('EASYINVOICE_USERNAME', data.EASYINVOICE_USERNAME || '', 'EasyInvoice Username');
        await this.setValue('EASYINVOICE_PASSWORD', data.EASYINVOICE_PASSWORD || '', 'EasyInvoice Password');
        await this.setValue('EASYINVOICE_TAX_CODE', data.EASYINVOICE_TAX_CODE || '', 'EasyInvoice Tax Code');
        await this.setValue('EASYINVOICE_PATTERN', data.EASYINVOICE_PATTERN || '', 'EasyInvoice Pattern');
        return { success: true };
    }

    // --- ACTIVITY LOGGING ---
    async logAction(module: string, action: string, description: string, userId?: number, username?: string, entityId?: string, details?: any, metadata?: any, fullName?: string) {
        const log = this.logRepo.create({
            module,
            action,
            description,
            user_id: userId,
            username: username || 'System',
            full_name: fullName || username || 'System',
            entity_id: entityId,
            details,
            metadata
        });
        return this.logRepo.save(log);
    }

    async getLogs(limit: number = 100) {
        return this.logRepo.find({
            order: { timestamp: 'DESC' },
            take: limit
        });
    }

    async getActivityLogsForEntity(module: string, entityId: string) {
        return this.logRepo.find({
            where: { module: module.toUpperCase(), entity_id: String(entityId) },
            order: { timestamp: 'DESC' }
        });
    }

    // --- API KEY MANAGEMENT ---
    async generateApiToken(name: string, permissions: string[] = []) {
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = await bcrypt.hash(rawToken, 10);
        const hint = rawToken.substring(rawToken.length - 4);

        const token = this.apiTokenRepo.create({
            name,
            token_hash: tokenHash,
            token_hint: hint,
            permissions,
            is_active: true
        });
        await this.apiTokenRepo.save(token);

        return {
            id: token.id,
            name: token.name,
            api_key: rawToken, // Only return the raw token once!
            token_hint: hint,
            permissions: token.permissions
        };
    }

    async validateApiToken(rawToken: string) {
        // Since we don't know which token it is from the raw string alone without a prefix/id,
        // we'd normally have to check all hashes, which is slow.
        // A better approach is to require the API Key in the format: "id:rawToken" or standard "sk_..."
        // For simplicity and since there are few bots, we check active tokens.
        // But to be scalable, let's assume the client passes the token as is. 
        // We will fetch all active tokens and compare. (OK for < 10 bots)
        const activeTokens = await this.apiTokenRepo.find({ where: { is_active: true } });
        
        for (const token of activeTokens) {
            const isMatch = await bcrypt.compare(rawToken, token.token_hash);
            if (isMatch) {
                // Update last used asynchronously
                this.apiTokenRepo.update(token.id, { last_used_at: new Date() }).catch(console.error);
                return token;
            }
        }
        return null;
    }

    async listApiTokens() {
        return this.apiTokenRepo.find({ 
            select: ['id', 'name', 'token_hint', 'permissions', 'last_used_at', 'created_at', 'is_active'],
            order: { created_at: 'DESC' } 
        });
    }

    async revokeApiToken(id: number) {
        await this.apiTokenRepo.update(id, { is_active: false });
        return { success: true };
    }



    // --- CONTRACT TEMPLATES ---
    async getTemplates() {
        return this.templateRepo.find({ order: { updated_at: 'DESC' } });
    }

    async saveTemplate(data: any) {
        // Create or Update
        if (data.id) {
            await this.templateRepo.update(data.id, data);
            return this.templateRepo.findOne({ where: { id: data.id } });
        } else {
            const t = this.templateRepo.create(data);
            return this.templateRepo.save(t);
        }
    }

    async deleteTemplate(id: number) {
        return this.templateRepo.delete(id);
    }

    // --- EMAIL TEMPLATES ---
    async getEmailTemplates() {
        return this.emailTemplateRepo.find({ order: { updated_at: 'DESC' } });
    }

    async saveEmailTemplate(data: any) {
        if (data.id) {
            await this.emailTemplateRepo.update(data.id, data);
            return this.emailTemplateRepo.findOne({ where: { id: data.id } });
        } else {
            const t = this.emailTemplateRepo.create(data);
            return this.emailTemplateRepo.save(t);
        }
    }

    async deleteEmailTemplate(id: number) {
        return this.emailTemplateRepo.delete(id);
    }

    // --- HOME PAGE CONFIG ---
    async getHomeConfig() {
        // Fetch all configs related to Home Page
        const keys = [
            'hero_title_1', 'hero_title_2', 'hero_description', 'hero_button_1', 'hero_button_2', 'hero_image', 'hero_mask_opacity',
            'video_enabled', 'video_title', 'video_subtitle', 'video_youtube_url',
            'products_title', 'products_subtitle', 'products_limit',
            'cta_enabled', 'cta_title', 'cta_description', 'cta_button',
            'HOME_FEATURES', 'hero_images', 'projects_banners', // JSON string
            // Topbar
            'topbar_enabled', 'topbar_left_text', 'topbar_right_text', 'topbar_right_url', 'topbar_speed',
            // About
            'about_title', 'about_description',
            // Footer strings
            'footer_slogan', 'footer_copyright', 'footer_bg', 'footer_text_color',
            // Blog selection
            'blog_selection_type',
        ];

        // JSON array keys
        const jsonArrayKeys = [
            'HOME_USP_ITEMS', 'HOME_WHY_CHOOSE_REASONS', 'HOME_WHY_CHOOSE_GUARANTEES',
            'HOME_CATEGORIES', 'HOME_MILESTONES', 'HOME_PARTNERS',
            'HOME_TESTIMONIALS', 'HOME_FEATURED_PROJECTS',
            'HOME_FOOTER_QUICK_LINKS', 'HOME_FOOTER_PRODUCT_LINKS',
            'HOME_SELECTED_BLOG_IDS', 'HOME_SELECTED_PROJECT_IDS',
            // Journey block ordering (reasons / guarantees / journey)
            'HOME_JOURNEY_BLOCK_ORDER',
        ];

        const allKeys = [...keys, ...jsonArrayKeys];

        const configs = await this.configRepo.find();
        const result: any = {};

        // Initialize defaults
        keys.forEach(k => result[k] = '');
        result['video_enabled'] = 'false'; // Default to hidden for safety
        result['cta_enabled'] = 'true';
        result['products_limit'] = '4';
        result['blog_selection_type'] = 'auto'; // Default to auto

        configs.forEach(c => {
            if (allKeys.includes(c.key)) {
                result[c.key] = c.value;
            }
        });

        // Parse features if exists
        try {
            if (result['HOME_FEATURES']) {
                result['features'] = JSON.parse(result['HOME_FEATURES']);
            }
        } catch (e) {
            result['features'] = [];
        }

        // Parse hero_images if exists
        try {
            if (result['hero_images']) {
                result['hero_images'] = JSON.parse(result['hero_images']);
            } else {
                result['hero_images'] = [];
            }
        } catch (e) {
            result['hero_images'] = [];
        }
        
        // Parse projects_banners if exists
        try {
            if (result['projects_banners']) {
                result['projects_banners'] = JSON.parse(result['projects_banners']);
            } else {
                result['projects_banners'] = [];
            }
        } catch (e) {
            result['projects_banners'] = [];
        }

        // Parse all JSON array keys
        const jsonMapping: Record<string, string> = {
            'HOME_USP_ITEMS': 'usp_items',
            'HOME_WHY_CHOOSE_REASONS': 'why_choose_reasons',
            'HOME_WHY_CHOOSE_GUARANTEES': 'why_choose_guarantees',
            'HOME_CATEGORIES': 'categories',
            'HOME_MILESTONES': 'milestones',
            'HOME_PARTNERS': 'partners',
            'HOME_TESTIMONIALS': 'testimonials',
            'HOME_FEATURED_PROJECTS': 'featured_projects',
            'HOME_FOOTER_QUICK_LINKS': 'footer_quick_links',
            'HOME_FOOTER_PRODUCT_LINKS': 'footer_product_links',
            'HOME_SELECTED_BLOG_IDS': 'selected_blog_ids',
            'HOME_SELECTED_PROJECT_IDS': 'selected_project_ids',
            'HOME_JOURNEY_BLOCK_ORDER': 'journey_blocks_order',
        };
        for (const [dbKey, frontendKey] of Object.entries(jsonMapping)) {
            try {
                result[frontendKey] = result[dbKey] ? JSON.parse(result[dbKey]) : [];
            } catch {
                result[frontendKey] = [];
            }
            delete result[dbKey]; // cleanup DB keys from response
        }

        // Convert booleans/numbers
        result['video_enabled'] = result['video_enabled'] === 'true';
        result['cta_enabled'] = result['cta_enabled'] === 'true';
        result['products_limit'] = Number(result['products_limit']) || 4;
        result['topbar_enabled'] = result['topbar_enabled'] === 'true';
        result['topbar_speed'] = Number(result['topbar_speed']) || 20;
        result['hero_mask_opacity'] = Number(result['hero_mask_opacity']) || 40;

        return result;
    }

    async saveHomeConfig(data: any) {
        const keys = [
            'hero_title_1', 'hero_title_2', 'hero_description', 'hero_button_1', 'hero_button_2', 'hero_image',
            'video_title', 'video_subtitle', 'video_youtube_url',
            'products_title', 'products_subtitle',
            'cta_title', 'cta_description', 'cta_button',
            // Topbar string fields
            'topbar_left_text', 'topbar_right_text', 'topbar_right_url',
            // About
            'about_title', 'about_description',
            // Footer strings
            'footer_slogan', 'footer_copyright', 'footer_bg', 'footer_text_color',
            // Blog selection
            'blog_selection_type',
        ];

        // Save simple string keys
        for (const key of keys) {
            if (data[key] !== undefined) {
                await this.setValue(key, String(data[key]), 'Home Page Config');
            }
        }

        // Save Booleans/Numbers
        console.log('[System] Saving Home Config:', JSON.stringify(data).substring(0, 500));
        if (data.video_enabled !== undefined) await this.setValue('video_enabled', String(data.video_enabled), 'Home Page Config');
        if (data.cta_enabled !== undefined) await this.setValue('cta_enabled', String(data.cta_enabled), 'Home Page Config');
        if (data.products_limit !== undefined) await this.setValue('products_limit', String(data.products_limit), 'Home Page Config');
        if (data.topbar_enabled !== undefined) await this.setValue('topbar_enabled', String(data.topbar_enabled), 'Home Page Topbar');
        if (data.topbar_speed !== undefined) await this.setValue('topbar_speed', String(data.topbar_speed), 'Home Page Topbar Speed');
        if (data.hero_mask_opacity !== undefined) await this.setValue('hero_mask_opacity', String(data.hero_mask_opacity), 'Home Page Hero Mask Opacity');

        // Save Features as JSON
        if (data.features) {
            await this.setValue('HOME_FEATURES', JSON.stringify(data.features), 'Home Page Features List');
        }

        // Save Hero Images as JSON
        if (data.hero_images) {
            await this.setValue('hero_images', JSON.stringify(data.hero_images), 'Home Page Hero Slideshow');
        }

        // Save Projects Banners as JSON
        if (data.projects_banners) {
            await this.setValue('projects_banners', JSON.stringify(data.projects_banners), 'Home Page Projects Banners');
        }

        // Save all content JSON arrays
        const jsonMapping: Record<string, string> = {
            'usp_items': 'HOME_USP_ITEMS',
            'why_choose_reasons': 'HOME_WHY_CHOOSE_REASONS',
            'why_choose_guarantees': 'HOME_WHY_CHOOSE_GUARANTEES',
            'categories': 'HOME_CATEGORIES',
            'milestones': 'HOME_MILESTONES',
            'partners': 'HOME_PARTNERS',
            'testimonials': 'HOME_TESTIMONIALS',
            'featured_projects': 'HOME_FEATURED_PROJECTS',
            'footer_quick_links': 'HOME_FOOTER_QUICK_LINKS',
            'footer_product_links': 'HOME_FOOTER_PRODUCT_LINKS',
            'selected_blog_ids': 'HOME_SELECTED_BLOG_IDS',
            'selected_project_ids': 'HOME_SELECTED_PROJECT_IDS',
            'journey_blocks_order': 'HOME_JOURNEY_BLOCK_ORDER',
        };
        for (const [frontendKey, dbKey] of Object.entries(jsonMapping)) {
            if (data[frontendKey] !== undefined) {
                await this.setValue(dbKey, JSON.stringify(data[frontendKey]), `Home Page ${frontendKey}`);
            }
        }

        return { success: true };
    }

    // --- ABOUT ERP4U PAGE CONFIG ---
    async getAboutConfig() {
        const keys = [
            'ABOUT_hero_title', 'ABOUT_hero_description', 'ABOUT_hero_image',
            'ABOUT_story_title', 'ABOUT_story_content',
            'ABOUT_vision_title', 'ABOUT_vision_description',
            'ABOUT_mission_title', 'ABOUT_mission_description',
            'ABOUT_cta_title', 'ABOUT_cta_description', 'ABOUT_cta_button_text', 'ABOUT_cta_button_url',
        ];
        const jsonArrayKeys = [
            'ABOUT_STATS', 'ABOUT_TEAM_MEMBERS', 'ABOUT_VALUES', 'ABOUT_PAGE_BLOCKS',
        ];
        const allKeys = [...keys, ...jsonArrayKeys];

        const configs = await this.configRepo.find();
        const result: any = {};

        keys.forEach(k => result[k] = '');
        configs.forEach(c => {
            if (allKeys.includes(c.key)) {
                result[c.key] = c.value;
            }
        });

        // Map to frontend-friendly keys
        const mappedResult: any = {};
        keys.forEach(k => {
            const shortKey = k.replace('ABOUT_', '');
            mappedResult[shortKey] = result[k] || '';
        });

        // Parse JSON arrays
        const jsonMapping: Record<string, string> = {
            'ABOUT_STATS': 'stats',
            'ABOUT_TEAM_MEMBERS': 'team_members',
            'ABOUT_VALUES': 'values',
            'ABOUT_PAGE_BLOCKS': 'about_page_blocks',
        };
        for (const [dbKey, frontendKey] of Object.entries(jsonMapping)) {
            try {
                mappedResult[frontendKey] = result[dbKey] ? JSON.parse(result[dbKey]) : [];
            } catch {
                mappedResult[frontendKey] = [];
            }
        }

        return mappedResult;
    }

    async saveAboutConfig(data: any) {
        const keys = [
            'hero_title', 'hero_description', 'hero_image',
            'story_title', 'story_content',
            'vision_title', 'vision_description',
            'mission_title', 'mission_description',
            'cta_title', 'cta_description', 'cta_button_text', 'cta_button_url',
        ];

        for (const key of keys) {
            if (data[key] !== undefined) {
                await this.setValue(`ABOUT_${key}`, String(data[key]), 'About ERP4U Page Config');
            }
        }

        // Save JSON arrays
        const jsonMapping: Record<string, string> = {
            'stats': 'ABOUT_STATS',
            'team_members': 'ABOUT_TEAM_MEMBERS',
            'values': 'ABOUT_VALUES',
            'about_page_blocks': 'ABOUT_PAGE_BLOCKS',
        };
        for (const [frontendKey, dbKey] of Object.entries(jsonMapping)) {
            if (data[frontendKey] !== undefined) {
                await this.setValue(dbKey, JSON.stringify(data[frontendKey]), `About ERP4U ${frontendKey}`);
            }
        }

        return { success: true };
    }

    // --- SO PROJECT TEMPLATE ---
    async getSOProjectTemplate() {
        const config = await this.configRepo.findOne({ where: { key: 'SO_PROJECT_TEMPLATE' } });
        if (config && config.value) {
            try {
                return JSON.parse(config.value);
            } catch (e) {
                return DEFAULT_SO_PROJECT_TEMPLATE;
            }
        }
        return DEFAULT_SO_PROJECT_TEMPLATE;
    }

    async saveSOProjectTemplate(data: any) {
        await this.setValue('SO_PROJECT_TEMPLATE', JSON.stringify(data), 'Template dự án tự động tạo từ Sales Order');
        return { success: true };
    }
}
