import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { SystemService } from './system.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/permissions.decorator';

@Controller('system')
export class SystemController {
    constructor(private readonly s: SystemService) { }

    @Get('smtp')
    getSmtpConfig() {
        return this.s.getSmtpConfig();
    }

    @Post('smtp')
    saveSmtpConfig(@Body() body: any) {
        return this.s.saveSmtpConfig(body);
    }

    @Post('smtp/test')
    testSmtp(@Body() body: { email: string }) {
        return this.s.testSmtpConnection(body.email);
    }

    @Get('company')
    getCompanyConfig() {
        return this.s.getCompanyConfig();
    }

    @Post('company')
    saveCompanyConfig(@Body() body: any) {
        return this.s.saveCompanyConfig(body);
    }

    @Get('seller-info')
    getSellerInfo() {
        return this.s.getSellerInfo();
    }

    // --- EASYINVOICE CONFIG ---
    @Get('easyinvoice')
    getEasyInvoiceConfig() {
        return this.s.getEasyInvoiceConfig();
    }

    @Post('easyinvoice')
    saveEasyInvoiceConfig(@Body() body: any) {
        return this.s.saveEasyInvoiceConfig(body);
    }

    @UseGuards(JwtAuthGuard, PermissionsGuard)
    @RequirePermission('USERS', 'can_view')
    @Get('logs')
    getLogs() {
        return this.s.getLogs();
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

    @Get('config/:key')
    async getConfig(@Param('key') key: string) {
        const val = await this.s.getValue(key);
        return { key, value: val };
    }

    @Post('config')
    saveConfig(@Body() body: { key: string; value: string; description?: string }) {
        return this.s.setValue(body.key, body.value, body.description);
    }

    // --- CONTRACT TEMPLATES ---
    @Get('templates')
    getTemplates() { return this.s.getTemplates(); }

    @Post('templates')
    saveTemplate(@Body() body: any) { return this.s.saveTemplate(body); }

    @Delete('templates/:id')
    deleteTemplate(@Param('id') id: number) { return this.s.deleteTemplate(id); }

    // --- EMAIL TEMPLATES ---
    @Get('email-templates')
    getEmailTemplates() { return this.s.getEmailTemplates(); }

    @Post('email-templates')
    saveEmailTemplate(@Body() body: any) { return this.s.saveEmailTemplate(body); }

    @Delete('email-templates/:id')
    deleteEmailTemplate(@Param('id') id: number) { return this.s.deleteEmailTemplate(id); }

    // --- HOME PAGE CONFIG ---
    @Get('home-config')
    getHomeConfig() { return this.s.getHomeConfig(); }

    @Post('home-config')
    saveHomeConfig(@Body() body: any) { return this.s.saveHomeConfig(body); }

    // --- ABOUT ERP4U PAGE CONFIG ---
    @Get('about-config')
    getAboutConfig() { return this.s.getAboutConfig(); }

    @Post('about-config')
    saveAboutConfig(@Body() body: any) { return this.s.saveAboutConfig(body); }

    // --- SO PROJECT TEMPLATE ---
    @Get('so-project-template')
    getSOProjectTemplate() { return this.s.getSOProjectTemplate(); }

    @Post('so-project-template')
    saveSOProjectTemplate(@Body() body: any) { return this.s.saveSOProjectTemplate(body); }
}
