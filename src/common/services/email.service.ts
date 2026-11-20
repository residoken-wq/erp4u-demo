import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import * as nodemailer from 'nodemailer';
import { DemoModeService } from './demo-mode.service';
import { TenantConfigService } from '../tenancy/tenant-config.service';
import { DEFAULT_TENANT_CONTEXT, TenantContext } from '../tenancy/tenant-context';

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);

    constructor(
        private configService: ConfigService,
        private dataSource: DataSource,
        private readonly demoModeService: DemoModeService,
        @Optional() private readonly tenantConfigService?: TenantConfigService,
    ) {
    }

    async getResolvedSmtpConfig(): Promise<{
        host?: string;
        port?: number;
        user?: string;
        pass?: string;
        fromName: string;
        fromEmail: string;
        secure: boolean;
    }> {
        let host: string | undefined;
        let portRaw: string | undefined;
        let user: string | undefined;
        let pass: string | undefined;
        let fromName: string | undefined;
        let fromEmail: string | undefined;
        let secureStr: string | undefined;

        if (this.tenantConfigService) {
            const cfg = await this.tenantConfigService.getMany(
                [
                    'SMTP_HOST',
                    'SMTP_PORT',
                    'SMTP_USER',
                    'SMTP_PASS',
                    'SMTP_FROM_NAME',
                    'SMTP_FROM_EMAIL',
                    'SMTP_SECURE',
                ],
                {
                    envKeyMap: {
                        SMTP_FROM_EMAIL: ['SMTP_FROM_EMAIL', 'SMTP_FROM'],
                    },
                },
            );
            host = cfg['SMTP_HOST'];
            portRaw = cfg['SMTP_PORT'];
            user = cfg['SMTP_USER'];
            pass = cfg['SMTP_PASS'];
            fromName = cfg['SMTP_FROM_NAME'];
            fromEmail = cfg['SMTP_FROM_EMAIL'];
            secureStr = cfg['SMTP_SECURE'];
        } else {
            const dbConfig = await this.getLegacyDbSmtpConfig();
            const isDefaultTenant =
                TenantContext.current().tenantId === DEFAULT_TENANT_CONTEXT.tenantId;
            host =
                dbConfig['SMTP_HOST'] ||
                (isDefaultTenant ? this.configService.get<string>('SMTP_HOST') : undefined);
            portRaw =
                dbConfig['SMTP_PORT'] ||
                (isDefaultTenant
                    ? String(this.configService.get<number>('SMTP_PORT') || '')
                    : undefined);
            user =
                dbConfig['SMTP_USER'] ||
                (isDefaultTenant ? this.configService.get<string>('SMTP_USER') : undefined);
            pass =
                dbConfig['SMTP_PASS'] ||
                (isDefaultTenant ? this.configService.get<string>('SMTP_PASS') : undefined);
            fromName = dbConfig['SMTP_FROM_NAME'];
            fromEmail =
                dbConfig['SMTP_FROM_EMAIL'] ||
                (isDefaultTenant ? this.configService.get<string>('SMTP_FROM') : undefined);
            secureStr = dbConfig['SMTP_SECURE'];
        }

        const port = portRaw ? Number(portRaw) : undefined;
        let secure = port === 465;
        if (secureStr === 'true') secure = true;
        if (secureStr === 'false') secure = false;

        return {
            host,
            port: Number.isFinite(port) && (port as number) > 0 ? port : undefined,
            user,
            pass,
            fromName: fromName || 'ERP4U',
            fromEmail: fromEmail || 'noreply@example.com',
            secure,
        };
    }

    private async getLegacyDbSmtpConfig(): Promise<Record<string, string>> {
        try {
            const configs = await this.dataSource.query(`
                SELECT key, value FROM system_configs 
                WHERE key IN ('SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM_NAME', 'SMTP_FROM_EMAIL', 'SMTP_SECURE')
            `);
            const result: Record<string, string> = {};
            configs.forEach((c: any) => result[c.key] = c.value);
            return result;
        } catch (e) {
            this.logger.error('Failed to get SMTP config from database', e);
            return {};
        }
    }

    private async createTransporter(resolved?: Awaited<ReturnType<EmailService['getResolvedSmtpConfig']>>) {
        const cfg = resolved ?? (await this.getResolvedSmtpConfig());

        if (cfg.host && cfg.port && cfg.user && cfg.pass) {
            return nodemailer.createTransport({
                host: cfg.host,
                port: cfg.port,
                secure: cfg.secure,
                auth: { user: cfg.user, pass: cfg.pass },
            });
        }

        return null;
    }

    async testConnection(to: string): Promise<{ success: boolean; message: string }> {
        if (this.demoModeService.guard('EMAIL', '[REDACTED]')) {
            return { success: true, message: '[DEMO_MODE] Đã giả lập gửi email test thành công!' };
        }
        const cfg = await this.getResolvedSmtpConfig();
        const from = `"${cfg.fromName}" <${cfg.fromEmail}>`;

        const transporter = await this.createTransporter(cfg);
        if (!transporter) {
            return { success: false, message: 'Cấu hình SMTP chưa đầy đủ hoặc bị lỗi.' };
        }

        try {
            await transporter.verify();
            await transporter.sendMail({
                from,
                to,
                subject: 'ERP4U - Test Cấu Hình SMTP',
                html: '<p>Xin chào,</p><p>Đây là email kiểm tra cấu hình SMTP từ hệ thống ERP4U.</p><p>Nếu bạn nhận được email này, cấu hình SMTP của bạn đã hoạt động chính xác!</p>',
            });
            return { success: true, message: 'Gửi email test thành công!' };
        } catch (error: any) {
            return { success: false, message: error.message || 'Lỗi gửi email' };
        }
    }

    async sendMail(to: string, subject: string, html: string, attachments?: any[], cc?: string, fromOverride?: string): Promise<boolean> {
        if (this.demoModeService.guard('EMAIL', '[REDACTED]')) {
            return true;
        }
        const cfg = await this.getResolvedSmtpConfig();
        const fromEmail = fromOverride || cfg.fromEmail;
        const from = `"${cfg.fromName}" <${fromEmail}>`;

        const transporter = await this.createTransporter(cfg);

        if (!transporter) {
            if (process.env.NODE_ENV === 'production') {
                this.logger.error('Cannot send email: SMTP not configured in production');
                return false;
            }
            this.logger.debug(`[MOCK EMAIL to ${to}] Subject: ${subject}`);
            this.logger.debug(`Content:\n${html}`);
            return true;
        }

        try {
            const mailOptions: any = {
                from,
                to,
                subject,
                html,
                attachments
            };

            if (cc) {
                mailOptions.cc = cc;
            }

            const info = await transporter.sendMail(mailOptions);
            this.logger.log(`Email sent to ${to}: ${info.messageId}`);
            return true;
        } catch (error: any) {
            this.logger.error(`Failed to send email to ${to}: ${error.message}`, error.stack);
            return false;
        }
    }
}
