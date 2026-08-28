import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);

    constructor(
        private configService: ConfigService,
        private dataSource: DataSource
    ) {}

    private async getSmtpConfig() {
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

    private async createTransporter() {
        const dbConfig = await this.getSmtpConfig();
        
        // Fallback to .env if DB is empty for host
        const host = dbConfig['SMTP_HOST'] || this.configService.get<string>('SMTP_HOST');
        const port = Number(dbConfig['SMTP_PORT']) || this.configService.get<number>('SMTP_PORT');
        const user = dbConfig['SMTP_USER'] || this.configService.get<string>('SMTP_USER');
        const pass = dbConfig['SMTP_PASS'] || this.configService.get<string>('SMTP_PASS');
        const secureStr = dbConfig['SMTP_SECURE'];
        
        let secure = port === 465;
        if (secureStr === 'true') secure = true;
        if (secureStr === 'false') secure = false;

        if (host && port && user && pass) {
            return nodemailer.createTransport({
                host,
                port,
                secure,
                auth: { user, pass },
            });
        }
        
        return null;
    }

    async testConnection(to: string): Promise<{ success: boolean; message: string }> {
        const dbConfig = await this.getSmtpConfig();
        let fromEmail = dbConfig['SMTP_FROM_EMAIL'] || this.configService.get<string>('SMTP_FROM') || 'noreply@erp4u.com';
        let fromName = dbConfig['SMTP_FROM_NAME'] || 'ERP4U';
        const from = `"${fromName}" <${fromEmail}>`;
        
        const transporter = await this.createTransporter();
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
        const dbConfig = await this.getSmtpConfig();
        
        let fromEmail = fromOverride || dbConfig['SMTP_FROM_EMAIL'] || this.configService.get<string>('SMTP_FROM') || 'noreply@erp4u.com';
        let fromName = dbConfig['SMTP_FROM_NAME'] || 'ERP4U';
        const from = `"${fromName}" <${fromEmail}>`;
        
        const transporter = await this.createTransporter();

        if (!transporter) {
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
