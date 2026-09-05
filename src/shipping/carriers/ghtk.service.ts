import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { SystemConfig } from '../../system/system-config.entity';
import { SalesDelivery } from '../../sales/sales-delivery.entity';
import { SalesOrder } from '../../sales/sales-order.entity';

export interface GhtkConfig {
    apiUrl: string;
    token: string;
    partnerCode: string;
    isSandbox: boolean;
}

export interface GhtkFeeDto {
    pick_province?: string;
    pick_district?: string;
    pick_ward?: string;
    pick_address?: string;
    province: string;
    district: string;
    ward?: string;
    address?: string;
    weight: number; // gram
    value?: number; // VND
    transport?: 'road' | 'fly';
}

@Injectable()
export class GhtkService {
    private readonly logger = new Logger(GhtkService.name);

    constructor(
        @InjectRepository(SystemConfig)
        private readonly configRepo: Repository<SystemConfig>,
        @InjectRepository(SalesDelivery)
        private readonly deliveryRepo: Repository<SalesDelivery>,
        @InjectRepository(SalesOrder)
        private readonly orderRepo: Repository<SalesOrder>,
    ) {}

    /**
     * Lấy cấu hình GHTK (ưu tiên bảng system_configs, fallback sang .env)
     */
    async getConfig(): Promise<GhtkConfig> {
        const configs = await this.configRepo.find();
        const configMap = new Map(configs.map(c => [c.key, c.value]));

        const isSandbox = (configMap.get('GHTK_SANDBOX') || process.env.GHTK_SANDBOX || 'false').toLowerCase() === 'true';
        const defaultUrl = isSandbox ? 'https://services-staging.ghtklab.com' : 'https://services.giaohangtietkiem.vn';

        const apiUrl = configMap.get('GHTK_API_URL') || process.env.GHTK_API_URL || defaultUrl;
        const token = configMap.get('GHTK_TOKEN') || process.env.GHTK_TOKEN || '';
        const partnerCode = configMap.get('GHTK_PARTNER_CODE') || process.env.GHTK_PARTNER_CODE || '';

        return {
            apiUrl: apiUrl.replace(/\/+$/, ''),
            token,
            partnerCode,
            isSandbox,
        };
    }

    private async getHeaders() {
        const cfg = await this.getConfig();
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (cfg.token) {
            headers['Token'] = cfg.token;
        }
        if (cfg.partnerCode) {
            headers['X-Client-Source'] = cfg.partnerCode;
        }
        return { headers, cfg };
    }

    /**
     * Bóc tách & Chuẩn hóa địa chỉ cấp 4 qua GHTK API (hoặc fallback Regex)
     */
    async parseAddress(rawAddress: string) {
        if (!rawAddress || !rawAddress.trim()) {
            throw new BadRequestException('Địa chỉ không được để trống');
        }

        const { headers, cfg } = await this.getHeaders();

        // 1. Thử gọi API chuẩn hóa của GHTK nếu có Token
        if (cfg.token) {
            try {
                const url = `${cfg.apiUrl}/open/api/v1/address/parse-address`;
                const res = await axios.get(url, {
                    headers,
                    params: { address: rawAddress },
                    timeout: 8000,
                });

                if (res.data?.success && res.data?.data) {
                    const d = res.data.data;
                    return {
                        success: true,
                        source: 'GHTK_API',
                        province: d.province || d.city || '',
                        district: d.district || '',
                        ward: d.ward || '',
                        street: d.street || d.address || '',
                        full_address: rawAddress,
                    };
                }
            } catch (err: any) {
                this.logger.warn(`GHTK parseAddress API failed (${err.message}). Fallback to heuristic parser.`);
            }
        }

        // 2. Fallback: Heuristic Parser nội bộ
        const segments = rawAddress.split(',').map(s => s.trim()).filter(Boolean);
        let province = '';
        let district = '';
        let ward = '';
        let street = rawAddress;

        if (segments.length >= 4) {
            province = segments[segments.length - 1];
            district = segments[segments.length - 2];
            ward = segments[segments.length - 3];
            street = segments.slice(0, segments.length - 3).join(', ');
        } else if (segments.length === 3) {
            province = segments[2];
            district = segments[1];
            street = segments[0];
        } else if (segments.length === 2) {
            province = segments[1];
            street = segments[0];
        }

        return {
            success: true,
            source: 'FALLBACK_PARSER',
            province,
            district,
            ward,
            street,
            full_address: rawAddress,
        };
    }

    /**
     * Lấy danh sách điểm lấy hàng (Pick Addresses) của Shop trên GHTK
     */
    async getPickAddresses() {
        const { headers, cfg } = await this.getHeaders();
        if (!cfg.token) {
            // Trả về kho mặc định của ERP4U nếu chưa cấu hình Token GHTK
            return [
                {
                    pick_address_id: 'DEFAULT',
                    address: 'Kho Thành Phẩm ERP4U',
                    pick_name: 'ERP4U Warehouse',
                    pick_tel: '0901234567',
                    province: 'Hồ Chí Minh',
                    district: 'Quận 7',
                    ward: 'Phường Tân Phú',
                }
            ];
        }

        try {
            const url = `${cfg.apiUrl}/open/api/v1/pick-address`;
            const res = await axios.get(url, { headers, timeout: 8000 });
            if (res.data?.success && Array.isArray(res.data?.data)) {
                return res.data.data;
            }
            return [];
        } catch (err: any) {
            this.logger.error(`Error fetching GHTK pick addresses: ${err.message}`);
            return [];
        }
    }

    /**
     * Tính cước vận chuyển dự kiến (Estimate Fee)
     */
    async calculateFee(dto: GhtkFeeDto) {
        const { headers, cfg } = await this.getHeaders();

        if (!cfg.token) {
            // Chế độ mô phỏng khi chưa nhập Token (để kiểm thử UI)
            const baseFee = 25000;
            const extraWeight = Math.max(0, (dto.weight || 500) - 1000);
            const fee = baseFee + Math.ceil(extraWeight / 500) * 5000;
            return {
                success: true,
                fee: {
                    fee,
                    insurance_fee: dto.value && dto.value > 1000000 ? Math.round(dto.value * 0.005) : 0,
                    delivery_type: dto.transport || 'road',
                    name: 'Giao hàng chuẩn (Demo)',
                },
                is_mock: true,
            };
        }

        try {
            const url = `${cfg.apiUrl}/open/api/v1/order/fee`;
            const params = {
                pick_province: dto.pick_province || 'Hồ Chí Minh',
                pick_district: dto.pick_district || 'Quận 7',
                pick_ward: dto.pick_ward || '',
                pick_address: dto.pick_address || '',
                province: dto.province,
                district: dto.district,
                ward: dto.ward || '',
                address: dto.address || '',
                weight: Number(dto.weight) || 500, // gram
                value: Number(dto.value) || 0,
                transport: dto.transport || 'road',
            };

            const res = await axios.post(url, params, { headers, timeout: 10000 });
            if (res.data?.success && res.data?.fee) {
                return {
                    success: true,
                    fee: res.data.fee,
                    is_mock: false,
                };
            }
            throw new BadRequestException(res.data?.message || 'Không thể tính phí vận chuyển GHTK');
        } catch (err: any) {
            this.logger.error(`GHTK Calculate Fee Error: ${err.response?.data?.message || err.message}`);
            throw new BadRequestException(err.response?.data?.message || 'Lỗi khi gọi API tính cước GHTK: ' + err.message);
        }
    }

    /**
     * Đẩy phiếu xuất kho sang GHTK để tạo vận đơn (Submit Express Order)
     */
    async pushDeliveryToGhtk(deliveryId: number, options: {
        pick_address_id?: string;
        pick_name?: string;
        pick_tel?: string;
        pick_address?: string;
        pick_province?: string;
        pick_district?: string;
        pick_ward?: string;
        province: string;
        district: string;
        ward?: string;
        address?: string;
        note?: string;
        weight_gram?: number;
        pick_money?: number;
        is_freeship?: number;
        transport?: 'road' | 'fly';
    }) {
        const delivery = await this.deliveryRepo.findOne({
            where: { id: deliveryId },
            relations: ['sales_order', 'items'],
        });
        if (!delivery) throw new NotFoundException('Không tìm thấy phiếu xuất kho');

        if (delivery.tracking_code && delivery.shipping_carrier === 'GHTK' && delivery.shipping_status_id && delivery.shipping_status_id > 0) {
            throw new BadRequestException(`Phiếu này đã có mã vận đơn GHTK: ${delivery.tracking_code}`);
        }

        const { headers, cfg } = await this.getHeaders();

        // Chuẩn bị danh sách sản phẩm
        const products = (delivery.items || []).map((item, idx) => ({
            name: item.sku,
            weight: (options.weight_gram ? (options.weight_gram / 1000) / delivery.items.length : 0.2), // kg
            quantity: item.quantity || 1,
            product_code: item.sku,
        }));

        const isFreeship = options.is_freeship !== undefined ? options.is_freeship : (delivery.is_freeship !== undefined ? delivery.is_freeship : 1);
        const pickMoney = options.pick_money !== undefined ? options.pick_money : Number(delivery.pick_money || 0);
        const totalWeight = (options.weight_gram || delivery.weight_gram || 500) / 1000; // Đổi gram sang kg

        const payload: any = {
            products,
            order: {
                id: delivery.code, // Mã phiếu xuất kho làm partner_id
                pick_name: options.pick_name || 'ERP4U',
                pick_money: pickMoney,
                pick_address: options.pick_address || 'Kho ERP4U',
                pick_province: options.pick_province || 'Hồ Chí Minh',
                pick_district: options.pick_district || 'Quận 7',
                pick_ward: options.pick_ward || 'Tân Phú',
                pick_tel: options.pick_tel || '0901234567',
                name: delivery.contact_name || delivery.sales_order?.receiver_name || 'Khách hàng',
                address: options.address || delivery.delivery_address,
                province: options.province,
                district: options.district,
                ward: options.ward || '',
                tel: delivery.contact_phone || delivery.sales_order?.receiver_phone || '',
                note: options.note || delivery.note || 'Cho xem hàng không cho thử',
                is_freeship: isFreeship,
                total_weight: totalWeight,
                value: Number(delivery.sales_order?.total_amount) || 0,
                transport: options.transport || 'road',
            }
        };

        if (options.pick_address_id && options.pick_address_id !== 'DEFAULT') {
            payload.order.pick_address_id = options.pick_address_id;
        }

        // Nếu chưa cấu hình Token: Chế độ Sandbox Simulation
        if (!cfg.token) {
            const mockTrackingCode = `GHTK-DEMO-${Date.now().toString().slice(-6)}`;
            delivery.shipping_carrier = 'GHTK';
            delivery.shipping_provider = 'GHTK';
            delivery.tracking_code = mockTrackingCode;
            delivery.shipping_cost = 32000;
            delivery.pick_money = pickMoney;
            delivery.is_freeship = isFreeship;
            delivery.weight_gram = options.weight_gram || delivery.weight_gram || 500;
            delivery.shipping_status_id = 2; // Chờ lấy hàng
            delivery.shipping_status_text = 'Tiếp nhận đơn hàng (Mô phỏng)';
            delivery.shipping_metadata = {
                is_mock: true,
                created_at: new Date().toISOString(),
                payload,
            };
            await this.deliveryRepo.save(delivery);
            return {
                success: true,
                tracking_code: mockTrackingCode,
                fee: 32000,
                status: 'Chờ lấy hàng',
                is_mock: true,
                message: 'Đã tạo vận đơn GHTK mô phỏng thành công (do chưa nhập Token GHTK)',
            };
        }

        try {
            const url = `${cfg.apiUrl}/open/api/v1/order/sync`;
            const res = await axios.post(url, payload, { headers, timeout: 15000 });

            if (res.data?.success && res.data?.order) {
                const ghtkOrder = res.data.order;
                delivery.shipping_carrier = 'GHTK';
                delivery.shipping_provider = 'GHTK';
                delivery.tracking_code = ghtkOrder.label_id || ghtkOrder.tracking_id;
                delivery.shipping_cost = Number(ghtkOrder.fee) || delivery.shipping_cost;
                delivery.pick_money = pickMoney;
                delivery.is_freeship = isFreeship;
                delivery.weight_gram = options.weight_gram || delivery.weight_gram || 500;
                delivery.shipping_status_id = 2; // Chờ lấy hàng
                delivery.shipping_status_text = 'Chờ lấy hàng';
                delivery.shipping_metadata = {
                    ...res.data,
                    pushed_at: new Date().toISOString(),
                };

                await this.deliveryRepo.save(delivery);

                return {
                    success: true,
                    tracking_code: delivery.tracking_code,
                    fee: delivery.shipping_cost,
                    estimated_deliver_time: ghtkOrder.estimated_deliver_time,
                    message: 'Đẩy đơn sang GHTK thành công!',
                };
            }

            throw new BadRequestException(res.data?.message || 'GHTK từ chối tiếp nhận đơn hàng');
        } catch (err: any) {
            this.logger.error(`Error pushing to GHTK: ${err.response?.data?.message || err.message}`);
            throw new BadRequestException(err.response?.data?.message || 'Lỗi khi tạo vận đơn GHTK: ' + err.message);
        }
    }

    /**
     * Hủy vận đơn GHTK
     */
    async cancelGhtkOrder(deliveryId: number) {
        const delivery = await this.deliveryRepo.findOne({ where: { id: deliveryId } });
        if (!delivery) throw new NotFoundException('Không tìm thấy phiếu xuất kho');

        if (!delivery.tracking_code) {
            throw new BadRequestException('Phiếu này chưa có mã vận đơn để hủy');
        }

        const { headers, cfg } = await this.getHeaders();

        if (!cfg.token || delivery.tracking_code.startsWith('GHTK-DEMO')) {
            delivery.shipping_status_id = -1;
            delivery.shipping_status_text = 'Đã hủy đơn GHTK (Mô phỏng)';
            await this.deliveryRepo.save(delivery);
            return { success: true, message: 'Đã hủy đơn GHTK mô phỏng' };
        }

        try {
            const url = `${cfg.apiUrl}/open/api/v1/order/cancel/${delivery.tracking_code}`;
            const res = await axios.post(url, {}, { headers, timeout: 10000 });

            if (res.data?.success) {
                delivery.shipping_status_id = -1;
                delivery.shipping_status_text = 'Đã hủy đơn GHTK';
                await this.deliveryRepo.save(delivery);
                return { success: true, message: res.data?.message || 'Hủy vận đơn GHTK thành công' };
            }
            throw new BadRequestException(res.data?.message || 'Không thể hủy đơn GHTK');
        } catch (err: any) {
            throw new BadRequestException(err.response?.data?.message || 'Lỗi khi hủy đơn GHTK: ' + err.message);
        }
    }

    /**
     * Lấy link in nhãn vận đơn GHTK (PDF khổ A6 hoặc 80x103)
     */
    async getLabelUrl(deliveryId: number, pageSize: string = 'A6') {
        const delivery = await this.deliveryRepo.findOne({ where: { id: deliveryId } });
        if (!delivery) throw new NotFoundException('Không tìm thấy phiếu xuất kho');
        if (!delivery.tracking_code) throw new BadRequestException('Phiếu xuất kho chưa có mã vận đơn');

        const cfg = await this.getConfig();
        // Link in nhãn chính thức từ GHTK
        return `${cfg.apiUrl}/open/api/v1/order/label/${delivery.tracking_code}?original=pdf&page_size=${pageSize}`;
    }

    /**
     * Tra cứu trạng thái hành trình vận đơn
     */
    async getTracking(deliveryId: number) {
        const delivery = await this.deliveryRepo.findOne({ where: { id: deliveryId } });
        if (!delivery) throw new NotFoundException('Không tìm thấy phiếu xuất kho');
        if (!delivery.tracking_code) throw new BadRequestException('Phiếu chưa có mã vận đơn');

        const { headers, cfg } = await this.getHeaders();

        if (!cfg.token || delivery.tracking_code.startsWith('GHTK-DEMO')) {
            return {
                success: true,
                tracking_code: delivery.tracking_code,
                status_text: delivery.shipping_status_text || 'Chờ lấy hàng',
                timeline: [
                    { time: new Date().toISOString(), status: 'Tiếp nhận đơn hàng thành công' },
                    { time: new Date().toISOString(), status: 'Đang điều phối Shipper lấy hàng' },
                ],
                is_mock: true,
            };
        }

        try {
            const url = `${cfg.apiUrl}/open/api/v1/order/tracking/${delivery.tracking_code}`;
            const res = await axios.get(url, { headers, timeout: 8000 });
            return res.data;
        } catch (err: any) {
            throw new BadRequestException(err.response?.data?.message || 'Không thể tra cứu trạng thái vận đơn: ' + err.message);
        }
    }

    /**
     * Xử lý Webhook callback trạng thái từ GHTK
     */
    async handleWebhook(body: any) {
        this.logger.log(`Received GHTK Webhook: ${JSON.stringify(body)}`);
        const labelId = body.label_id || body.tracking_id;
        if (!labelId) return { success: false, message: 'Missing label_id' };

        const delivery = await this.deliveryRepo.findOne({ where: { tracking_code: labelId } });
        if (!delivery) {
            this.logger.warn(`No delivery found for tracking code: ${labelId}`);
            return { success: false, message: 'Delivery not found' };
        }

        const statusId = Number(body.status_id);
        delivery.shipping_status_id = statusId;
        delivery.shipping_status_text = body.status_text || this.mapStatusIdToText(statusId);
        delivery.shipping_metadata = {
            ...(delivery.shipping_metadata || {}),
            last_webhook: body,
            updated_at: new Date().toISOString(),
        };

        // Nếu GHTK đã giao hàng thành công (status_id = 5 hoặc 6)
        if (statusId === 5 || statusId === 6) {
            delivery.status = 'SHIPPED';
        }

        await this.deliveryRepo.save(delivery);
        return { success: true };
    }

    private mapStatusIdToText(statusId: number): string {
        const map: Record<number, string> = {
            [-1]: 'Hủy đơn hàng',
            1: 'Chưa tiếp nhận',
            2: 'Đã tiếp nhận',
            3: 'Đã lấy hàng/Đã nhập kho',
            4: 'Đang giao hàng',
            5: 'Đã giao hàng/Chưa đối soát',
            6: 'Đã đối soát',
            7: 'Không lấy được hàng',
            8: 'Hoãn lấy hàng',
            9: 'Không giao được hàng',
            10: 'Delay giao hàng',
            11: 'Đã đối soát công nợ trả hàng',
            12: 'Đang lấy hàng',
            13: 'Đơn hàng bồi hoàn',
            20: 'Đang trả hàng',
            21: 'Đã trả hàng',
        };
        return map[statusId] || `Trạng thái (${statusId})`;
    }
}
