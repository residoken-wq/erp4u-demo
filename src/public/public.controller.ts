import { Public } from '../auth/public.decorator';
import { AuthOnly } from '../auth/permissions.decorator';
import { Controller, Get, Post, Delete, Body, Param, Query, HttpException, HttpStatus, Req, Res, Inject, Optional, Logger, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Response } from 'express';
import { SystemConfig } from '../system/system-config.entity';
import { SalesService } from '../sales/sales.service';
import { SystemService } from '../system/system.service';
import { HrService } from '../hr/hr.service';
import { JobPostStatus } from '../hr/entities/job-post.entity';
import { DESIGN_ORDER_HOOKS, DesignOrderHooks } from '../common/extension-points';
import { DemoModeService } from '../common/services/demo-mode.service';
import { RequiresPackage } from '../common/packages/requires-package.decorator';
import { PackageKey } from '../common/packages/package.registry';
import { handleProxyImage } from '../common/security/proxy-image.util';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RateLimit, RateLimitGuard } from '../common/security/rate-limit';

@Controller('public')
export class PublicController {
    private readonly logger = new Logger(PublicController.name);

    constructor(
        @InjectRepository(SystemConfig)
        private readonly configRepo: Repository<SystemConfig>,
        private readonly salesService: SalesService,
        private readonly systemService: SystemService,
        private readonly hrService: HrService,
        @Optional() @Inject(DESIGN_ORDER_HOOKS)
        private readonly designsService: DesignOrderHooks | undefined,
        private readonly demoModeService: DemoModeService,
    ) {
    }

    @Public()
    @Get('meta')
    async getMeta() {
        return {
            demo: this.demoModeService.isDemoMode(),
            version: '1.0.0',
        };
    }

    // ========================================
    // RECRUITMENT PUBLIC APIs
    // ========================================

    @Public()
    @RequiresPackage(PackageKey.HR)
    @Get('recruitment/jobs')
    async getPublicJobs() {
        // Return only published & show_on_website jobs
        const allJobs = await this.hrService.findAllJobs();
        return allJobs.filter(job => job.status === JobPostStatus.PUBLISHED && job.show_on_website);
    }

    @Public()
    @RequiresPackage(PackageKey.HR)
    @Get('recruitment/jobs/:slug')
    async getJobBySlug(@Param('slug') slug: string) {
        const job = await this.hrService.findJobBySlug(slug);
        if (!job || job.status !== JobPostStatus.PUBLISHED || !job.show_on_website) {
            throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
        }
        return job;
    }

    @Public()
    @RequiresPackage(PackageKey.HR)
    @UseGuards(RateLimitGuard)
    @RateLimit({
        prefix: 'recruitment:ip',
        maxGetter: (s) => s.getRecruitmentIpMax(),
        windowMsGetter: (s) => s.getRecruitmentIpWindowMs(),
    })
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

    @Public()
    @RequiresPackage(PackageKey.HR)
    @UseGuards(RateLimitGuard)
    @RateLimit({
        prefix: 'recruitment:ip',
        maxGetter: (s) => s.getRecruitmentIpMax(),
        windowMsGetter: (s) => s.getRecruitmentIpWindowMs(),
    })
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

    @Public()
    @RequiresPackage(PackageKey.HR)
    @UseGuards(RateLimitGuard)
    @RateLimit({
        prefix: 'recruitment:ip',
        maxGetter: (s) => s.getRecruitmentIpMax(),
        windowMsGetter: (s) => s.getRecruitmentIpWindowMs(),
    })
    @Post('recruitment/portal/:token/submit-assessment')
    async submitPortalAssessment(@Param('token') token: string, @Body() body: any) {
        return this.hrService.submitAssessment(token, body.answers);
    }

    // ========================================
    // PORTAL QUOTE APIs (Public - No JWT required)
    // Cho phép khách hàng truy cập báo giá qua UUID link
    // ========================================

    @Public()
    @RequiresPackage(PackageKey.SALES)
    @Get('portal/quote/:uuid')
    async getPortalQuote(@Param('uuid') uuid: string, @Req() req: any) {
        let quote: any = await this.salesService.getQuoteByUuid(uuid);

        let isDesignOrder = false;
        if (!quote) {
            if (!this.designsService) return null;
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

        // --- SANITIZE ASSIGNED_TO FOR PORTAL ({ id, full_name, phone, email } only) ---
        if (isDesignOrder && !quote.assigned_to) {
            quote.assigned_to = quote.sales_order?.assigned_to || quote.designer;
        }

        if (quote.assigned_to?.id) {
            let phone: string | null = (quote.assigned_to as any).phone || null;
            let email: string | null = (quote.assigned_to as any).email || null;
            try {
                const employee = await this.hrService.findEmployeeByUserId(quote.assigned_to.id);
                if (employee) {
                    if (employee.phone) phone = employee.phone;
                    if (employee.user?.email) email = employee.user.email;
                }
            } catch (e) {
                // Ignore if HR module fails
            }
            quote.assigned_to = {
                id: quote.assigned_to.id,
                full_name: quote.assigned_to.full_name,
                phone: phone || null,
                email: email || null,
            };
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

    @Public()
    @RequiresPackage(PackageKey.SALES)
    @Post('portal/quote/:uuid/action')
    async portalQuoteAction(@Param('uuid') uuid: string, @Body() body: any, @Req() req: any) {
        const ip = req.headers['x-forwarded-for'] || req.connection?.remoteAddress;
        const userAgent = req.headers['user-agent'];
        const metadata = { ip, userAgent };

        // Check if design order
        if (this.designsService) {
            const designOrder = await this.designsService.getDesignOrderByUuid(uuid);
            if (designOrder) {
                 if (body.action === 'ACCEPT') {
                     return this.designsService.updateDesignOrderStatus(designOrder.id, 'DEMO_APPROVED');
                 } else if (body.action === 'REJECT') {
                     return this.designsService.updateDesignOrderStatus(designOrder.id, 'DEMO_REJECTED');
                 }
            }
        }

        return this.salesService.customerAction(uuid, body.action, metadata);
    }

    @Public()
    @RequiresPackage(PackageKey.SALES)
    @Post('portal/quote/:uuid/comment')
    portalAddComment(@Param('uuid') uuid: string, @Body() body: any) {
        return this.salesService.portalAddComment(uuid, body);
    }

    @Public()
    @RequiresPackage(PackageKey.SALES)
    @Delete('portal/quote/:uuid/comment/:commentId')
    portalDeleteComment(@Param('uuid') uuid: string, @Param('commentId') commentId: number) {
        return this.salesService.portalDeleteComment(uuid, Number(commentId));
    }

    // Route proxy-image trong PublicController có JwtAuthGuard bảo vệ chống SSRF abuse từ bên ngoài, chỉ người dùng đã xác thực mới được gọi
    @AuthOnly()
    @UseGuards(JwtAuthGuard)
    @Get('proxy-image')
    async proxyImage(@Query('url') url: string, @Res() res: Response) {
        return handleProxyImage(url, res);
    }
}
