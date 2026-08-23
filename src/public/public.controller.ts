import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpException, HttpStatus, Headers, Req, Res } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Response } from 'express';
import { Product } from '../products/product.entity';
import { Category } from '../categories/category.entity';
import { Customer, CustomerType } from '../customers/customer.entity';
import { BlogPost, BlogStatus } from '../blogs/blog-post.entity';
import { SystemConfig } from '../system/system-config.entity';
import { SalesService } from '../sales/sales.service';
import { ProductWebsiteConfig } from '../products/entities/product-website-config.entity';
import { SystemService } from '../system/system.service';
import { WebsitePolicy } from './entities/website-policy.entity';
import { WizardConfig, WizardConfigData } from './entities/wizard-config.entity';
import { WebProject } from '../website-projects/entities/web-project.entity';
import { HrService } from '../hr/hr.service';
import { JobPostStatus } from '../hr/entities/job-post.entity';
import { DesignsService } from '../designs/designs.service';

@Controller('public')
export class PublicController {
    constructor(
        @InjectRepository(Product)
        private readonly productRepo: Repository<Product>,
        @InjectRepository(ProductWebsiteConfig)
        private readonly websiteConfigRepo: Repository<ProductWebsiteConfig>,
        @InjectRepository(Category)
        private readonly categoryRepo: Repository<Category>,
        @InjectRepository(Customer)
        private readonly customerRepo: Repository<Customer>,
        @InjectRepository(BlogPost)
        private readonly blogRepo: Repository<BlogPost>,
        @InjectRepository(SystemConfig)
        private readonly configRepo: Repository<SystemConfig>,
        @InjectRepository(WebsitePolicy)
        private readonly policyRepo: Repository<WebsitePolicy>,
        @InjectRepository(WizardConfig)
        private readonly wizardConfigRepo: Repository<WizardConfig>,
        @InjectRepository(WebProject)
        private readonly websiteProjectRepo: Repository<WebProject>,
        private readonly salesService: SalesService,
        private readonly systemService: SystemService,
        private readonly hrService: HrService,
        private readonly designsService: DesignsService
    ) { }

    // ... (settings code)

    // ========================================
    // PUBLIC CONFIG APIs
    // ========================================

    @Get('home-config')
    async getHomeConfig() {
        return this.systemService.getHomeConfig();
    }

    @Get('about-config')
    async getAboutConfig() {
        return this.systemService.getAboutConfig();
    }

    @Get('settings')
    async getSettings(
        @Headers('origin') origin?: string,
        @Headers('referer') referer?: string,
        @Headers('x-forwarded-host') xForwardedHost?: string
    ) {
        // Fetch settings from CMS config keys (lowercase format from Website CMS)
        const cmsKeys = [
            'site_name', 'site_description', 'logo_url', 'favicon_url', 'contact_phone', 'contact_email', 'contact_address',
            'facebook_url', 'zalo_url', 'google_maps_url', 'facebook_page_url',
            'facebook', 'instagram', 'tiktok', 'youtube', 'linkedin', 'pinterest',
            // Page Banners
            'banner_shop_title', 'banner_shop_desc', 'banner_shop_image',
            'banner_projects_title', 'banner_projects_desc', 'banner_projects_image',
            'banner_b2b_title', 'banner_b2b_desc', 'banner_b2b_image',
            'banner_contact_title', 'banner_contact_desc', 'banner_contact_image',
            'banner_news_title', 'banner_news_desc', 'banner_news_image',
            'banner_recruitment_title', 'banner_recruitment_desc', 'banner_recruitment_image',
            // Section background colors
            'section_hero_bg', 'section_hero_usp_bg',
            'section_categories_bg', 'section_about_bg', 'section_journey_bg',
            'section_projects_bg', 'section_partners_bg', 'section_testimonials_bg', 'section_blog_bg',
            // Section text colors
            'section_hero_text', 'section_hero_usp_text',
            'section_categories_text', 'section_about_text', 'section_journey_text',
            'section_projects_text', 'section_partners_text', 'section_testimonials_text', 'section_blog_text',
            // Missing configurations
            'product_tags_config', 'hidden_pages'
        ];
        const configs = await this.configRepo.find({
            where: { key: In(cmsKeys) }
        });

        const result: any = {};
        cmsKeys.forEach(key => {
            const found = configs.find(c => c.key === key);
            let val = found ? found.value : '';
            // HOTFIX: recovery for accidentally saved JSON objects for banner images
            if (val && val.startsWith('{') && val.includes('"url":')) {
                try {
                    const parsed = JSON.parse(val);
                    if (parsed.url) val = parsed.url;
                } catch (e) {}
            } else if (val === '[object Object]') {
                val = '';
            }
            result[key] = val;
        });

        const isBeta = 
            (origin && origin.includes('localhost:5173')) || 
            (referer && referer.includes('localhost:5173')) || 
            (xForwardedHost && xForwardedHost.includes('localhost:5173'));

        // Return public system settings formatted for website
        return {
            site_name: result.site_name || 'Nệm Mầm Non ERP4U',
            site_description: result.site_description || '',
            logo_url: result.logo_url || '',
            favicon_url: result.favicon_url || '',
            contact_phone: result.contact_phone || '',
            contact_email: result.contact_email || '',
            contact_address: result.contact_address || '',
            facebook_url: result.facebook_url || '',
            zalo_url: result.zalo_url || '',
            google_maps_url: result.google_maps_url || '',
            facebook_page_url: result.facebook_page_url || '',
            facebook: result.facebook || '',
            instagram: result.instagram || '',
            tiktok: result.tiktok || '',
            youtube: result.youtube || '',
            linkedin: result.linkedin || '',
            pinterest: result.pinterest || '',
            // Options
            product_tags_config: result.product_tags_config || '',
            hidden_pages: isBeta ? '' : (result.hidden_pages || ''),
            // Page Banners
            banner_shop_title: result.banner_shop_title || '',
            banner_shop_desc: result.banner_shop_desc || '',
            banner_shop_image: result.banner_shop_image || '',
            banner_projects_title: result.banner_projects_title || '',
            banner_projects_desc: result.banner_projects_desc || '',
            banner_projects_image: result.banner_projects_image || '',
            banner_b2b_title: result.banner_b2b_title || '',
            banner_b2b_desc: result.banner_b2b_desc || '',
            banner_b2b_image: result.banner_b2b_image || '',
            banner_contact_title: result.banner_contact_title || '',
            banner_contact_desc: result.banner_contact_desc || '',
            banner_contact_image: result.banner_contact_image || '',
            banner_news_title: result.banner_news_title || '',
            banner_news_desc: result.banner_news_desc || '',
            banner_news_image: result.banner_news_image || '',
            banner_recruitment_title: result.banner_recruitment_title || '',
            banner_recruitment_desc: result.banner_recruitment_desc || '',
            banner_recruitment_image: result.banner_recruitment_image || '',
            // Section background colors
            section_hero_bg: result.section_hero_bg || '',
            section_hero_usp_bg: result.section_hero_usp_bg || '',
            section_categories_bg: result.section_categories_bg || '',
            section_about_bg: result.section_about_bg || '',
            section_journey_bg: result.section_journey_bg || '',
            section_projects_bg: result.section_projects_bg || '',
            section_partners_bg: result.section_partners_bg || '',
            section_testimonials_bg: result.section_testimonials_bg || '',
            section_blog_bg: result.section_blog_bg || '',
            // Section text colors
            section_hero_text: result.section_hero_text || '',
            section_hero_usp_text: result.section_hero_usp_text || '',
            section_categories_text: result.section_categories_text || '',
            section_about_text: result.section_about_text || '',
            section_journey_text: result.section_journey_text || '',
            section_projects_text: result.section_projects_text || '',
            section_partners_text: result.section_partners_text || '',
            section_testimonials_text: result.section_testimonials_text || '',
            section_blog_text: result.section_blog_text || '',
            // Legacy fields for backward compatibility
            title: result.site_name || 'ERP4U',
            logo: result.logo_url || '/logo.png',
        };
    }

    // ... (settings code)

    @Get('products/:sku')
    async getProductBySku(@Param('sku') sku: string) {
        const product = await this.productRepo.findOne({
            where: { sku, is_active: true, show_on_website: true }
        });

        if (!product) {
            return { error: 'Product not found' };
        }

        // Fetch website config
        const config = await this.websiteConfigRepo.findOne({
            where: { product_id: product.id }
        });

        const displayPrice = Number(product.website_price) || Number(product.base_price);
        const salePrice = Number(product.website_sale_price) || 0;

        return {
            id: product.id,
            sku: product.sku,
            name: product.website_display_name || product.name,
            category: product.category,
            base_price: salePrice > 0 ? salePrice : displayPrice,
            original_price: salePrice > 0 ? displayPrice : undefined,
            sale_price: salePrice > 0 ? salePrice : undefined,
            image_url: product.image_url,
            customer_description: product.customer_description,
            attributes: product.attributes,
            customization_config: config?.customization_config || null,
            seo_meta: product.seo_meta // SEO RankMath
        };
    }

    // ========================================
    // CATEGORIES APIs
    // ========================================

    @Get('categories')
    async getCategories() {
        // Only return categories that have at least one product visible on website
        const categoriesWithProducts = await this.categoryRepo
            .createQueryBuilder('c')
            .innerJoin('c.products', 'p', 'p.is_active = :active AND p.show_on_website = :show', {
                active: true,
                show: true
            })
            .orderBy('c.name', 'ASC')
            .getMany();

        return categoriesWithProducts.map(c => ({
            id: c.id,
            code: c.code,
            name: c.name
        }));
    }

    // ========================================
    // BLOGS APIs
    // ========================================

    @Get('blogs')
    async getBlogs(@Query('limit') limit?: number) {
        const query = this.blogRepo.createQueryBuilder('b')
            .where('b.status = :status', { status: BlogStatus.PUBLISHED })
            .andWhere('b.is_hidden = :hidden', { hidden: false })
            .orderBy('b.published_at', 'DESC');

        if (limit && !isNaN(Number(limit))) {
            query.take(Number(limit));
        }

        const blogs = await query.getMany();
        return blogs.map(b => ({
            id: b.id,
            slug: b.slug,
            title: b.title,
            excerpt: b.excerpt,
            featured_image: b.featured_image,
            category: b.category,
            published_at: b.published_at,
            view_count: b.view_count
        }));
    }

    @Get('blogs/:slug')
    async getBlogBySlug(@Param('slug') slug: string) {
        const blog = await this.blogRepo.findOne({
            where: { slug, status: BlogStatus.PUBLISHED, is_hidden: false },
            relations: ['author']
        });

        if (!blog) {
            return { error: 'Blog not found' };
        }

        // Increment view count
        await this.blogRepo.increment({ id: blog.id }, 'view_count', 1);

        return {
            id: blog.id,
            slug: blog.slug,
            title: blog.title,
            excerpt: blog.excerpt,
            content: blog.content,
            content_blocks: blog.content_blocks,
            featured_image: blog.featured_image,
            category: blog.category,
            published_at: blog.published_at,
            meta_title: blog.meta_title,
            meta_description: blog.meta_description,
            tags: blog.tags,
            author: blog.author ? { id: blog.author.id, username: blog.author.username } : null,
            view_count: blog.view_count,
            // SEO RankMath
            focus_keyword: blog.focus_keyword,
            seo_score: blog.seo_score,
            seo_meta: blog.seo_meta
        };
    }

    // ========================================
    // LEADS APIs (Form đăng ký sỉ)
    // ========================================

    @Post('leads')
    async createLead(@Body() body: {
        company_name: string;
        contact_person: string;
        phone: string;
        email?: string;
        address?: string;
        expected_quantity?: string;
        notes?: string;
    }) {
        // Generate unique code for lead
        const count = await this.customerRepo.count({ where: { type: CustomerType.LEAD } });
        const code = `LEAD-${String(count + 1).padStart(5, '0')}`;

        const lead = this.customerRepo.create({
            code,
            name: body.company_name,
            phone: body.phone,
            email: body.email,
            address: body.address,
            type: CustomerType.LEAD,
            lead_status: 'NEW',
            history: [{
                action: 'CREATED_FROM_WEBSITE',
                timestamp: new Date(),
                data: {
                    contact_person: body.contact_person,
                    expected_quantity: body.expected_quantity,
                    notes: body.notes
                }
            }]
        });

        await this.customerRepo.save(lead);

        return {
            success: true,
            message: 'Đăng ký thành công! Chúng tôi sẽ liên hệ bạn sớm.',
            lead_code: code
        };
    }

    // ========================================
    // ORDERS APIs (ShopCart checkout)
    // ========================================

    @Post('orders')
    async createOrder(@Body() body: {
        customer_name: string;
        customer_phone: string;
        customer_email?: string;
        delivery_address: string;
        items: Array<{
            sku: string;
            quantity: number;
            unit_price: number;
        }>;
        notes?: string;
        payment_method?: string;
    }) {
        // Create order via SalesService
        // Build formatted note with full buyer info
        const noteLines = [
            '📦 ĐƠN HÀNG TỪ WEBSITE',
            '─────────────────────────',
            `👤 Tên người mua: ${body.customer_name}`,
            `📞 Số điện thoại: ${body.customer_phone}`,
        ];

        if (body.customer_email) {
            noteLines.push(`📧 Email: ${body.customer_email}`);
        }

        noteLines.push(`📍 Địa chỉ giao hàng: ${body.delivery_address}`);
        noteLines.push(`💳 Phương thức thanh toán: ${body.payment_method === 'BANK_TRANSFER' ? 'Chuyển khoản' : 'COD (Thanh toán khi nhận hàng)'}`);

        if (body.notes) {
            noteLines.push(`📝 Ghi chú: ${body.notes}`);
        }

        const formattedNote = noteLines.join('\n');

        const orderData = {
            // Customer info
            customer_name: body.customer_name,

            // Delivery info - map to correct fields
            receiver_name: body.customer_name,    // Recipient is same as customer
            receiver_phone: body.customer_phone,
            shipping_address: body.delivery_address,

            // Items and formatted note
            items: body.items,
            note: formattedNote,

            // Mark as website order
            order_source: 'WEBSITE'
        };

        try {
            const order = await this.salesService.createOrder(orderData);
            return {
                success: true,
                message: 'Đặt hàng thành công!',
                order_code: order.order_code
            };
        } catch (error) {
            return {
                success: false,
                message: 'Có lỗi xảy ra, vui lòng thử lại.',
                error: error.message
            };
        }
    }
    // ========================================
    // PUBLIC CONFIG APIs
    // ========================================



    // ========================================
    // PRODUCTS APIs (Public)
    // ========================================

    @Get('products')
    async getProducts(
        @Query('page') page = 1,
        @Query('limit') limit = 12,
        @Query('sort') sort = 'newest', // newest, price_asc, price_desc
        @Query('category') categoryId?: number,
        @Query('tags') tags?: string | string[]
    ) {
        const parsedPage = isNaN(Number(page)) || Number(page) < 1 ? 1 : Number(page);
        const parsedLimit = isNaN(Number(limit)) || Number(limit) < 1 ? 12 : Number(limit);

        const qb = this.productRepo.createQueryBuilder('p')
            .leftJoinAndSelect('p.category_link', 'cat')
            .where('p.is_active = :isActive', { isActive: true })
            .andWhere('p.show_on_website = :show', { show: true });

        if (categoryId && !isNaN(Number(categoryId))) {
            qb.andWhere('p.category_id = :catId', { catId: Number(categoryId) });
        }

        if (tags) {
            const tagArray = Array.isArray(tags) ? tags : [tags];
            tagArray.forEach((tag, index) => {
                // Postgres ? operator checks if top-level JSON array contains the scalar value
                qb.andWhere(`p.tags ? :tag${index}`, { [`tag${index}`]: tag });
            });
        }

        qb.addSelect('COALESCE(NULLIF(p.website_price, 0), p.base_price)', 'sort_price');

        // Sorting
        switch (sort) {
            case 'price_asc':
                // Use website_price if available and > 0, else base_price
                qb.orderBy('sort_price', 'ASC', 'NULLS LAST');
                break;
            case 'price_desc':
                qb.orderBy('sort_price', 'DESC', 'NULLS LAST');
                break;
            case 'newest':
            default:
                qb.orderBy('p.id', 'DESC');
                break;
        }

        const [items, total] = await qb
            .skip((parsedPage - 1) * parsedLimit)
            .take(parsedLimit)
            .getManyAndCount();

        return {
            data: items.map(p => {
                const displayPrice = Number(p.website_price) || Number(p.base_price) || 0;
                const salePrice = Number(p.website_sale_price) || 0;
                return {
                    id: p.id,
                    sku: p.sku,
                    name: p.name,
                    website_display_name: p.website_display_name,
                    image_url: p.image_url,
                    price: salePrice > 0 ? salePrice : displayPrice,
                    original_price: salePrice > 0 ? displayPrice : undefined,
                    sale_price: salePrice > 0 ? salePrice : undefined,
                    category: p.category_link?.name || 'Uncategorized',
                    slug: p.sku
                };
            }),
            meta: {
                total,
                page: parsedPage,
                last_page: Math.ceil(total / parsedLimit)
            }
        };
    }

    // ========================================
    // POLICIES APIs
    // ========================================

    @Get('policies')
    async getPolicies() {
        // Return all active policies (for website sidebar/footer)
        const policies = await this.policyRepo.find({
            where: { is_active: true },
            order: { display_order: 'ASC' }
        });

        // If no policies exist, seed default ones
        if (policies.length === 0) {
            const defaultPolicies = [
                { slug: 'bao-hanh', title: 'Chính sách bảo hành', display_order: 1, icon: '🛡️' },
                { slug: 'doi-tra', title: 'Chính sách đổi trả', display_order: 2, icon: '↩️' },
                { slug: 'bao-mat', title: 'Chính sách bảo mật', display_order: 3, icon: '🔒' },
                { slug: 'van-chuyen', title: 'Vận chuyển & giao nhận', display_order: 4, icon: '🚚' },
                { slug: 'thanh-toan', title: 'Phương thức thanh toán', display_order: 5, icon: '💳' },
            ];

            for (const policy of defaultPolicies) {
                await this.policyRepo.save({
                    ...policy,
                    content: `<p>Nội dung ${policy.title} đang được cập nhật...</p>`,
                    is_active: true,
                });
            }

            return this.policyRepo.find({
                where: { is_active: true },
                order: { display_order: 'ASC' }
            });
        }

        return policies;
    }

    @Get('policies/:slug')
    async getPolicy(@Param('slug') slug: string) {
        const policy = await this.policyRepo.findOne({
            where: { slug, is_active: true }
        });

        if (!policy) {
            return { error: 'Policy not found' };
        }

        return policy;
    }

    @Put('policies/:slug')
    async updatePolicy(@Param('slug') slug: string, @Body() data: any) {
        // Upsert policy
        const existing = await this.policyRepo.findOne({ where: { slug } });

        if (existing) {
            await this.policyRepo.update({ slug }, {
                title: data.title || existing.title,
                content: data.content || existing.content,
                icon: data.icon || existing.icon,
                is_active: data.is_active !== undefined ? data.is_active : existing.is_active,
                display_order: data.display_order !== undefined ? data.display_order : existing.display_order,
            });
        } else {
            await this.policyRepo.save({
                slug,
                title: data.title || slug,
                content: data.content || '',
                icon: data.icon || '',
                is_active: data.is_active !== undefined ? data.is_active : true,
                display_order: data.display_order || 0,
            });
        }

        return { success: true, message: 'Policy updated successfully' };
    }

    // ========================================
    // WIZARD CUSTOMIZATION APIs
    // ========================================

    @Get('wizard/config')
    async getWizardConfig() {
        try {
            const config = await this.wizardConfigRepo.findOne({ where: { key: 'wizard_products' } });
            if (!config) {
                // Return default empty config v2
                return {
                    hero_title: 'Tự Thiết Kế Bộ Sản Phẩm Mầm Non Cao Cấp',
                    categories: []
                };
            }
            return config.value;
        } catch (error) {
            // Table may not exist yet, return empty config v2
            console.error('Wizard config error:', error);
            return {
                hero_title: 'Tự Thiết Kế Bộ Sản Phẩm Mầm Non Cao Cấp',
                categories: []
            };
        }
    }

    @Put('wizard/config')
    async updateWizardConfig(@Body() data: WizardConfigData) {
        try {
            const existing = await this.wizardConfigRepo.findOne({ where: { key: 'wizard_products' } });
            if (existing) {
                existing.value = data;
                await this.wizardConfigRepo.save(existing);
            } else {
                await this.wizardConfigRepo.save({
                    key: 'wizard_products',
                    value: data
                });
            }
            return { success: true, message: 'Wizard config updated' };
        } catch (error) {
            console.error('Lỗi khi lưu Web Project liên hệ:', error);
            throw new HttpException('Lỗi server', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // ========================================
    // RECRUITMENT PUBLIC APIs
    // ========================================

    @Get('recruitment/jobs')
    async getPublicJobs() {
        // Return only published & show_on_website jobs
        const allJobs = await this.hrService.findAllJobs();
        return allJobs.filter(job => job.status === JobPostStatus.PUBLISHED && job.show_on_website);
    }

    @Get('recruitment/jobs/:slug')
    async getJobBySlug(@Param('slug') slug: string) {
        const job = await this.hrService.findJobBySlug(slug);
        if (!job || job.status !== JobPostStatus.PUBLISHED || !job.show_on_website) {
            throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
        }
        return job;
    }

    @Post('recruitment/apply')
    async applyJob(@Body() data: any) {
        // data contains job_post_id, name, email, phone, cv_url, etc.
        const candidate = await this.hrService.createCandidate(data);
        
        // TODO: Send email to candidate with portal_token here if SMTP is configured
        
        return {
            success: true,
            message: 'Application submitted',
            token: candidate.portal_token
        };
    }

    @Get('recruitment/portal/:token')
    async getCandidatePortal(@Param('token') token: string) {
        const candidate = await this.hrService.getCandidateByToken(token);
        if (!candidate) throw new HttpException('Invalid or expired application link', HttpStatus.NOT_FOUND);

        const assessment = await this.hrService.getAssessmentByCandidate(candidate.id);
        const interviews = await this.hrService.findInterviews(candidate.id);

        return {
            candidate,
            job_post: candidate.job_post,
            assessment,
            interviews
        };
    }

    @Post('recruitment/portal/:token/submit-assessment')
    async submitPortalAssessment(@Param('token') token: string, @Body() body: any) {
        return this.hrService.submitAssessment(token, body.answers);
    }

    @Post('wizard/submit')
    async submitWizardLead(@Body() body: {
        customer_name: string;
        company_name?: string;
        phone: string;
        email?: string;
        address?: string;
        notes?: string;
        selected_category: string;
        selected_subcategory: string;
        quantity: number;
        selections: Array<{ step_label: string; option_name: string; modifier?: number }>;
        total_price: number;
        render_image?: string; // base64 image
    }) {
        // Build product summary for notes
        const selectionsSummary = body.selections.map(s =>
            `- ${s.step_label}: ${s.option_name} ${s.modifier ? `(+${s.modifier.toLocaleString('vi-VN')}đ)` : ''}`
        ).join('\n');

        const fullNotes = `
=== ĐƠN HÀNG SỈ TỪ WIZARD V2 ===

Danh mục: ${body.selected_category}
Sản phẩm: ${body.selected_subcategory}
Số lượng: ${body.quantity} bộ

Cấu hình chi tiết:
${selectionsSummary}

Tổng tạm tính: ${body.total_price.toLocaleString('vi-VN')}đ

Ghi chú khách hàng: ${body.notes || 'Không có'}
${body.render_image ? '\n[Có hình render đính kèm]' : ''}
        `.trim();

        // Generate unique code for lead
        const count = await this.customerRepo.count({ where: { type: CustomerType.LEAD } });
        const code = `LEAD-${String(count + 1).padStart(5, '0')}`;

        const lead = this.customerRepo.create({
            code,
            name: body.company_name || body.customer_name,
            phone: body.phone,
            email: body.email,
            address: body.address,
            type: CustomerType.LEAD,
            lead_status: 'NEW',
            history: [{
                action: 'CREATED_FROM_WIZARD',
                timestamp: new Date(),
                data: {
                    contact_person: body.customer_name,
                    selected_category: body.selected_category,
                    selected_subcategory: body.selected_subcategory,
                    quantity: body.quantity,
                    selections: body.selections,
                    total_price: body.total_price,
                    notes: fullNotes,
                    has_render_image: !!body.render_image
                }
            }]
        });

        await this.customerRepo.save(lead);

        return {
            success: true,
            message: 'Lead created successfully',
            lead_code: code
        };
    }

    // ========================================
    // WEBSITE PROJECTS APIs (Portfolio/Showcase)
    // ========================================

    @Get('projects')
    async getWebsiteProjects() {
        const projects = await this.websiteProjectRepo.find({
            where: { status: 'PUBLISHED' as any, is_hidden: false },
            order: { sort_order: 'ASC', created_at: 'DESC' }
        });
        return { data: projects };
    }

    @Get('projects/:slug')
    async getWebsiteProject(@Param('slug') slug: string) {
        const project = await this.websiteProjectRepo.findOne({
            where: { slug, status: 'PUBLISHED' as any, is_hidden: false }
        });
        if (!project) {
            return { error: 'Project not found' };
        }
        return project;
    }

    @Post('projects')
    async createWebsiteProject(@Body() body: any) {
        const project = this.websiteProjectRepo.create(body);
        return this.websiteProjectRepo.save(project);
    }

    @Put('projects/:id')
    async updateWebsiteProject(@Param('id') id: number, @Body() body: any) {
        await this.websiteProjectRepo.update(id, body);
        return this.websiteProjectRepo.findOne({ where: { id } });
    }

    @Delete('projects/:id')
    async deleteWebsiteProject(@Param('id') id: number) {
        await this.websiteProjectRepo.delete(id);
        return { success: true };
    }

    // ========================================
    // PORTAL QUOTE APIs (Public - No JWT required)
    // Cho phép khách hàng truy cập báo giá qua UUID link
    // ========================================

    @Get('portal/quote/:uuid')
    async getPortalQuote(@Param('uuid') uuid: string, @Req() req: any) {
        let quote: any = await this.salesService.getQuoteByUuid(uuid);
        
        let isDesignOrder = false;
        if (!quote) {
            // Check if it's a design order
            quote = await this.designsService.getDesignOrderByUuid(uuid);
            if (!quote) return null;
            isDesignOrder = true;
            
            // Format design order to match quote structure roughly for portal
            quote.order_code = quote.code;
            quote.order_date = quote.created_at;
            quote.customer = { name: quote.school_name };
            quote.customer_name = quote.school_name;
            quote.type = 'DESIGN_ORDER';
            quote.items = quote.items || [];
            if (quote.items.length === 0) {
                 quote.items = [{
                     sku: 'DESIGN-' + quote.code,
                     product: { name: quote.product_type },
                     product_name_real: quote.product_type,
                     unit_price: 0,
                     quantity: quote.quantity,
                     subtotal: 0,
                     image_url: quote.preview_images?.[0] || null
                 }];
            }
        }
        
        // --- ATTACH EMPLOYEE PHONE TO ASSIGNED_TO ---
        if (quote.assigned_to?.id) {
            try {
                const employee = await this.hrService.findEmployeeByUserId(quote.assigned_to.id);
                if (employee && employee.phone) {
                    (quote.assigned_to as any).phone = employee.phone;
                }
            } catch (e) {
                // Ignore if HR module fails
            }
        }
        
        // --- LOG VIEW PORTAL ---
        const ip = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || '';
        const ua = req.headers['user-agent'] || '';
        let device = 'Desktop';
        if (/mobile/i.test(ua)) device = 'Mobile';
        if (/tablet/i.test(ua)) device = 'Tablet';
        
        let browser = 'Unknown';
        if (/chrome|crios|crmo/i.test(ua)) browser = 'Chrome';
        else if (/firefox|iceweasel|fxios/i.test(ua)) browser = 'Firefox';
        else if (/safari/i.test(ua)) browser = 'Safari';
        else if (/msie|trident/i.test(ua)) browser = 'IE';
        else if (/edg/i.test(ua)) browser = 'Edge';

        const newLog = { ip, device, browser, user_agent: ua, viewed_at: new Date() };
        const currentLogs = quote.portal_view_logs || [];
        const lastLog = currentLogs[currentLogs.length - 1];
        const isRecentDuplicate = lastLog && lastLog.ip === ip && (new Date().getTime() - new Date(lastLog.viewed_at).getTime() < 5 * 60 * 1000);
        
        if (!isRecentDuplicate) {
            const updatedLogs = [...currentLogs, newLog].slice(-50); // Keep last 50 views
            await this.salesService.updateViewLogs(quote.id, updatedLogs);
            quote.portal_view_logs = updatedLogs; // return updated logs to frontend
        }
        
        const watermarkConfig = await this.configRepo.findOne({ where: { key: 'PORTAL_WATERMARK_IMAGE' } });
        const bannerConfig = await this.configRepo.findOne({ where: { key: 'PRINT_HEADER_BANNER' } });
        const stampConfig = await this.configRepo.findOne({ where: { key: 'COMPANY_STAMP_IMAGE' } });
        const colorConfig = await this.configRepo.findOne({ where: { key: 'PRINT_PRIMARY_COLOR' } });
        const footerConfig = await this.configRepo.findOne({ where: { key: 'PRINT_CUSTOM_NOTE_FOOTER' } });
        const printOptionsConfig = await this.configRepo.findOne({ where: { key: 'PORTAL_PRINT_OPTIONS' } });
        
        let printOptions = {};
        if (printOptionsConfig?.value) {
            try { printOptions = JSON.parse(printOptionsConfig.value); } catch (e) { }
        }

        const companyInfo = await this.systemService.getCompanyConfig();
        
        return {
            ...quote,
            is_design_order: isDesignOrder,
            company_info: companyInfo,
            watermark_image: watermarkConfig?.value || '',
            print_header_banner: bannerConfig?.value || '',
            company_stamp_image: stampConfig?.value || '',
            print_primary_color: colorConfig?.value || '#0050b3',
            print_footer_note: footerConfig?.value || '',
            print_options: printOptions,
        };
    }

    @Post('portal/quote/:uuid/action')
    async portalQuoteAction(@Param('uuid') uuid: string, @Body() body: any, @Req() req: any) {
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        const userAgent = req.headers['user-agent'];
        const metadata = { ip, userAgent };

        // Check if design order
        const designOrder = await this.designsService.getDesignOrderByUuid(uuid);
        if (designOrder) {
             if (body.action === 'ACCEPT') {
                 return this.designsService.updateDesignOrderStatus(designOrder.id, 'DEMO_APPROVED');
             } else if (body.action === 'REJECT') {
                 return this.designsService.updateDesignOrderStatus(designOrder.id, 'DEMO_REJECTED');
             }
        }
        
        return this.salesService.customerAction(uuid, body.action, metadata);
    }

    @Post('portal/quote/:orderId/comment')
    portalAddComment(@Param('orderId') orderId: number, @Body() body: any) {
        return this.salesService.addComment(
            Number(orderId),
            body.content,
            body.sender,
            body.name,
            body.comment_type,
            body.mentioned_user_ids
        );
    }

    @Delete('portal/quote/comment/:commentId')
    portalDeleteComment(@Param('commentId') commentId: number, @Body() body: any) {
        return this.salesService.softDeleteComment(Number(commentId), body?.deletedBy || 'Khách hàng');
    }

    @Get('proxy-image')
    async proxyImage(@Query('url') url: string, @Res() res: Response) {
        if (!url) return res.status(400).send('Missing url');
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Fetch failed');
            res.set('Content-Type', response.headers.get('content-type') || 'image/jpeg');
            res.set('Access-Control-Allow-Origin', '*');
            const arrayBuffer = await response.arrayBuffer();
            res.send(Buffer.from(arrayBuffer));
        } catch (e) {
            res.status(400).send('Error loading image');
        }
    }
}
