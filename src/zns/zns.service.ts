import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';
import * as dayjs from 'dayjs';
import { ZaloApiConfig } from './entities/zalo-api-config.entity';
import { ZnsMessageLog } from './entities/zns-message-log.entity';
import { SalesOrder } from '../sales/sales-order.entity';
import { SalesDelivery } from '../sales/sales-delivery.entity';

@Injectable()
export class ZaloZnsService {
  private readonly logger = new Logger(ZaloZnsService.name);

  constructor(
    @InjectRepository(ZaloApiConfig)
    private readonly configRepo: Repository<ZaloApiConfig>,
    @InjectRepository(ZnsMessageLog)
    private readonly logRepo: Repository<ZnsMessageLog>,
    @InjectRepository(SalesOrder)
    private readonly orderRepo: Repository<SalesOrder>,
    @InjectRepository(SalesDelivery)
    private readonly deliveryRepo: Repository<SalesDelivery>,
  ) {}

  // ==========================================
  // 1. CẤU HÌNH & XÁC THỰC OAUTH 2.0
  // ==========================================

  async getConfig(): Promise<ZaloApiConfig> {
    let cfg = await this.configRepo.findOne({ where: { id: 1 } });
    if (!cfg) {
      cfg = this.configRepo.create({
        id: 1,
        app_id: process.env.ZALO_APP_ID || '',
        secret_key: process.env.ZALO_APP_SECRET || '',
        oa_id: process.env.ZALO_OA_ID || '',
        access_token: process.env.ZALO_ACCESS_TOKEN || '',
        refresh_token: process.env.ZALO_REFRESH_TOKEN || '',
        order_confirm_template_id: '632184',
        delivery_notice_template_id: '',
        auto_send_on_order_confirm: false,
        auto_send_on_delivery_shipped: false,
        portal_base_url: 'https://localhost:3000',
        is_active: true,
      });
      await this.configRepo.save(cfg);
    }
    return cfg;
  }

  async saveConfig(data: Partial<ZaloApiConfig>): Promise<ZaloApiConfig> {
    const cfg = await this.getConfig();
    if (data.app_id !== undefined) cfg.app_id = data.app_id ? data.app_id.trim() : '';
    if (data.secret_key !== undefined) cfg.secret_key = data.secret_key ? data.secret_key.trim() : '';
    if (data.oa_id !== undefined) cfg.oa_id = data.oa_id ? data.oa_id.trim() : '';
    if (data.access_token !== undefined) cfg.access_token = data.access_token ? data.access_token.trim() : '';
    if (data.refresh_token !== undefined) cfg.refresh_token = data.refresh_token ? data.refresh_token.trim() : '';
    if (data.order_confirm_template_id !== undefined) cfg.order_confirm_template_id = data.order_confirm_template_id?.trim() || '632184';
    if (data.delivery_notice_template_id !== undefined) cfg.delivery_notice_template_id = data.delivery_notice_template_id?.trim() || '';
    if (data.auto_send_on_order_confirm !== undefined) cfg.auto_send_on_order_confirm = Boolean(data.auto_send_on_order_confirm);
    if (data.auto_send_on_delivery_shipped !== undefined) cfg.auto_send_on_delivery_shipped = Boolean(data.auto_send_on_delivery_shipped);
    if (data.portal_base_url !== undefined) cfg.portal_base_url = data.portal_base_url?.trim() || 'https://localhost:3000';
    if (data.is_active !== undefined) cfg.is_active = Boolean(data.is_active);

    // If new access_token provided manually, default expires to now + 24h
    if (data.access_token && !cfg.access_token_expires_at) {
      cfg.access_token_expires_at = new Date(Date.now() + 24 * 3600 * 1000);
    }
    if (data.refresh_token && !cfg.refresh_token_expires_at) {
      cfg.refresh_token_expires_at = new Date(Date.now() + 90 * 24 * 3600 * 1000);
    }

    return this.configRepo.save(cfg);
  }

  /**
   * Gọi API Zalo để đổi refresh_token lấy cặp access_token & refresh_token mới
   */
  async refreshAccessToken(): Promise<{ success: boolean; message: string; config?: ZaloApiConfig }> {
    const cfg = await this.getConfig();
    if (!cfg.app_id || !cfg.secret_key || !cfg.refresh_token) {
      throw new BadRequestException('Chưa cấu hình đủ App ID, Secret Key hoặc Refresh Token để làm mới Token Zalo');
    }

    this.logger.log(`[Zalo ZNS] Đang làm mới Token qua endpoint Zalo OAuth 2.0...`);

    try {
      const params = new URLSearchParams();
      params.append('refresh_token', cfg.refresh_token);
      params.append('app_id', cfg.app_id);
      params.append('grant_type', 'refresh_token');

      const response = await axios.post('https://oauth.zaloapp.com/v4/oa/access_token', params.toString(), {
        headers: {
          'secret_key': cfg.secret_key,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000,
      });

      const resData = response.data;
      if (resData.error) {
        const errMsg = resData.message || resData.error_description || `Lỗi mã ${resData.error}`;
        this.logger.error(`[Zalo ZNS] Refresh token thất bại: ${errMsg}`);
        throw new BadRequestException(`Zalo từ chối làm mới Token: ${errMsg}`);
      }

      if (!resData.access_token) {
        throw new BadRequestException('Zalo phản hồi thành công nhưng không có access_token');
      }

      const expiresInSeconds = Number(resData.expires_in) || 90000;
      cfg.access_token = resData.access_token;
      if (resData.refresh_token) {
        cfg.refresh_token = resData.refresh_token;
      }
      cfg.expires_in = expiresInSeconds;
      // Trừ hao 5 phút để refresh trước khi thực sự hết hạn
      cfg.access_token_expires_at = new Date(Date.now() + (expiresInSeconds - 300) * 1000);
      cfg.refresh_token_expires_at = new Date(Date.now() + 90 * 24 * 3600 * 1000); // 3 tháng

      const saved = await this.configRepo.save(cfg);
      this.logger.log(`[Zalo ZNS] Làm mới Token thành công. Hạn mới đến: ${cfg.access_token_expires_at.toISOString()}`);
      return { success: true, message: 'Đã làm mới Token thành công!', config: saved };
    } catch (error: any) {
      this.logger.error(`[Zalo ZNS] Lỗi kết nối khi refresh token: ${error.message}`);
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(`Không thể kết nối đến máy chủ Zalo OAuth: ${error.message}`);
    }
  }

  /**
   * Lấy token hợp lệ. Nếu sắp hết hạn trong 30 phút, tự động làm mới.
   */
  async getValidAccessToken(): Promise<string> {
    const cfg = await this.getConfig();
    if (!cfg.access_token) {
      throw new BadRequestException('Chưa có Access Token Zalo. Vui lòng cấu hình trong Cài Đặt Hệ Thống.');
    }

    const now = new Date();
    const isExpiredOrClose = cfg.access_token_expires_at && (new Date(cfg.access_token_expires_at).getTime() - now.getTime()) < 30 * 60 * 1000;

    if (isExpiredOrClose && cfg.refresh_token) {
      this.logger.log(`[Zalo ZNS] Token sắp hết hạn, tự động làm mới trước khi gửi tin...`);
      try {
        const refreshRes = await this.refreshAccessToken();
        if (refreshRes.config?.access_token) {
          return refreshRes.config.access_token;
        }
      } catch (e: any) {
        this.logger.warn(`[Zalo ZNS] Tự động refresh token thất bại, thử dùng token hiện tại: ${e.message}`);
      }
    }

    return cfg.access_token;
  }

  /**
   * Cron Job chạy mỗi 4 giờ kiểm tra và làm mới token nếu hạn còn dưới 8 tiếng
   */
  @Cron('0 */4 * * *')
  async handleTokenAutoRefreshCron() {
    try {
      const cfg = await this.getConfig();
      if (!cfg.is_active || !cfg.refresh_token || !cfg.secret_key) return;

      const now = Date.now();
      const expiresAt = cfg.access_token_expires_at ? new Date(cfg.access_token_expires_at).getTime() : 0;
      const hoursRemaining = (expiresAt - now) / (1000 * 3600);

      if (hoursRemaining < 8) {
        this.logger.log(`[Zalo ZNS Cron] Token chỉ còn ${Math.round(hoursRemaining * 10) / 10} giờ, kích hoạt làm mới tự động...`);
        await this.refreshAccessToken();
      }
    } catch (e: any) {
      this.logger.error(`[Zalo ZNS Cron] Lỗi Cron làm mới Token: ${e.message}`);
    }
  }

  // ==========================================
  // 2. HELPER CHUẨN HÓA DỮ LIỆU & DỊCH MÃ LỖI
  // ==========================================

  formatZaloPhone(inputPhone: string): { internationalPhone: string; localPhone: string } {
    if (!inputPhone) return { internationalPhone: '', localPhone: '' };
    let clean = inputPhone.replace(/[\s\.\-\(\)]/g, '').trim();
    if (clean.startsWith('+84')) {
      clean = '84' + clean.slice(3);
    } else if (clean.startsWith('0')) {
      clean = '84' + clean.slice(1);
    }
    const localPhone = clean.startsWith('84') ? '0' + clean.slice(2) : clean;
    return { internationalPhone: clean, localPhone };
  }

  translateZaloError(code: number, rawMsg?: string): string {
    switch (code) {
      case 0:
        return 'Gửi tin thành công';
      case -108:
        return 'Số điện thoại người nhận không đúng định dạng';
      case -114:
        return 'Khách hàng chưa đăng ký hoặc không sử dụng Zalo trên số điện thoại này';
      case -118:
        return 'Mẫu tin nhắn ZNS không tồn tại hoặc chưa được phê duyệt trên Zalo OA';
      case -119:
        return 'Dữ liệu tham số (template_data) không khớp với mẫu đã đăng ký trên Zalo';
      case -124:
        return 'Access Token Zalo không hợp lệ hoặc đã bị vô hiệu hóa';
      case -211:
        return 'Tài khoản Zalo Cloud Account (ZCA) không đủ số dư để gửi tin (400đ/tin)';
      case -216:
        return 'Access Token đã hết hạn';
      case -232:
        return 'Zalo OA chưa được cấp quyền gửi mẫu thông báo ZNS này';
      default:
        return rawMsg || `Lỗi Zalo ZNS (Mã lỗi: ${code})`;
    }
  }

  // ==========================================
  // 3. CORE GỬI TIN ZNS & AUTO RETRY
  // ==========================================

  async sendZnsRaw(
    phone: string,
    templateId: string,
    templateData: Record<string, any>,
    trackingId?: string,
    isRetry = false,
  ): Promise<any> {
    const token = await this.getValidAccessToken();
    const payload = {
      phone,
      template_id: templateId,
      template_data: templateData,
      tracking_id: trackingId || undefined,
    };

    try {
      const response = await axios.post('https://business.openapi.zalo.me/message/template', payload, {
        headers: {
          access_token: token,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      });

      const resData = response.data;
      // Auto-retry once if token expired on server
      if (resData.error === -216 && !isRetry) {
        this.logger.warn(`[Zalo ZNS] Gặp lỗi -216 Token hết hạn, tiến hành refresh và gửi lại...`);
        await this.refreshAccessToken();
        return this.sendZnsRaw(phone, templateId, templateData, trackingId, true);
      }

      return resData;
    } catch (error: any) {
      this.logger.error(`[Zalo ZNS] Lỗi kết nối gửi tin: ${error.message}`);
      if (error.response?.data) {
        return error.response.data;
      }
      return {
        error: -999,
        message: `Lỗi kết nối HTTP: ${error.message}`,
      };
    }
  }

  // ==========================================
  // 4. NGHIỆP VỤ: GỬI ZNS XÁC NHẬN ĐƠN HÀNG
  // ==========================================

  async sendOrderConfirmation(
    orderId: number,
    options?: {
      phone?: string;
      recipientName?: string;
      sentBy?: string;
    },
  ) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['customer'],
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');

    const cfg = await this.getConfig();
    const templateId = cfg.order_confirm_template_id || '632184';

    // Ưu tiên SĐT: options.phone -> contact_phone -> receiver_phone -> customer.phone
    const targetPhoneRaw = options?.phone || order.contact_phone || order.receiver_phone || order.customer?.phone || '';
    const { internationalPhone, localPhone } = this.formatZaloPhone(targetPhoneRaw);

    if (!internationalPhone) {
      throw new BadRequestException('Đơn hàng chưa có số điện thoại người nhận để gửi ZNS');
    }

    const targetName = options?.recipientName || order.contact_name || order.receiver_name || order.customer?.name || 'Quý khách';
    const priceStr = Math.round(Number(order.total_amount || 0)).toString();
    const dateStr = dayjs(order.order_date || new Date()).format('DD/MM/YYYY');
    const portalBase = (cfg.portal_base_url || 'https://localhost:3000').replace(/\/$/, '');
    const portalUrl = `${portalBase}/portal/quote/${order.uuid}`;

    const templateData = {
      name: targetName,
      phone_number: localPhone,
      price: priceStr,
      status: 'Giao dịch thành công',
      date: dateStr,
      order_code: order.order_code,
      order_id: portalUrl,
    };

    const trackingId = order.order_code;

    // Gửi tin ZNS
    const znsResponse = await this.sendZnsRaw(internationalPhone, templateId, templateData, trackingId);
    const errorCode = Number(znsResponse.error) || 0;
    const isSuccess = errorCode === 0;
    const errorMsgVi = this.translateZaloError(errorCode, znsResponse.message);

    // Ghi log
    const log = this.logRepo.create({
      order_id: order.id,
      template_id: templateId,
      template_type: 'ORDER_CONFIRM',
      phone: internationalPhone,
      recipient_name: targetName,
      tracking_id: trackingId,
      msg_id: znsResponse.data?.msg_id || null,
      status: isSuccess ? 'SUCCESS' : 'FAILED',
      error_code: errorCode,
      error_message: errorMsgVi,
      payload: {
        phone: internationalPhone,
        template_id: templateId,
        template_data: templateData,
        tracking_id: trackingId,
      },
      response_data: znsResponse,
      sent_by: options?.sentBy || 'System',
    });
    await this.logRepo.save(log);

    return {
      success: isSuccess,
      message: errorMsgVi,
      msg_id: znsResponse.data?.msg_id,
      error_code: errorCode,
      log,
    };
  }

  // ==========================================
  // 5. NGHIỆP VỤ: GỬI ZNS THÔNG BÁO GIAO HÀNG
  // ==========================================

  async sendDeliveryNotice(
    deliveryId: number,
    options?: {
      phone?: string;
      recipientName?: string;
      templateId?: string;
      templateData?: Record<string, any>;
      sentBy?: string;
    },
  ) {
    const delivery = await this.deliveryRepo.findOne({
      where: { id: deliveryId },
      relations: ['sales_order', 'sales_order.customer', 'items'],
    });
    if (!delivery) throw new NotFoundException('Không tìm thấy phiếu giao hàng');

    const cfg = await this.getConfig();
    const templateId = options?.templateId || cfg.delivery_notice_template_id;

    if (!templateId) {
      throw new BadRequestException('Hệ thống chưa cấu hình Template ID cho mẫu Thông báo giao hàng ZNS. Vui lòng cấu hình trong Cài Đặt Hệ Thống.');
    }

    const targetPhoneRaw = options?.phone || delivery.contact_phone || delivery.sales_order?.contact_phone || delivery.sales_order?.receiver_phone || '';
    const { internationalPhone, localPhone } = this.formatZaloPhone(targetPhoneRaw);

    if (!internationalPhone) {
      throw new BadRequestException('Phiếu giao hàng chưa có số điện thoại người nhận');
    }

    const targetName = options?.recipientName || delivery.contact_name || delivery.sales_order?.contact_name || 'Quý khách';
    const trackingId = delivery.code;

    // Dữ liệu template giao hàng mặc định hoặc tùy chỉnh
    const defaultData = {
      name: targetName,
      phone_number: localPhone,
      delivery_code: delivery.code,
      order_code: delivery.sales_order?.order_code || '',
      carrier_name: delivery.shipping_carrier || 'Chành xe / Nội bộ',
      tracking_code: delivery.tracking_code || 'Chưa có',
      cod_amount: Math.round(Number(delivery.pick_money || 0)).toString(),
      delivery_date: dayjs(delivery.delivery_date || new Date()).format('DD/MM/YYYY'),
      address: delivery.delivery_address || '',
    };

    const templateData = options?.templateData || defaultData;

    const znsResponse = await this.sendZnsRaw(internationalPhone, templateId, templateData, trackingId);
    const errorCode = Number(znsResponse.error) || 0;
    const isSuccess = errorCode === 0;
    const errorMsgVi = this.translateZaloError(errorCode, znsResponse.message);

    // Ghi log
    const log = this.logRepo.create({
      order_id: delivery.order_id,
      delivery_id: delivery.id,
      template_id: templateId,
      template_type: 'DELIVERY_NOTICE',
      phone: internationalPhone,
      recipient_name: targetName,
      tracking_id: trackingId,
      msg_id: znsResponse.data?.msg_id || null,
      status: isSuccess ? 'SUCCESS' : 'FAILED',
      error_code: errorCode,
      error_message: errorMsgVi,
      payload: {
        phone: internationalPhone,
        template_id: templateId,
        template_data: templateData,
        tracking_id: trackingId,
      },
      response_data: znsResponse,
      sent_by: options?.sentBy || 'System',
    });
    await this.logRepo.save(log);

    return {
      success: isSuccess,
      message: errorMsgVi,
      msg_id: znsResponse.data?.msg_id,
      error_code: errorCode,
      log,
    };
  }

  // ==========================================
  // 6. GỬI TIN TEST & TRUY VẤN LOGS
  // ==========================================

  async testConnection(phone: string, templateId?: string): Promise<any> {
    const cfg = await this.getConfig();
    const tId = templateId || cfg.order_confirm_template_id || '632184';
    const { internationalPhone, localPhone } = this.formatZaloPhone(phone);

    if (!internationalPhone) {
      throw new BadRequestException('Vui lòng nhập số điện thoại hợp lệ để thử nghiệm');
    }

    const testData = {
      name: 'Khách Hàng Test',
      phone_number: localPhone,
      price: '100000',
      status: 'Giao dịch thành công',
      date: dayjs().format('DD/MM/YYYY'),
      order_code: 'TEST-SO-001',
      order_id: `${cfg.portal_base_url || 'https://localhost:3000'}`,
    };

    const znsResponse = await this.sendZnsRaw(internationalPhone, tId, testData, 'TEST-001');
    const errorCode = Number(znsResponse.error) || 0;
    const isSuccess = errorCode === 0;
    const errorMsgVi = this.translateZaloError(errorCode, znsResponse.message);

    const log = this.logRepo.create({
      template_id: tId,
      template_type: 'TEST',
      phone: internationalPhone,
      recipient_name: 'Khách Hàng Test',
      tracking_id: 'TEST-001',
      msg_id: znsResponse.data?.msg_id || null,
      status: isSuccess ? 'SUCCESS' : 'FAILED',
      error_code: errorCode,
      error_message: errorMsgVi,
      payload: {
        phone: internationalPhone,
        template_id: tId,
        template_data: testData,
      },
      response_data: znsResponse,
      sent_by: 'Test Connection',
    });
    await this.logRepo.save(log);

    return {
      success: isSuccess,
      error_code: errorCode,
      message: errorMsgVi,
      data: znsResponse,
    };
  }

  async getLogs(query: { order_id?: number; delivery_id?: number; limit?: number }) {
    const qb = this.logRepo.createQueryBuilder('log').orderBy('log.created_at', 'DESC');
    if (query.order_id) {
      qb.andWhere('log.order_id = :orderId', { orderId: query.order_id });
    }
    if (query.delivery_id) {
      qb.andWhere('log.delivery_id = :deliveryId', { deliveryId: query.delivery_id });
    }
    qb.take(query.limit || 50);
    return qb.getMany();
  }

  async getLatestLogForOrder(orderId: number) {
    return this.logRepo.findOne({
      where: { order_id: orderId },
      order: { created_at: 'DESC' },
    });
  }

  async getLatestLogForDelivery(deliveryId: number) {
    return this.logRepo.findOne({
      where: { delivery_id: deliveryId },
      order: { created_at: 'DESC' },
    });
  }
}
