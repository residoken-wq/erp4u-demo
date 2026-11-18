import { Public } from '../auth/public.decorator';
import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { SystemService } from './system.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission, Perm, AuthOnly } from '../auth/permissions.decorator';

@Controller('system')
export class SystemController {
    constructor(private readonly s: SystemService) { }

    @Perm('SYSTEM', 'view')
    @Get('smtp')
    getSmtpConfig() {
        return this.s.getSmtpConfig();
    }

    @Perm('SYSTEM', 'create')
    @Post('smtp')
    saveSmtpConfig(@Body() body: any) {
        return this.s.saveSmtpConfig(body);
    }

    @Perm('SYSTEM', 'create')
    @Post('smtp/test')
    testSmtp(@Body() body: { email: string }) {
        return this.s.testSmtpConnection(body.email);
    }

    @Public()
    @Get('company')
    getCompanyConfig() {
        return this.s.getCompanyConfig();
    }

    @Perm('SYSTEM', 'create')
    @Post('company')
    saveCompanyConfig(@Body() body: any) {
        return this.s.saveCompanyConfig(body);
    }

    @AuthOnly()
    @Get('seller-info')
    getSellerInfo() {
        return this.s.getSellerInfo();
    }

    // --- EASYINVOICE CONFIG ---
    @Perm('SYSTEM', 'view')
    @Get('easyinvoice')
    getEasyInvoiceConfig() {
        return this.s.getEasyInvoiceConfig();
    }

    @Perm('SYSTEM', 'create')
    @Post('easyinvoice')
    saveEasyInvoiceConfig(@Body() body: any) {
        return this.s.saveEasyInvoiceConfig(body);
    }

    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @RequirePermission('USERS', 'can_view')
    @Get('logs')
    getLogs(@Query('limit') limit?: string) {
        const parsedLimit = limit ? Math.min(Math.max(parseInt(limit, 10) || 5, 1), 100) : 100;
        return this.s.getLogs(parsedLimit);
    }

    // --- API TOKENS ---
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @RequirePermission('USERS', 'can_view')
    @Get('api-tokens')
    getApiTokens() {
        return this.s.listApiTokens();
    }

    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @RequirePermission('USERS', 'can_create')
    @Post('api-tokens')
    createApiToken(@Body() body: { name: string; permissions: string[] }) {
        return this.s.generateApiToken(body.name, body.permissions);
    }

    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @RequirePermission('USERS', 'can_delete')
    @Delete('api-tokens/:id')
    revokeApiToken(@Param('id') id: number) {
        return this.s.revokeApiToken(id);
    }

    @Public()
    @Get('config/:key')
    async getConfig(@Param('key') key: string) {
        const val = await this.s.getValue(key);
        return { key, value: val };
    }

    @Perm('SYSTEM', 'update')
    @Post('config')
    saveConfig(@Body() body: { key: string; value: string; description?: string }) {
        return this.s.setValue(body.key, body.value, body.description);
    }

    // --- CONTRACT TEMPLATES ---
    @AuthOnly()
    @Get('templates')
    getTemplates() { return this.s.getTemplates(); }

    @Perm('SYSTEM', 'create')
    @Post('templates')
    saveTemplate(@Body() body: any) { return this.s.saveTemplate(body); }

    @Perm('SYSTEM', 'delete')
    @Delete('templates/:id')
    deleteTemplate(@Param('id') id: number) { return this.s.deleteTemplate(id); }

    // --- EMAIL TEMPLATES ---
    @AuthOnly()
    @Get('email-templates')
    getEmailTemplates() { return this.s.getEmailTemplates(); }

    @Perm('SYSTEM', 'create')
    @Post('email-templates')
    saveEmailTemplate(@Body() body: any) { return this.s.saveEmailTemplate(body); }

    @Perm('SYSTEM', 'delete')
    @Delete('email-templates/:id')
    deleteEmailTemplate(@Param('id') id: number) { return this.s.deleteEmailTemplate(id); }

    // --- HOME PAGE CONFIG ---
    @Perm('CMS', 'view')
    @Get('home-config')
    getHomeConfig() { return this.s.getHomeConfig(); }

    @Perm('CMS', 'create')
    @Post('home-config')
    saveHomeConfig(@Body() body: any) { return this.s.saveHomeConfig(body); }

    // --- ABOUT ERP4U PAGE CONFIG ---
    @Perm('CMS', 'view')
    @Get('about-config')
    getAboutConfig() { return this.s.getAboutConfig(); }

    @Perm('CMS', 'create')
    @Post('about-config')
    saveAboutConfig(@Body() body: any) { return this.s.saveAboutConfig(body); }

    // --- SO PROJECT TEMPLATE ---
    @AuthOnly()
    @Get('so-project-template')
    getSOProjectTemplate() { return this.s.getSOProjectTemplate(); }

    @Perm('SYSTEM', 'create')
    @Post('so-project-template')
    saveSOProjectTemplate(@Body() body: any) { return this.s.saveSOProjectTemplate(body); }
}
